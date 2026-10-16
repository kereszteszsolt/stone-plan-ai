// SPDX-FileCopyrightText: 2026 Keresztes Zsolt <https://kereszteszsolt.hu>
// SPDX-License-Identifier: Apache-2.0

import { planJsonSchema, planProposalForDays, planStepBounds } from '../src/plan/plan-schema';
import { planMessages } from '../src/plan/plan-prompt';
import { schedulePlan } from '../src/plan/schedule-plan';

function proposal(estimates: number[]) {
  return estimates.map((estimatedMinutes, index) => ({ title: `Step ${index + 1}`, estimatedMinutes }));
}

describe('Task-aware plan horizon', () => {
  it.each([[1, 3, 8], [3, 3, 8], [4, 4, 8], [14, 14, 28], [30, 30, 60]])(
    'uses matching prompt, JSON schema and parser bounds for %i days', (days, min, max) => {
      expect(planStepBounds(days)).toEqual({ min, max });
      expect(planJsonSchema(days, 45)).toMatchObject({ properties: { subtasks: { minItems: min, maxItems: max } } });
      const parser = planProposalForDays(days);
      for (const count of [min, max]) expect(parser.safeParse({ subtasks: proposal(Array(count).fill(1)) }).success).toBe(true);
      for (const count of [min - 1, max + 1]) expect(parser.safeParse({ subtasks: proposal(Array(count).fill(1)) }).success).toBe(false);
      const messages = planMessages({ title: 'A goal', description: null, days, minutesPerDay: 45 });
      expect(messages[0].content).toContain(`${min}–${max}`);
      expect(messages[0].content).toContain(`across all ${days} days`);
      expect(JSON.parse(messages[1].content)).toMatchObject({ days, minutesPerDay: 45, totalMinutes: days * 45 });
    },
  );

  it('spreads 30 short sessions across all 30 days without padding their estimates', () => {
    const steps = proposal(Array(30).fill(5));
    const scheduled = schedulePlan(steps, 30, 30);
    expect(scheduled.map((step) => step.day)).toEqual(Array.from({ length: 30 }, (_, index) => index + 1));
    expect(scheduled.map(({ title, estimatedMinutes }) => ({ title, estimatedMinutes }))).toEqual(steps);
  });

  it('uses every day when the balanced greedy grouping would otherwise leave an empty day', () => {
    const scheduled = schedulePlan(proposal([10, 10, 10, 10, 10]), 4, 30);
    expect(scheduled.map((step) => step.day)).toEqual([1, 1, 2, 3, 4]);
  });

  it('balances uneven estimates instead of filling the earliest days', () => {
    const scheduled = schedulePlan(proposal([5, 5, 5, 5, 5, 5]), 3, 30);
    expect(scheduled.map((step) => step.day)).toEqual([1, 1, 2, 2, 3, 3]);
  });

  it('avoids front-loading a month when one edited step is longer', () => {
    const estimates = Array(60).fill(10);
    estimates[59] = 20;
    const loads = Array(30).fill(0);
    for (const step of schedulePlan(proposal(estimates), 30, 30)) loads[step.day - 1] += step.estimatedMinutes;
    expect(loads.filter((load) => load === 20)).toHaveLength(29);
    expect(loads.filter((load) => load === 30)).toHaveLength(1);
  });

  it('keeps the same result on repeated calls without mutating the input', () => {
    const steps = proposal([10, 20, 15, 15, 10, 20]);
    const original = structuredClone(steps);
    expect(schedulePlan(steps, 3, 30)).toEqual(schedulePlan(steps, 3, 30));
    expect(steps).toEqual(original);
  });

  it('matches exhaustive ordered partitions for feasibility, the busiest day and variance', () => {
    // An independent small exhaustive oracle catches gaps in balancing and capacity checks.
    for (let sample = 0; sample < 243; sample++) {
      let value = sample;
      const estimates = Array.from({ length: 5 }, () => { const estimate = [5, 10, 20][value % 3]; value = Math.floor(value / 3); return estimate; });
      for (let days = 1; days <= 4; days++) {
        let optimum = Infinity;
        let optimumSquares = Infinity;
        for (let cuts = 0; cuts < 16; cuts++) {
          const loads = [estimates[0]];
          for (let index = 1; index < estimates.length; index++) {
            if (cuts & (1 << (index - 1))) loads.push(0);
            loads[loads.length - 1] += estimates[index];
          }
          if (loads.length !== days) continue;
          const peak = Math.max(...loads);
          const squares = loads.reduce((sum, load) => sum + load * load, 0);
          if (peak < optimum) { optimum = peak; optimumSquares = squares; }
          else if (peak === optimum) optimumSquares = Math.min(optimumSquares, squares);
        }
        const steps = proposal(estimates);
        if (optimum > 30) {
          expect(() => schedulePlan(steps, days, 30)).toThrow();
          continue;
        }
        const scheduled = schedulePlan(steps, days, 30);
        const loads = Array(days).fill(0);
        for (const step of scheduled) loads[step.day - 1] += step.estimatedMinutes;
        expect(loads.every((load) => load > 0 && load <= 30)).toBe(true);
        expect(Math.max(...loads)).toBe(optimum);
        expect(loads.reduce((sum, load) => sum + load * load, 0)).toBe(optimumSquares);
        expect(scheduled.map((step) => step.day)).toEqual(scheduled.map((step) => step.day).sort((a, b) => a - b));
        expect(scheduled.map(({ title, estimatedMinutes }) => ({ title, estimatedMinutes }))).toEqual(steps);
      }
    }
  });
});
