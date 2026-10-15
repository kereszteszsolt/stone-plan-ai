// SPDX-FileCopyrightText: 2026 Keresztes Zsolt <https://kereszteszsolt.hu>
// SPDX-License-Identifier: Apache-2.0

import { z } from 'zod';

export const planProposalSchema = z.strictObject({
  subtasks: z.array(z.strictObject({
    title: z.string().trim().min(1).max(160),
    estimatedMinutes: z.number().int().min(1).max(240),
  })).min(3).max(8),
});

export function planJsonSchema(minutesPerDay: number) {
  const step = planProposalSchema.shape.subtasks.element;
  return z.toJSONSchema(planProposalSchema.extend({
    subtasks: z.array(step.extend({ estimatedMinutes: step.shape.estimatedMinutes.max(minutesPerDay) })).min(3).max(8),
  }));
}
export type ProposedSubtask = z.infer<typeof planProposalSchema>['subtasks'][number];
export interface ScheduledSubtask extends ProposedSubtask {
  day: number;
  order: number;
}
