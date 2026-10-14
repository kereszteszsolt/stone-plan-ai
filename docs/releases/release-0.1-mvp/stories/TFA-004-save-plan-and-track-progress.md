# TFA-004: Save a plan and track progress

## Status

Planned

## User story

As a user, I want to save my plan and mark steps done.

## Goal

Finish one small end-to-end task flow with durable progress.

## Dependencies

`TFA-003`.

## Acceptance criteria

- [ ] A user must explicitly confirm the edited plan before it is saved.
- [ ] `POST /api/tasks/:id/plan` validates the submitted subtasks and recomputes their daily placement.
- [ ] Prisma saves the subtasks atomically and rejects a second saved plan for the same task.
- [ ] `PATCH /api/subtasks/:id` updates completion and `GET /api/tasks/:id` returns persisted progress.
- [ ] Angular displays the saved daily plan, allows completion toggles, and shows computed percent done.
- [ ] Reloading the page and restarting the Compose stack without deleting its database volume preserve tasks, accepted subtasks, and completion state.
- [ ] Focused tests and a manual Docker-launched create → generate → edit → save → complete → reload smoke test pass.
- [ ] README setup steps and release verification are updated only with observed results; document what to do when host Ollama is not running.

## Out of scope

No plan regeneration after save, calendar, reminders, accounts, collaboration, or release 0.2 planning.
