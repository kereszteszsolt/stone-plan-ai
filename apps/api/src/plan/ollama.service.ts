// SPDX-FileCopyrightText: 2026 Keresztes Zsolt <https://kereszteszsolt.hu>
// SPDX-License-Identifier: Apache-2.0

import { GatewayTimeoutException, HttpException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { z } from 'zod';
import { planJsonSchema, planProposalSchema, type ProposedSubtask } from './plan-schema';
import { planMessages, type TaskPrompt } from './plan-prompt';
import { invalidAiOutput, readModelResponse } from './model-response';
import { readTokenUsage, type UsageReporter } from './ai-call-diagnostics';

const replySchema = z.object({
  done: z.literal(true), done_reason: z.string().optional(), message: z.object({ content: z.string().min(1).max(60000) }),
}).refine((reply) => reply.done_reason !== 'length');

@Injectable()
export class OllamaService {
  async generate(task: TaskPrompt, onUsage?: UsageReporter): Promise<ProposedSubtask[]> {
    const model = process.env['OLLAMA_MODEL']?.trim();
    const timeout = Number(process.env['OLLAMA_TIMEOUT_MS'] ?? 60000);
    let url: URL;
    try {
      url = new URL('api/chat', `${process.env['OLLAMA_BASE_URL']?.replace(/\/$/, '')}/`);
      if (!['http:', 'https:'].includes(url.protocol) || !model || model === 'replace-with-your-installed-model-name' ||
        /(?:^|[:-])cloud(?:$|[:-])/i.test(model) || !Number.isInteger(timeout) || timeout < 1000 || timeout > 120000) {
        throw new Error('Invalid local model configuration');
      }
    } catch {
      throw new ServiceUnavailableException({
        code: 'OLLAMA_NOT_CONFIGURED',
        message: 'Configure an installed local Ollama model and its URL, then try again.',
      });
    }

    const signal = AbortSignal.timeout(timeout);
    const format = planJsonSchema(task.minutesPerDay);
    let raw: string;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal,
        body: JSON.stringify({
          model,
          stream: false,
          think: false,
          format,
          options: { temperature: 0, num_predict: 1024 },
          messages: planMessages(task),
        }),
      });
      if (!response.ok) {
        await response.body?.cancel();
        throw new ServiceUnavailableException({
          code: 'OLLAMA_UNAVAILABLE',
          message: 'Ollama could not serve the local model. Check that the server is running and the model is installed, then try again.',
        });
      }
      raw = await readModelResponse(response);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      if (signal.aborted || (error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name))) {
        throw new GatewayTimeoutException({ code: 'OLLAMA_TIMEOUT', message: 'The local model took too long. Try generating again.' });
      }
      throw new ServiceUnavailableException({
        code: 'OLLAMA_UNAVAILABLE',
        message: 'The local model is offline or unreachable. Start Ollama and check its URL, then try again.',
      });
    }
    try {
      const parsed: unknown = JSON.parse(raw);
      onUsage?.(readTokenUsage('ollama', parsed));
      const reply = replySchema.parse(parsed);
      return planProposalSchema.parse(JSON.parse(reply.message.content)).subtasks;
    } catch {
      throw invalidAiOutput();
    }
  }
}
