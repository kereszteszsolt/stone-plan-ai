// SPDX-FileCopyrightText: 2026 Keresztes Zsolt <https://kereszteszsolt.hu>
// SPDX-License-Identifier: Apache-2.0

import { Body, Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { TasksService } from '../tasks/tasks.service';
import { TaskInputPipe } from '../tasks/task-input';
import { planProposalSchema, type ProposedSubtask } from './plan-schema';

@Controller('tasks')
export class PlanController {
  constructor(private readonly tasks: TasksService) {}

  @Post(':id/plan')
  save(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new TaskInputPipe(planProposalSchema)) input: { subtasks: ProposedSubtask[] },
  ) {
    return this.tasks.savePlan(id, input.subtasks);
  }
}
