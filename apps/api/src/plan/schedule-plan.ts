// SPDX-FileCopyrightText: 2026 Keresztes Zsolt <https://kereszteszsolt.hu>
// SPDX-License-Identifier: Apache-2.0

import { UnprocessableEntityException } from '@nestjs/common';
import type { ProposedSubtask, ScheduledSubtask } from './plan-schema';

export function schedulePlan(subtasks: ProposedSubtask[], days: number, minutesPerDay: number): ScheduledSubtask[] {
  let day = 1;
  let usedMinutes = 0;
  return subtasks.map((subtask, order) => {
    if (subtask.estimatedMinutes > minutesPerDay) {
      throw new UnprocessableEntityException({
        code: 'PLAN_EXCEEDS_BUDGET',
        message: 'A proposed step takes longer than your daily limit. Try again or increase your daily minutes.',
      });
    }
    if (usedMinutes + subtask.estimatedMinutes > minutesPerDay) {
      day++;
      usedMinutes = 0;
    }
    if (day > days) {
      throw new UnprocessableEntityException({
        code: 'PLAN_EXCEEDS_BUDGET',
        message: 'The proposed steps do not fit your days and daily minutes in order. Try again or increase your time budget.',
      });
    }
    usedMinutes += subtask.estimatedMinutes;
    return { ...subtask, day, order };
  });
}
