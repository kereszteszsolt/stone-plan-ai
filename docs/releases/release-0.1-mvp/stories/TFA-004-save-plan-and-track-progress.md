# TFA-004: Save a plan and track progress

## Status

Implemented

## User story

As a user, I want to save my plan and mark steps done.

## Goal

Finish one small end-to-end task flow with durable progress.

## Dependencies

`TFA-003`.

## Acceptance criteria

- [x] A user must explicitly confirm the edited plan before it is saved.
- [x] `POST /api/tasks/:id/plan` validates the submitted subtasks and recomputes their daily placement.
- [x] Prisma saves the subtasks atomically and rejects a second saved plan for the same task.
- [x] `PATCH /api/subtasks/:id` updates completion and `GET /api/tasks/:id` returns persisted progress.
- [x] Angular displays the saved daily plan, allows completion toggles, and shows computed percent done.
- [x] Reloading the page and restarting the Compose stack without deleting its database volume preserve tasks, accepted subtasks, and completion state.
- [x] Focused tests and a manual Docker-launched create → generate → edit → save → complete → reload smoke test pass.
- [x] README setup steps and release verification are updated only with observed results; document what to do when host Ollama is not running.

## Verification evidence

See the [Release 0.1 verification record](../verification.md#tfa-004-evidence--2026-10-14). Both production builds, 115 backend tests and 33 Angular tests passed. Real PostgreSQL checks covered concurrent plan saves, simultaneous budget edits, completion set/unset and cascade cleanup. The live browser driver performed the complete Docker UI flow with the selected `qwen3.5:9b` model: generation, edited acceptance, completion, reload and full Compose stop/start preserved 4 accepted steps and 25% progress. Desktop/light and mobile/dark screenshots were visually reviewed. The first real-model call timed out at 60 seconds; using the supported 120-second local API timeout passed without replacing the selected model. No dependency, schema migration or optional provider was added.

## Out of scope

No plan regeneration after save, calendar, reminders, accounts, collaboration, or release 0.2 planning.
