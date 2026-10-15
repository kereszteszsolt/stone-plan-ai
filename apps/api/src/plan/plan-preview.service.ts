// SPDX-FileCopyrightText: 2026 Keresztes Zsolt <https://kereszteszsolt.hu>
// SPDX-License-Identifier: Apache-2.0

import { ConflictException, Injectable } from '@nestjs/common';
import { TasksService } from '../tasks/tasks.service';
import { OllamaService } from './ollama.service';
import { schedulePlan } from './schedule-plan';

@Injectable()
export class PlanPreviewService {
  constructor(private readonly tasks: TasksService, private readonly ollama: OllamaService) {}

  async generate(id: string) {
    const task = await this.tasks.get(id);
    if (task.subtasks.length) {
      throw new ConflictException('This task already has a saved plan. Create a new task for a different plan.');
    }
    const proposal = await this.ollama.generate({
      title: task.title, description: task.description, days: task.days, minutesPerDay: task.minutesPerDay,
    });
    return { subtasks: schedulePlan(proposal, task.days, task.minutesPerDay) };
  }
}
