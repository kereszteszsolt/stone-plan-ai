// SPDX-FileCopyrightText: 2026 Keresztes Zsolt <https://kereszteszsolt.hu>
// SPDX-License-Identifier: Apache-2.0

import { Body, Controller, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import { z } from 'zod';
import { TaskInputPipe } from './task-input';
import { TasksService } from './tasks.service';

const completionSchema = z.strictObject({ completed: z.boolean() });

@Controller('subtasks')
export class SubtasksController {
  constructor(private readonly tasks: TasksService) {}

  @Patch(':id')
  setCompleted(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new TaskInputPipe(completionSchema)) input: { completed: boolean },
  ) {
    return this.tasks.setCompleted(id, input.completed);
  }
}
