// SPDX-FileCopyrightText: 2026 Keresztes Zsolt <https://kereszteszsolt.hu>
// SPDX-License-Identifier: Apache-2.0

import { HttpException } from '@nestjs/common';
import { z } from 'zod';

export type AiProvider = 'ollama' | 'openrouter';
export interface TokenUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}
// Keep known usage even when proposal validation later rejects the model reply.
export type UsageReporter = (usage: TokenUsage | undefined) => void;

const count = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional().catch(undefined);
const ollamaUsage = z.object({ prompt_eval_count: count, eval_count: count });
const openrouterUsage = z.object({ usage: z.object({
  prompt_tokens: count, completion_tokens: count, total_tokens: count,
}).optional().catch(undefined) });

export function readTokenUsage(provider: AiProvider, reply: unknown): TokenUsage | undefined {
  let values: (number | undefined)[];
  if (provider === 'ollama') {
    const result = ollamaUsage.safeParse(reply);
    if (!result.success) return undefined;
    values = [result.data.prompt_eval_count, result.data.eval_count];
  } else {
    const result = openrouterUsage.safeParse(reply);
    if (!result.success || !result.data.usage) return undefined;
    values = [result.data.usage.prompt_tokens, result.data.usage.completion_tokens, result.data.usage.total_tokens];
  }
  const usage: TokenUsage = {};
  const keys = ['inputTokens', 'outputTokens', 'totalTokens'] as const;
  values.forEach((value, index) => { if (value !== undefined) usage[keys[index]] = value; });
  return Object.keys(usage).length ? usage : undefined;
}

export function safeModelIdentifier(model: string | undefined, apiKey: string | undefined): string {
  const value = model?.trim() ?? '';
  const secret = apiKey?.trim();
  if (!/^[a-z0-9][a-z0-9._:/-]{0,159}$/i.test(value) || value.startsWith('replace-with-') || /^sk-/i.test(value) || (secret && value.includes(secret))) {
    return 'unknown';
  }
  return value;
}

const errorCategories = new Set([
  'OLLAMA_NOT_CONFIGURED', 'OLLAMA_UNAVAILABLE', 'OLLAMA_TIMEOUT',
  'OPENROUTER_NOT_CONFIGURED', 'OPENROUTER_ACCESS_DENIED', 'OPENROUTER_CREDITS_REQUIRED',
  'OPENROUTER_MODEL_UNSUPPORTED', 'OPENROUTER_RATE_LIMITED', 'OPENROUTER_UNAVAILABLE', 'OPENROUTER_TIMEOUT',
  'INVALID_AI_OUTPUT', 'PLAN_EXCEEDS_BUDGET',
]);

export function safeErrorCategory(error: unknown): string {
  if (error instanceof HttpException) {
    const response = error.getResponse();
    if (response !== null && typeof response === 'object' && 'code' in response && typeof response.code === 'string' && errorCategories.has(response.code)) {
      return response.code;
    }
  }
  return 'UNKNOWN_ERROR';
}
