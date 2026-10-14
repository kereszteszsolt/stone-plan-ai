// SPDX-FileCopyrightText: 2026 Keresztes Zsolt <https://kereszteszsolt.hu>
// SPDX-License-Identifier: Apache-2.0

import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma.service';
import type { CreateTaskInput, UpdateTaskInput } from './task-input';
import type { ProposedSubtask } from '../plan/plan-schema';
import { schedulePlan } from '../plan/schedule-plan';

const withSubtasks = { subtasks: { orderBy: { order: 'asc' as const } } };
type TaskWithSubtasks = Prisma.TaskGetPayload<{ include: typeof withSubtasks }>;

function progress(subtasks: { completed: boolean }[]) {
  const total = subtasks.length;
  const completed = subtasks.filter((step) => step.completed).length;
  return { total, completed, percent: total ? Math.round(completed * 100 / total) : 0 };
}

function withProgress<T extends { subtasks: { completed: boolean }[] }>(task: T) {
  return { ...task, progress: progress(task.subtasks) };
}

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const tasks = await this.prisma.task.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: { subtasks: { select: { completed: true } } },
    });
    return tasks.map(({ subtasks, ...task }) => ({ ...task, progress: progress(subtasks) }));
  }

  async get(id: string) {
    const task = await this.prisma.task.findUnique({ where: { id }, include: withSubtasks });
    if (!task) {
      throw new NotFoundException('Task not found.');
    }
    return withProgress(task);
  }

  async create(input: CreateTaskInput) {
    const task = await this.prisma.task.create({
      data: { ...input, description: input.description || null },
      include: withSubtasks,
    });
    return withProgress(task);
  }

  async update(id: string, input: UpdateTaskInput) {
    return this.withTaskLock(id, (tx, task) => {
      if (task.subtasks.length && (
        (input.days !== undefined && input.days !== task.days) ||
        (input.minutesPerDay !== undefined && input.minutesPerDay !== task.minutesPerDay)
      )) {
        throw new ConflictException('The time budget cannot change after a plan has been saved.');
      }
      return tx.task.update({
        where: { id },
        data: {
          ...input,
          ...(input.description !== undefined ? { description: input.description || null } : {}),
        },
        include: withSubtasks,
      });
    });
  }

  savePlan(id: string, subtasks: ProposedSubtask[]) {
    return this.withTaskLock(id, (tx, task) => {
      if (task.subtasks.length) {
        throw new ConflictException('A plan has already been saved. Select the task again to load it.');
      }
      const scheduled = schedulePlan(subtasks, task.days, task.minutesPerDay);
      return tx.task.update({
        where: { id },
        data: { subtasks: { create: scheduled } },
        include: withSubtasks,
      });
    });
  }

  async setCompleted(id: string, completed: boolean) {
    const subtask = await this.prisma.subtask.findUnique({ where: { id }, select: { taskId: true } });
    if (!subtask) throw new NotFoundException('Step not found.');
    return this.withTaskLock(subtask.taskId, async (tx, task) => {
      if (!task.subtasks.some((step) => step.id === id)) throw new NotFoundException('Step not found.');
      await tx.subtask.update({ where: { id }, data: { completed } });
      return tx.task.update({ where: { id: task.id }, data: { updatedAt: new Date() }, include: withSubtasks });
    });
  }

  private async withTaskLock(id: string, change: (tx: Prisma.TransactionClient, task: TaskWithSubtasks) => Promise<TaskWithSubtasks>) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Serialize plan acceptance and budget edits against the same task row.
        await tx.$queryRaw`SELECT "id" FROM "Task" WHERE "id" = ${id}::uuid FOR UPDATE`;
        const task = await tx.task.findUnique({ where: { id }, include: withSubtasks });
        if (!task) throw new NotFoundException('Task not found.');
        return withProgress(await change(tx, task));
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
