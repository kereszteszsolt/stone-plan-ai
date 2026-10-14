# TFA-002: Task CRUD and Angular screen

## Status

Planned

## User story

As a user, I want to keep a list of my goals.

## Goal

Create, view, change, and delete tasks in one simple screen.

## Dependencies

`TFA-001`.

## Acceptance criteria

- [ ] NestJS exposes task list, detail, create, update, and delete endpoints under `/api/tasks`.
- [ ] Requests validate task text, day count, and daily minutes, and return clear 4xx responses for bad input.
- [ ] Prisma persists tasks and deletes their subtasks when a task is removed.
- [ ] Angular has one responsive task list, a task form, and a selected-task detail view.
- [ ] UI state uses Angular Signals and calls the NestJS API through one typed API service.
- [ ] Loading, empty, success, and error states are visible in the relevant screens.
- [ ] Focused backend and Angular tests pass, and CRUD survives a page reload.

## Out of scope

No AI, plan preview, plan persistence, authentication, or multiple users.
