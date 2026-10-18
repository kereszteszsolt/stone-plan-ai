# Codex roles and skills

StonePlan AI intentionally has **one optional Codex agent**: `implementation_worker`, a single write-owning implementation delegate. Normally the main session does the work directly. There is no default architect/reviewer chain or parallel agent execution.

Load repository skills only for matching technology changes:

| Skill | Apply when |
| --- | --- |
| `nestjs-angular` | NestJS/Angular REST contract, Prisma, Nginx or Compose changes |
| `llm-provider-integration` | Ollama/OpenRouter configuration, JSON/Zod model output, safe call diagnostics |

Start with `AGENTS.md`, `docs/story-workflow.md` and one approved story. Use one writer, focused tests, real verification records and distinct implementation/commit approvals. Do not run duplicate reviews or test suites just to use an agent.
