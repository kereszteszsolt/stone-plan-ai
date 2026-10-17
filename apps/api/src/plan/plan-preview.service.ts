// SPDX-FileCopyrightText: 2026 Keresztes Zsolt <https://kereszteszsolt.hu>
// SPDX-License-Identifier: Apache-2.0

import { ConflictException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { TasksService } from '../tasks/tasks.service';
import { OllamaService } from './ollama.service';
import { OpenRouterService } from './openrouter.service';
import { schedulePlan } from './schedule-plan';
import { safeErrorCategory, safeModelIdentifier, type AiPlanCall, type TokenUsage } from './ai-call-diagnostics';
import { LangfuseTracingService } from './langfuse-tracing.service';

@Injectable()
export class PlanPreviewService {
  private readonly logger = new Logger(PlanPreviewService.name);

  constructor(
    private readonly tasks: TasksService,
    private readonly ollama: OllamaService,
    private readonly openrouter: OpenRouterService,
    private readonly tracing: LangfuseTracingService,
  ) {}

  async generate(id: string, requestId = randomUUID()) {
    const task = await this.tasks.get(id);
    if (task.subtasks.length) {
      throw new ConflictException('This task already has a saved plan. Create a new task for a different plan.');
    }
    const provider = process.env['AI_PROVIDER'] ?? 'ollama';
    if (provider !== 'ollama' && provider !== 'openrouter') {
      throw new ServiceUnavailableException({
        code: 'AI_PROVIDER_NOT_CONFIGURED',
        message: 'Set the backend AI_PROVIDER to ollama or openrouter before generating a plan.',
      });
    }
    const generator = provider === 'ollama' ? this.ollama : this.openrouter;
    const model = safeModelIdentifier(process.env[provider === 'ollama' ? 'OLLAMA_MODEL' : 'OPENROUTER_MODEL'],
      process.env['OPENROUTER_API_KEY'], process.env['LANGFUSE_PUBLIC_KEY'], process.env['LANGFUSE_SECRET_KEY']);
    const started = performance.now();
    let outcome: 'success' | 'failure' = 'failure';
    let errorCategory: string | null = null;
    let usage: TokenUsage | undefined;
    try {
      const proposal = await generator.generate({
        title: task.title, description: task.description, days: task.days, minutesPerDay: task.minutesPerDay,
      }, (reported) => { usage = reported; });
      const subtasks = schedulePlan(proposal, task.days, task.minutesPerDay);
      outcome = 'success';
      return { subtasks };
    } catch (error) {
      errorCategory = safeErrorCategory(error);
      throw error;
    } finally {
      const call: AiPlanCall = {
        event: 'ai_plan_call', requestId, provider, model, outcome,
        durationMs: Math.max(0, Math.round(performance.now() - started)), errorCategory,
        ...(usage ? { usage } : {}),
      };
      this.logger.log(JSON.stringify(call));
      this.tracing.record(call);
    }
  }
}
