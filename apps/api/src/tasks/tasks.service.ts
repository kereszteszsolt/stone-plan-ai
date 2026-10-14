// SPDX-FileCopyrightText: 2026 Keresztes Zsolt <https://kereszteszsolt.hu>
// SPDX-License-Identifier: Apache-2.0

import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma.service';
import type { CreateTaskInput, UpdateTaskInput } from './task-input';

const withSubtasks = { subtasks: { orderBy: { order: 'asc' as const } } };

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.task.findMany({ orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
  }

  async get(id: string) {
    const task = await this.prisma.task.findUnique({ where: { id }, include: withSubtasks });
    if (!task) {
      throw new NotFoundException('Task not found.');
    }
    return task;
  }

  create(input: CreateTaskInput) {
    return this.prisma.task.create({
      data: { ...input, description: input.description || null },
      include: withSubtasks,
    });
  }

  async update(id: string, input: UpdateTaskInput) {
    const task = await this.get(id);
    if (task.subtasks.length && (
      (input.days !== undefined && input.days !== task.days) ||
      (input.minutesPerDay !== undefined && input.minutesPerDay !== task.minutesPerDay)
    )) {
      throw new ConflictException('The time budget cannot change after a plan has been saved.');
    }
    try {
      return await this.prisma.task.update({
        where: { id },
        data: {
          ...input,
          ...(input.description !== undefined ? { description: input.description || null } : {}),
        },
        include: withSubtasks,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('Task not found.');
      }
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.prisma.task.delete({ where: { id } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('Task not found.');
      }
      throw error;
    }
  }
}
