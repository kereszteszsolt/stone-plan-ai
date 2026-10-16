# TFA-007: Make plans use a horizon of up to 30 days

## Status

Implemented — explicitly requested and locally verified on 2026-10-16 with mocked provider tests, production builds, real Docker/PostgreSQL acceptance checks and a rendered browser flow using fixture generation. Real model generation was not run. The user separately approved committing these changes on 2026-10-16.

## User story

As a user, I want to plan a goal for up to 30 days, with enough practical steps and a daily schedule that uses that horizon and respects my daily time budget.

## Goal

Replace the fixed 14-day / 3–8-step limits with bounded, task-aware generation and scheduling. Extend Release 0.2 as an explicitly requested follow-up; do not create another release.

## Dependencies

TFA-005 and TFA-006 are implemented. The separately approved OpenRouter output-budget fix is committed before this story. Preserve its configured output ceiling and safe truncation handling.

## Acceptance criteria

- [x] Task creation and editing accept whole-number days from 1 to 30 in Angular and the API; 0, 31, fractions and strings remain invalid. Saved-plan time budgets stay locked.
- [x] Both providers use the same task-aware prompt and JSON schema: `minSteps = max(3, days)`, `maxSteps = max(8, 2 * days)`, at most 60 steps. For example, 1–3 days allow 3–8 steps, 14 days allow 14–28, and 30 days allow 30–60.
- [x] The prompt includes the day count, daily minutes and total budget; asks for meaningful progressive sessions across that horizon; and forbids filler, model-assigned days and estimates above the daily limit. Server validation enforces the task-specific bounds on provider responses and accepted plans.
- [x] Preview and acceptance use the same deterministic scheduler: preserve step order, keep each step on one day, use every available day when enough steps exist, and balance daily work without exceeding daily capacity. Reject an impossible ordered plan rather than dropping or reordering steps.
- [x] The save endpoint applies task-aware validation inside the existing task lock/transaction, using the current stored budget. Existing saved plans, progress, explicit preview/confirmation and concurrency protection remain intact; no database migration is needed.
- [x] Local Ollama's bounded output budget grows with the possible step count (1024–7680 tokens). OpenRouter retains its explicitly configured ceiling, timeout, size cap, one-call policy and truncation error; no automatic paid retry, fallback or token-cap increase is added.
- [x] UI guidance explains the horizon and schedule; preview editing, acceptance and saved daily rendering support a 30-day / 60-step plan.
- [x] Focused tests cover day boundaries, prompt/schema/provider parity, 30-day scheduling and acceptance, budget/count rejection, current-budget validation, and Angular rendering. Record actual checks and any unrun real-provider/browser checks in the release verification.

## Likely files and checks

API task input, plan schema/prompt, provider adapters, scheduler and task service; Angular task form/preview; related API/Angular tests, smoke fixtures and current README/architecture/workflow/release documentation. Run API tests/type checking and Angular tests/production build. Docker and real-model checks require their existing approvals; a live cloud call is not part of this implementation approval.

## Verification evidence

See the [Release 0.2 verification](../verification.md#tfa-007-thirty-day-horizons-and-balanced-plans-2026-10-16): initial 250/250 API tests, final 149/149 scheduler/preview/save/diagnostics regressions after a balancing refinement, 51/51 Angular tests, API type checking and both native/production Docker builds passed. Live PostgreSQL acceptance/concurrency checks and the Windows Chrome 30-day create → fixture preview → real save → completion → reload flow passed, including responsive rendering. No billable model call was made, so live 30-day model quality remains unverified. The user separately approved commit `feat: implement TFA-007 thirty-day planning` on 2026-10-16; push was not requested.

## Out of scope

No calendar dates, task dependencies, automatic retries, cloud fallback, model change, API-key changes, new dependency/service, schema migration, new release, or rewriting Release 0.1 evidence. Previously saved schedules are not redistributed.
