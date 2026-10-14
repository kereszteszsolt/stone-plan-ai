# Story and AI-assisted workflow

## One release, one story at a time

`docs/releases/release-0.1-mvp/README.md` is the only committed release map. Work on the lowest-numbered unimplemented **MVP** story (`TFA-001`–`TFA-004`) whose dependencies are complete. [TFA-005](stories/TFA-005-openrouter-provider-integration.md) is an optional standalone post-MVP story; it requires completed TFA-004 and separate approval. Do not create Release 0.2 merely to house TFA-005.

Each story has: `Status`, `User story`, `Goal`, `Dependencies`, `Acceptance criteria`, and `Out of scope`. Valid states are `Planned`, `In progress`, and `Implemented`.

## Small delivery loop

1. Read `AGENTS.md` and one active story. State its scope, expected files, and focused checks in a few lines.
2. Request approval to implement the story; do not demand two approvals for a trivial plan and its implementation.
3. Implement only that story, in acceptance-criteria order. Keep one writer and no parallel agents by default.
4. Run the smallest useful tests, then a broader check if behavior crosses boundaries.
5. Update the story and the relevant verification record only with evidence that actually exists. For optional TFA-005, keep detailed results in the story’s Verification evidence section and update only its separate post-MVP status row in the Release 0.1 `verification.md`; this row does not affect Release 0.1 completion.
6. Propose a short commit message. Commit only after explicit approval; push and the next story require separate approval.

For a risky schema change, security change, migration, or cross-application redesign, first obtain explicit approval for a short plan. Avoid duplicate design documents and redundant review passes.

## Evidence and status

Keep test commands and outcomes in `verification.md`. No guessed test counts, screenshot claims, deployment links, or status badges. A criterion remains unchecked until verified. Release 0.1 is not complete until all its stories are `Implemented` and the single end-to-end manual smoke flow passes.

## Boundaries

An unapproved future improvement stays a note in `docs/future.md`. Only the expressly requested optional TFA-005 has a standalone story and acceptance criteria; it has no new release number, agent, or skeleton implementation. No other speculative work is allowed.
