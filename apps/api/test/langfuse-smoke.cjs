// SPDX-FileCopyrightText: 2026 Keresztes Zsolt <https://kereszteszsolt.hu>
// SPDX-License-Identifier: Apache-2.0

// Run inside the combined app/Langfuse stack; no real LLM or task writes.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
const { LangfuseTracingService } = require('./dist/plan/langfuse-tracing.service');
const { PlanPreviewService } = require('./dist/plan/plan-preview.service');
const { OllamaService } = require('./dist/plan/ollama.service');
const { OpenRouterService } = require('./dist/plan/openrouter.service');

async function main() {
  const destination = new URL(process.env.LANGFUSE_BASE_URL);
  assert.equal(destination.origin, 'http://langfuse-web:3000', 'Smoke only sends to the project-owned local instance');
  assert.equal(process.env.LANGFUSE_ENABLED, 'true');
  const requestId = process.env.TFA_LANGFUSE_SMOKE_REQUEST_ID || randomUUID();
  const auth = Buffer.from(`${process.env.LANGFUSE_PUBLIC_KEY}:${process.env.LANGFUSE_SECRET_KEY}`).toString('base64');
  const realFetch = globalThis.fetch;
  let modelCalls = 0;
  if (!process.env.TFA_LANGFUSE_SMOKE_REQUEST_ID) {
    Object.assign(process.env, { AI_PROVIDER: 'ollama', OLLAMA_BASE_URL: 'http://ollama-fixture.invalid:11434', OLLAMA_MODEL: 'fixture:local' });
    globalThis.fetch = async (url, options) => {
      assert.equal(new URL(url).hostname, 'ollama-fixture.invalid');
      modelCalls++;
      return new Response(JSON.stringify({ done: true, prompt_eval_count: 12, eval_count: 7,
        message: { content: JSON.stringify({ subtasks: [10, 20, 30].map((estimatedMinutes) => ({ title: 'TFA008_PRIVATE_STEP', estimatedMinutes })) }) } }));
    };
    const tracing = new LangfuseTracingService();
    tracing.onModuleInit();
    try {
      const tasks = { get: async () => ({ id: randomUUID(), title: 'TFA008_PRIVATE_TASK', description: 'TFA008_PRIVATE_DESCRIPTION', days: 2, minutesPerDay: 30, subtasks: [] }) };
      const preview = new PlanPreviewService(tasks, new OllamaService(), new OpenRouterService(), tracing);
      const result = await preview.generate(randomUUID(), requestId);
      assert.equal(result.subtasks.length, 3);
      assert.equal(modelCalls, 1);
    } finally {
      globalThis.fetch = realFetch;
      await tracing.onModuleDestroy();
    }
  }
  let observation;
  const query = new URLSearchParams({ name: 'ai-plan-generation', limit: '100',
    fields: 'core,basic,metadata,model,usage,io',
    fromStartTime: new Date(Date.now() - 86400000).toISOString(),
    toStartTime: new Date(Date.now() + 60000).toISOString(),
  });
  for (let attempt = 0; attempt < 30; attempt++) {
    const response = await realFetch(`${destination.origin}/api/public/v2/observations?${query}`, {
      headers: { Authorization: `Basic ${auth}` }, signal: AbortSignal.timeout(5000),
    });
    assert.equal(response.status, 200, 'Local Langfuse observations API must accept the project key');
    const result = await response.json();
    observation = result.data.find((item) => item.metadata?.requestId === requestId);
    if (observation) break;
    await delay(2000);
  }
  assert.ok(observation, 'Exported observation must be persisted and queryable locally');
  assert.equal(observation.type, 'GENERATION');
  assert.equal(observation.model, 'fixture:local');
  assert.equal(observation.metadata.provider, 'ollama');
  assert.equal(observation.metadata.outcome, 'success');
  assert.equal(observation.metadata.usageStatus, 'reported');
  assert.equal(observation.usageDetails.input, 12);
  assert.equal(observation.usageDetails.output, 7);
  assert.ok(!observation.input && !observation.output);
  const serialized = JSON.stringify(observation);
  for (const excluded of ['TFA008_PRIVATE_', process.env.LANGFUSE_PUBLIC_KEY, process.env.LANGFUSE_SECRET_KEY, process.env.OPENROUTER_API_KEY].filter(Boolean)) {
    assert.ok(!serialized.includes(excluded), 'No task/prompt/reply/credential marker may be stored in observations');
  }
  console.log(JSON.stringify({ event: 'langfuse_local_smoke', requestId, traceId: observation.traceId,
    provider: observation.metadata.provider, model: observation.model, modelCalls,
    persisted: true, metadataOnly: true }));
}

main().catch((error) => {
  console.error(error instanceof assert.AssertionError ? error.message : 'Local Langfuse smoke failed; inspect local service health.');
  process.exitCode = 1;
});
