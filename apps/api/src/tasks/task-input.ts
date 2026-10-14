// SPDX-FileCopyrightText: 2026 Keresztes Zsolt <https://kereszteszsolt.hu>
// SPDX-License-Identifier: Apache-2.0

import { BadRequestException, type PipeTransform } from '@nestjs/common';
import { z } from 'zod';

export const createTaskSchema = z.strictObject({
  title: z.string().trim().min(1, 'A title is required.').max(160, 'Use at most 160 characters.'),
  description: z.string().trim().max(2000, 'Use at most 2000 characters.').nullable().optional(),
  days: z.number().int().min(1, 'Use at least 1 day.').max(14, 'Use at most 14 days.'),
  minutesPerDay: z.number().int().min(15, 'Use at least 15 minutes.').max(240, 'Use at most 240 minutes.'),
});

export const updateTaskSchema = createTaskSchema.partial().refine(
  (input) => Object.keys(input).length > 0,
  'Provide at least one task field.',
);

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

export class TaskInputPipe<Output> implements PipeTransform<unknown, Output> {
  constructor(private readonly schema: z.ZodType<Output>) {}

  transform(value: unknown): Output {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException(result.error.issues.map((issue) =>
        `${issue.path.join('.') || 'request'}: ${issue.message}`,
      ));
    }
    return result.data;
  }
}
