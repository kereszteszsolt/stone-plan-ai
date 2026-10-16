// SPDX-FileCopyrightText: 2026 Keresztes Zsolt <https://kereszteszsolt.hu>
// SPDX-License-Identifier: Apache-2.0

import { UnprocessableEntityException } from '@nestjs/common';
import type { ProposedSubtask, ScheduledSubtask } from './plan-schema';

export function schedulePlan(subtasks: ProposedSubtask[], days: number, minutesPerDay: number): ScheduledSubtask[] {
  if (!subtasks.length) return [];
  let lower = Math.max(...subtasks.map((step) => step.estimatedMinutes));
  let upper = minutesPerDay;
  if (lower > upper) {
    throw new UnprocessableEntityException({
      code: 'PLAN_EXCEEDS_BUDGET',
      message: 'A proposed step takes longer than your daily limit. Try again or increase your daily minutes.',
    });
  }
  const targetDays = Math.min(days, subtasks.length);
  const daysNeeded = (capacity: number) => {
    let count = 1;
    let used = 0;
    for (const step of subtasks) {
      if (used + step.estimatedMinutes > capacity) { count++; used = 0; }
      used += step.estimatedMinutes;
    }
    return count;
  };
  if (daysNeeded(upper) > targetDays) {
    throw new UnprocessableEntityException({
      code: 'PLAN_EXCEEDS_BUDGET',
      message: 'The proposed steps do not fit your days and daily minutes in order. Try again or increase your time budget.',
    });
  }
  // Minimize the busiest day's load while preserving contiguous, ordered steps.
  while (lower < upper) {
    const middle = Math.floor((lower + upper) / 2);
    if (daysNeeded(middle) <= targetDays) upper = middle;
    else lower = middle + 1;
  }
  // With at most 60 steps, minimize variance too; a greedy cut would front-load equal small steps.
  const costs: number[][] = Array.from({ length: targetDays + 1 }, () => Array(subtasks.length + 1).fill(Infinity));
  const splits: number[][] = Array.from({ length: targetDays + 1 }, () => Array(subtasks.length + 1).fill(0));
  costs[0][0] = 0;
  for (let day = 1; day <= targetDays; day++) {
    for (let end = day; end <= subtasks.length; end++) {
      let load = 0;
      for (let start = end - 1; start >= day - 1; start--) {
        load += subtasks[start].estimatedMinutes;
        if (load > lower) break;
        const cost = costs[day - 1][start] + load * load;
        if (cost < costs[day][end]) {
          costs[day][end] = cost;
          splits[day][end] = start;
        }
      }
    }
  }
  const assignedDays: number[] = Array(subtasks.length);
  let end = subtasks.length;
  for (let day = targetDays; day >= 1; day--) {
    const start = splits[day][end];
    for (let index = start; index < end; index++) assignedDays[index] = day;
    end = start;
  }
  return subtasks.map((subtask, order) => ({ ...subtask, day: assignedDays[order], order }));
}
