// SPDX-FileCopyrightText: 2026 Keresztes Zsolt <https://kereszteszsolt.hu>
// SPDX-License-Identifier: Apache-2.0

import { ConflictException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { TasksService } from '../tasks/tasks.service';
import { OllamaService } from './ollama.service';
import { OpenRouterService } from './openrouter.service';
import { schedulePlan } from './schedule-plan';

@Injectable()
export class PlanPreviewService {
  constructor(
    private readonly tasks: TasksService,
    private readonly ollama: OllamaService,
    private readonly openrouter: OpenRouterService,
  ) {}

  async generate(id: string) {
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
    const proposal = await generator.generate({
      title: task.title, description: task.description, days: task.days, minutesPerDay: task.minutesPerDay,
    });
    return { subtasks: schedulePlan(proposal, task.days, task.minutesPerDay) };
  }
}
