// SPDX-FileCopyrightText: 2026 Keresztes Zsolt <https://kereszteszsolt.hu>
// SPDX-License-Identifier: Apache-2.0

import { BadGatewayException, GatewayTimeoutException, HttpException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { z } from 'zod';
import { invalidAiOutput, readModelResponse } from './model-response';
import { planMessages, type TaskPrompt } from './plan-prompt';
import { planJsonSchema, planProposalForDays, type ProposedSubtask } from './plan-schema';
import { readTokenUsage, type UsageReporter } from './ai-call-diagnostics';

const replySchema = z.object({
  error: z.never().optional(),
  choices: z.array(z.object({
    error: z.never().optional(),
    finish_reason: z.literal('stop'),
    message: z.object({
      role: z.literal('assistant'),
      content: z.string().min(1).max(60000),
      refusal: z.null().optional(),
      tool_calls: z.array(z.unknown()).length(0).optional(),
    }),
  })).length(1),
});
const errorSchema = z.object({ error: z.object({ code: z.number().int() }) });
const truncatedReplySchema = z.object({ choices: z.array(z.object({ finish_reason: z.literal('length') })).length(1) });

function providerError(status: number): HttpException {
  if (status === 408 || status === 504) {
    return new GatewayTimeoutException({ code: 'OPENROUTER_TIMEOUT', message: 'OpenRouter took too long. Try generating again.' });
  }
  if (status === 401 || status === 403) {
    return new ServiceUnavailableException({ code: 'OPENROUTER_ACCESS_DENIED', message: 'OpenRouter denied this request. Check the backend API key, permissions, and model access.' });
  }
  if (status === 402) {
    return new ServiceUnavailableException({ code: 'OPENROUTER_CREDITS_REQUIRED', message: 'OpenRouter has insufficient credits. Check the account balance and spending limits.' });
  }
  if (status === 429) {
    return new ServiceUnavailableException({ code: 'OPENROUTER_RATE_LIMITED', message: 'OpenRouter is rate limited. Wait a moment, then try generating again.' });
  }
  if ([400, 404, 422].includes(status)) {
    return new ServiceUnavailableException({ code: 'OPENROUTER_MODEL_UNSUPPORTED', message: 'OpenRouter could not use this model with the required JSON schema. Check OPENROUTER_MODEL and its structured-output support.' });
  }
  return new ServiceUnavailableException({ code: 'OPENROUTER_UNAVAILABLE', message: 'OpenRouter is unavailable or has no compatible provider. Check the configured model and URL, then try again.' });
}

@Injectable()
export class OpenRouterService {
  async generate(task: TaskPrompt, onUsage?: UsageReporter): Promise<ProposedSubtask[]> {
    const apiKey = process.env['OPENROUTER_API_KEY']?.trim();
    const model = process.env['OPENROUTER_MODEL']?.trim();
    const timeout = Number(process.env['OPENROUTER_TIMEOUT_MS'] ?? 60000);
    const maxTokens = Number(process.env['OPENROUTER_MAX_TOKENS'] ?? 4096);
    let url: URL;
    try {
      url = new URL(`${(process.env['OPENROUTER_BASE_URL'] ?? 'https://openrouter.ai/api/v1').replace(/\/+$/, '')}/chat/completions`);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash ||
        !apiKey || /\s/.test(apiKey) || apiKey.startsWith('replace-with-') || !model || model.startsWith('replace-with-') ||
        !Number.isInteger(timeout) || timeout < 1000 || timeout > 120000 ||
        !Number.isInteger(maxTokens) || maxTokens < 256 || maxTokens > 8192) {
        throw new Error('Invalid OpenRouter configuration');
      }
    } catch {
      throw new ServiceUnavailableException({
        code: 'OPENROUTER_NOT_CONFIGURED',
        message: 'Configure the backend OpenRouter API key, model, URL, timeout, and output token limit before generating.',
      });
    }

    const signal = AbortSignal.timeout(timeout);
    let raw: string;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        redirect: 'error',
        signal,
        body: JSON.stringify({
          model,
          stream: false,
          temperature: 0,
          max_tokens: maxTokens,
          messages: planMessages(task),
          response_format: { type: 'json_schema', json_schema: { name: 'task_plan', strict: true, schema: planJsonSchema(task.days, task.minutesPerDay) } },
          provider: { require_parameters: true, allow_fallbacks: false },
        }),
      });
      if (!response.ok) {
        await response.body?.cancel();
        throw providerError(response.status);
      }
      raw = await readModelResponse(response);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      if (signal.aborted || (error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name))) {
        throw providerError(504);
      }
      throw providerError(503);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw invalidAiOutput();
    }
    onUsage?.(readTokenUsage('openrouter', parsed));
    // OpenRouter can report a provider failure inside an HTTP 200 response.
    const failure = errorSchema.safeParse(parsed);
    if (failure.success) throw providerError(failure.data.error.code);
    if (truncatedReplySchema.safeParse(parsed).success) {
      throw new BadGatewayException({
        code: 'OPENROUTER_OUTPUT_TRUNCATED',
        message: 'The model reached its output token limit before finishing the plan. Increase the backend output limit, then try again.',
      });
    }
    try {
      const reply = replySchema.parse(parsed);
      return planProposalForDays(task.days).parse(JSON.parse(reply.choices[0].message.content)).subtasks;
    } catch {
      throw invalidAiOutput();
    }
  }
}
