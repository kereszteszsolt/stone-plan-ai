---
name: mvp-delivery
description: Implement and verify one approved Task Flow AI story; keep post-MVP OpenRouter TFA-005 separate from Release 0.1.
---

# Minimal MVP delivery

Read `AGENTS.md` and **one** active `TFA-*` story. Read `docs/architecture.md` only for a data flow or API contract change. TFA-005 is optional and must not begin before TFA-004 is verified and the user approves it.

1. State the active story, touched areas, and focused checks briefly.
2. Ensure the user approved this story before editing implementation code.
3. Use direct NestJS services and one Angular API boundary; avoid empty layers and unused dependencies.
4. Keep the local Ollama call small; validate all outputs before planning or persistence. In TFA-005 only, add one small OpenRouter alternative with explicit provider choice and no implicit fallback.
5. Run focused tests. Expand to a broader smoke path only when the change crosses the boundary.
6. Update actual verification evidence and propose one commit. Do not commit or push without explicit permission.

Use **one writer**; do not auto-spawn agents, duplicate a running test suite, or generate acceptance criteria for unapproved ideas in `docs/future.md`.
