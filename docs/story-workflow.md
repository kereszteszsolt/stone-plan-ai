# Story and AI-assisted workflow

## Releases and story order

Release 0.1 (`TFA-001`–`TFA-004`) is implemented and locally verified. [Release 0.2](releases/release-0.2-ai-provider-observability/README.md) is also implemented with mocked/local checks: [TFA-005](releases/release-0.2-ai-provider-observability/stories/TFA-005-openrouter-provider-integration.md) adds OpenRouter and [TFA-006](releases/release-0.2-ai-provider-observability/stories/TFA-006-basic-llm-observability.md) adds safe provider/latency logs. See the release verification for live-provider limits and commit approvals. Start any new story only with clear user approval; do not reopen Release 0.1 or pre-implement later ideas.

Each story uses `Status`, `User story`, `Goal`, `Dependencies`, `Acceptance criteria`, and `Out of scope`. Valid states are `Planned`, `In progress`, and `Implemented`. Keep plans separate from shipped functionality.

## Small delivery loop

1. Read `AGENTS.md`, the active release map, and only one active story; state the likely files and focused checks briefly.
2. Ask for approval to implement that story, then follow its acceptance criteria in order.
3. Use one writer and minimal code changes; do not spawn parallel agents for the same work.
4. Run focused tests and relevant Docker or real-provider smoke checks only when permitted.
5. Record exact commands and outcomes in the **active release** `verification.md`; leave earlier completed release evidence intact.
6. Propose one short commit message; commit, push, or start another story only after the matching approval.

For a risky schema, security, migration, or cross-app redesign, get approval for a small plan first. Do not write duplicate designs or run redundant test passes.

## Evidence and status

Do not invent test counts, screenshots, cost totals, secrets, hosted availability, or results. Criteria stay unchecked until verified. A real OpenRouter call can cost money and requires explicit credentials and approval; record **not run** otherwise. TFA-006 diagnostics must not log user task text, prompts, raw model replies, or API keys.

Release 0.2 is complete only after both stories are implemented with focused checks, the unchanged default-Ollama Compose workflow still works, and the release verification record reflects reality.

## Boundaries

The six ideas in [future.md](future.md) have no stories, release, or acceptance criteria. Do not plan or implement them without a new request. Do not add a hosted observability stack, extra agent, database schema, or new Compose service to the small Release 0.2 changes.
