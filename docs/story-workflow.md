# Story and AI-assisted workflow

## Releases and story order

Release 0.1 (`TFA-001`–`TFA-004`) is implemented and locally verified. [Release 0.2](releases/release-0.2-ai-provider-observability/README.md) is also implemented with mocked/local checks: [TFA-005](releases/release-0.2-ai-provider-observability/stories/TFA-005-openrouter-provider-integration.md) adds OpenRouter and [TFA-006](releases/release-0.2-ai-provider-observability/stories/TFA-006-basic-llm-observability.md) adds safe provider/latency logs. See the release verification for live-provider limits and commit approvals. [Release 0.3](releases/release-0.3-langfuse-observability/README.md) implements the TFA-008 opt-in Langfuse trace adapter with local mock evidence plus the separately approved self-hosted Docker extension; a real hosted dashboard check remains **Not run**. Start any new story only with clear user approval; do not reopen completed releases or pre-implement later ideas.

Each story uses `Status`, `User story`, `Goal`, `Dependencies`, `Acceptance criteria`, and `Out of scope`. Valid states are `Planned`, `In progress`, and `Implemented`. Keep plans separate from shipped functionality.

[TFA-007](releases/release-0.2-ai-provider-observability/stories/TFA-007-thirty-day-plans.md) is a separately requested Release 0.2 follow-up for 30-day horizons, task-aware step counts and balanced daily scheduling. It was explicitly approved and implemented with local verification on 2026-10-16; the user separately approved committing it on the same date. See its story and verification for mocked generation versus real database/browser evidence.

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

Release 0.2 is complete with three implemented stories and evidence. Release 0.3 records TFA-008 tests, default-Ollama regression checks and verification limits in its own verification file. A real hosted Langfuse smoke test needs separate endpoint/data-sharing approval and may remain **Not run**.

## Boundaries

The six ideas in [future.md](future.md) have no stories, release, or acceptance criteria. Do not plan or implement them without a new request. TFA-008 originally used an existing external endpoint only. On 2026-10-17 the user approved self-hosting and finally chose to keep Langfuse inside the application project for simpler operation. Use the project-owned `infra/compose.langfuse.yaml` overlay and one root `.env`, with `sh infra/langfuse.sh up` managing the combined stack. This supersedes the intermediate shared sibling deployment. The default app still has three services. This approval does not authorize unrelated backend services, app database changes or new agents.
