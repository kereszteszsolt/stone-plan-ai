// SPDX-FileCopyrightText: 2026 Keresztes Zsolt <https://kereszteszsolt.hu>
// SPDX-License-Identifier: Apache-2.0

import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { createTaskSchema, updateTaskSchema, TaskInputPipe, type CreateTaskInput, type UpdateTaskInput } from './task-input';
import { TasksService } from './tasks.service';

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  list() {
    return this.tasks.list();
  }

  @Get(':id')
  get(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.tasks.get(id);
  }

  @Post()
  create(@Body(new TaskInputPipe(createTaskSchema)) input: CreateTaskInput) {
    return this.tasks.create(input);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new TaskInputPipe(updateTaskSchema)) input: UpdateTaskInput,
  ) {
    return this.tasks.update(id, input);
  }

  @Delete(':id')
  @HttpCode(204)
  async delete(@Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    await this.tasks.delete(id);
  }
}
