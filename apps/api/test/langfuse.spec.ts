// SPDX-FileCopyrightText: 2026 Keresztes Zsolt <https://kereszteszsolt.hu>
// SPDX-License-Identifier: Apache-2.0

import { Logger, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { LangfuseSpanProcessor } from '@langfuse/otel';
import { BasicTracerProvider, type ReadableSpan } from '@opentelemetry/sdk-trace-base';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.config';
import { PrismaService } from '../src/prisma.service';
import { type AiProvider } from '../src/plan/ai-call-diagnostics';

const mockSpans: ReadableSpan[] = [];
const mockExport = jest.fn();
const mockShutdown = jest.fn();

// Exercise real Langfuse observations, filtering and batching with only the transport replaced.
jest.mock('@langfuse/otel', () => {
  const actual = jest.requireActual('@langfuse/otel');
  return { ...actual, LangfuseSpanProcessor: jest.fn().mockImplementation((options) => new actual.LangfuseSpanProcessor({
    ...options,
    exporter: { export: mockExport, shutdown: mockShutdown },
  })) };
});

const id = '4206c355-753b-44ab-852b-818e538ff1cb';
const task = { id, title: 'PRIVATE_TASK', description: 'PRIVATE_DESCRIPTION', days: 2, minutesPerDay: 30, subtasks: [] };
const steps = [10, 20, 30].map((estimatedMinutes) => ({ title: 'PRIVATE_STEP', estimatedMinutes }));
const path = `/api/tasks/${id}/plan-preview`;
const keys = ['AI_PROVIDER', 'OLLAMA_BASE_URL', 'OLLAMA_MODEL', 'OLLAMA_TIMEOUT_MS',
  'OPENROUTER_API_KEY', 'OPENROUTER_MODEL', 'OPENROUTER_BASE_URL', 'OPENROUTER_TIMEOUT_MS',
  'LANGFUSE_ENABLED', 'LANGFUSE_PUBLIC_KEY', 'LANGFUSE_SECRET_KEY', 'LANGFUSE_BASE_URL',
  'LANGFUSE_LOG_LEVEL', 'LANGFUSE_DEBUG', 'LANGFUSE_TRACING_ENVIRONMENT', 'LANGFUSE_RELEASE'] as const;
const originalEnvironment = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

function reply(provider: AiProvider, usage = true, content = JSON.stringify({ subtasks: steps })): Response {
  return new Response(JSON.stringify(provider === 'ollama'
    ? { done: true, message: { content }, ...(usage ? { prompt_eval_count: 12, eval_count: 0 } : {}) }
    : { choices: [{ finish_reason: 'stop', message: { role: 'assistant', content } }],
      ...(usage ? { usage: { prompt_tokens: 12, completion_tokens: 0, total_tokens: 12 } } : {}) }));
}

describe('Optional metadata-only Langfuse tracing', () => {
  let app: INestApplication | undefined;
  let log: jest.SpyInstance;
  let warn: jest.SpyInstance;
  let consoleLog: jest.SpyInstance;
  let consoleWarn: jest.SpyInstance;
  let consoleError: jest.SpyInstance;
  const database = { task: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() }, subtask: { create: jest.fn() } };

  beforeEach(() => {
    for (const key of keys) delete process.env[key];
    Object.assign(process.env, {
      OLLAMA_BASE_URL: 'http://ollama.test:11434', OLLAMA_MODEL: 'fixture:small', OLLAMA_TIMEOUT_MS: '1000',
      OPENROUTER_BASE_URL: 'https://openrouter.test/api/v1', OPENROUTER_MODEL: 'fixture/small',
      OPENROUTER_API_KEY: 'sk-or-PRIVATE_KEY', OPENROUTER_TIMEOUT_MS: '1000',
      LANGFUSE_ENABLED: 'true', LANGFUSE_PUBLIC_KEY: 'pk-lf-PRIVATE_PUBLIC', LANGFUSE_SECRET_KEY: 'sk-lf-PRIVATE_SECRET',
      LANGFUSE_BASE_URL: 'https://langfuse.test', LANGFUSE_LOG_LEVEL: 'DEBUG', LANGFUSE_DEBUG: 'true',
      LANGFUSE_TRACING_ENVIRONMENT: 'PRIVATE_ENVIRONMENT', LANGFUSE_RELEASE: 'PRIVATE_RELEASE',
    });
    mockSpans.length = 0;
    mockExport.mockReset().mockImplementation((spans, callback) => { mockSpans.push(...spans); callback({ code: 0 }); });
    mockShutdown.mockReset().mockResolvedValue(undefined);
    jest.mocked(LangfuseSpanProcessor).mockClear();
    database.task.findUnique.mockResolvedValue(task);
    log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    consoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(reply('ollama'));
  });

  async function start() {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService).useValue(database).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    log.mockClear();
    return app;
  }

  async function close() {
    await app?.close();
    app = undefined;
  }

  afterEach(async () => {
    await close();
    const serialized = JSON.stringify({
      spans: mockSpans.map((span) => ({ name: span.name, attributes: span.attributes, events: span.events,
        links: span.links, status: span.status, resource: span.resource.attributes })),
      logs: [log.mock.calls, warn.mock.calls, consoleLog.mock.calls, consoleWarn.mock.calls, consoleError.mock.calls],
    });
    expect(serialized).not.toMatch(/PRIVATE_|Split the goal|Bearer |authorization|prompt|description/i);
    expect(database.task.create).not.toHaveBeenCalled();
    expect(database.task.update).not.toHaveBeenCalled();
    expect(database.subtask.create).not.toHaveBeenCalled();
    jest.restoreAllMocks();
    for (const key of keys) {
      if (originalEnvironment[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnvironment[key];
    }
  });

  function metadata(span = mockSpans[0]) {
    return Object.fromEntries(Object.entries(span.attributes)
      .filter(([key]) => key.startsWith('langfuse.observation.metadata.'))
      .map(([key, value]) => [key.replace('langfuse.observation.metadata.', ''), JSON.parse(String(value))]));
  }

  it.each([undefined, 'false'])('never initializes an exporter when LANGFUSE_ENABLED=%p, even with keys set', async (enabled) => {
    if (enabled === undefined) delete process.env['LANGFUSE_ENABLED'];
    else process.env['LANGFUSE_ENABLED'] = enabled;
    const server = await start();
    await request(server.getHttpServer()).get('/api/health').expect(200, { status: 'ok' });
    await request(server.getHttpServer()).post(path).expect(200);
    await close();
    expect(LangfuseSpanProcessor).not.toHaveBeenCalled();
    expect(mockExport).not.toHaveBeenCalled();
    expect(mockShutdown).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('starts with no Langfuse settings and keeps the default Ollama preview and task reads usable', async () => {
    for (const key of keys.filter((key) => key.startsWith('LANGFUSE_'))) delete process.env[key];
    const server = await start();
    await request(server.getHttpServer()).get('/api/health').expect(200, { status: 'ok' });
    await request(server.getHttpServer()).get(`/api/tasks/${id}`).expect(200);
    await request(server.getHttpServer()).post(path).expect(200);
    expect(LangfuseSpanProcessor).not.toHaveBeenCalled();
    expect(mockExport).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['LANGFUSE_ENABLED', 'yes'], ['LANGFUSE_PUBLIC_KEY', ''], ['LANGFUSE_SECRET_KEY', 'PRIVATE_BAD_KEY'],
    ['LANGFUSE_BASE_URL', ''], ['LANGFUSE_BASE_URL', 'not-a-url'], ['LANGFUSE_BASE_URL', 'ftp://langfuse.test'],
    ['LANGFUSE_BASE_URL', 'https://user:PRIVATE_PASSWORD@langfuse.test'],
    ['LANGFUSE_BASE_URL', 'https://langfuse.test/?token=PRIVATE_QUERY'],
    ['LANGFUSE_BASE_URL', 'https://langfuse.test/#PRIVATE_FRAGMENT'],
  ])('safely disables invalid %s without affecting health, CRUD or preview', async (key, value) => {
    process.env[key] = value;
    const server = await start();
    await request(server.getHttpServer()).get('/api/health').expect(200);
    await request(server.getHttpServer()).get(`/api/tasks/${id}`).expect(200);
    await request(server.getHttpServer()).post(path).expect(200);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('LANGFUSE_INVALID_CONFIGURATION');
    expect(LangfuseSpanProcessor).not.toHaveBeenCalled();
    expect(mockExport).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  describe.each<AiProvider>(['ollama', 'openrouter'])('%s', (provider) => {
    beforeEach(() => { process.env['AI_PROVIDER'] = provider; });

    it('exports exactly one real SDK generation with safe correlation, timing and reported zero tokens on shutdown', async () => {
      jest.mocked(fetch).mockResolvedValue(reply(provider));
      const server = await start();
      const response = await request(server.getHttpServer()).post(path)
        .set('X-Request-ID', 'PRIVATE_CALLER_ID').set('Authorization', 'Bearer PRIVATE_HEADER').expect(200);
      expect(response.body).toEqual({ subtasks: steps.map((step, order) => ({ ...step, order, day: order < 2 ? 1 : 2 })) });
      expect(mockExport).not.toHaveBeenCalled();
      const call = JSON.parse(log.mock.calls[0][0]);
      expect(log).toHaveBeenCalledTimes(1);
      expect(call.event).toBe('ai_plan_call');
      expect(call.requestId).toBe(response.headers['x-request-id']);
      await close();
      expect(mockSpans).toHaveLength(1);
      const span = mockSpans[0];
      expect(span.name).toBe('ai-plan-generation');
      expect(span.spanContext().traceId).toMatch(/^[a-f0-9]{32}$/);
      expect(span.parentSpanContext).toBeUndefined();
      expect(span.attributes['langfuse.observation.type']).toBe('generation');
      expect(span.attributes['langfuse.observation.model.name']).toBe(provider === 'ollama' ? 'fixture:small' : 'fixture/small');
      expect(metadata()).toEqual({ requestId: call.requestId, provider, durationMs: call.durationMs,
        outcome: 'success', usageStatus: 'reported' });
      expect(span.duration[0] * 1000 + span.duration[1] / 1e6).toBeCloseTo(call.durationMs, 0);
      expect(JSON.parse(String(span.attributes['langfuse.observation.usage_details']))).toEqual(
        provider === 'ollama' ? { input: 12, output: 0 } : { input: 12, output: 0, total: 12 });
      expect(mockShutdown).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(LangfuseSpanProcessor).toHaveBeenCalledWith(expect.objectContaining({ baseUrl: 'https://langfuse.test', timeout: 2, mediaUploadEnabled: false }));
    });

    it('marks missing usage unknown without inventing zeroes or totals', async () => {
      jest.mocked(fetch).mockResolvedValue(reply(provider, false));
      const server = await start();
      await request(server.getHttpServer()).post(path).expect(200);
      await close();
      expect(metadata().usageStatus).toBe('unknown');
      expect(mockSpans[0].attributes).not.toHaveProperty('langfuse.observation.usage_details');
    });

    it.each(['unavailable', 'timeout', 'invalid-output', 'budget'])('preserves the API error for %s and emits only its safe category', async (failure) => {
      let category: string;
      let status: number;
      if (failure === 'unavailable' || failure === 'timeout') {
        category = `${provider.toUpperCase()}_${failure === 'timeout' ? 'TIMEOUT' : 'UNAVAILABLE'}`;
        status = failure === 'timeout' ? 504 : 503;
        jest.mocked(fetch).mockRejectedValue(failure === 'timeout'
          ? Object.assign(new Error('PRIVATE_TIMEOUT_BODY'), { name: 'TimeoutError' }) : new Error('PRIVATE_PROVIDER_ERROR'));
      } else {
        category = failure === 'budget' ? 'PLAN_EXCEEDS_BUDGET' : 'INVALID_AI_OUTPUT';
        status = failure === 'budget' ? 422 : 502;
        const content = failure === 'budget' ? JSON.stringify({ subtasks: steps.map((step) => ({ ...step, estimatedMinutes: 30 })) }) : 'PRIVATE_RAW_MODEL_REPLY';
        jest.mocked(fetch).mockResolvedValue(reply(provider, true, content));
      }
      const server = await start();
      const response = await request(server.getHttpServer()).post(path).expect(status);
      expect(response.body.code).toBe(category);
      await close();
      expect(mockSpans).toHaveLength(1);
      expect(metadata()).toMatchObject({ outcome: 'failure', errorCategory: category });
      expect(mockSpans[0].attributes['langfuse.observation.status_message']).toBe(category);
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(log).toHaveBeenCalledTimes(1);
    });
  });

  it.each(['LANGFUSE_SECRET_KEY', 'LANGFUSE_PUBLIC_KEY', 'OPENROUTER_API_KEY'])('redacts %s accidentally configured as a model in both local logs and spans', async (key) => {
    process.env['OLLAMA_MODEL'] = `fixture/${process.env[key]}`;
    const server = await start();
    await request(server.getHttpServer()).post(path).expect(200);
    await close();
    expect(JSON.parse(log.mock.calls[0][0]).model).toBe('unknown');
    expect(mockSpans[0].attributes['langfuse.observation.model.name']).toBe('unknown');
  });

  it('returns the plan before a failed, deferred telemetry export and flushes safely during Nest shutdown', async () => {
    let finishExport: ((result: { code: number; error?: Error }) => void) | undefined;
    mockExport.mockImplementation((_spans, callback) => { finishExport = callback; });
    const server = await start();
    await request(server.getHttpServer()).post(path).expect(200);
    expect(fetch).toHaveBeenCalledTimes(1);
    const closing = close();
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(finishExport).toBeDefined();
    finishExport!({ code: 1, error: new Error('PRIVATE_UNREACHABLE_ENDPOINT_RESPONSE') });
    await closing;
    expect(warn.mock.calls[0][0]).toContain('LANGFUSE_FLUSH_FAILED');
    expect(mockShutdown).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledTimes(1);
  });

  it('keeps concurrent calls, SDK trace IDs and token counts separate', async () => {
    let releaseFirst: (response: Response) => void;
    jest.mocked(fetch).mockImplementationOnce(() => new Promise((resolve) => { releaseFirst = resolve; }))
      .mockImplementationOnce(async () => {
        releaseFirst(new Response(JSON.stringify({ done: true, message: { content: JSON.stringify({ subtasks: steps }) }, prompt_eval_count: 8 })));
        return reply('ollama');
      });
    const server = await start();
    const responses = await Promise.all([
      request(server.getHttpServer()).post(path).expect(200), request(server.getHttpServer()).post(path).expect(200),
    ]);
    await close();
    expect(mockSpans).toHaveLength(2);
    expect(new Set(mockSpans.map((span) => span.spanContext().traceId)).size).toBe(2);
    expect(new Set(mockSpans.map((span) => metadata(span).requestId)))
      .toEqual(new Set(responses.map((response) => response.headers['x-request-id'])));
    expect(mockSpans.map((span) => JSON.parse(String(span.attributes['langfuse.observation.usage_details'])).input).sort((a, b) => a - b)).toEqual([8, 12]);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(log).toHaveBeenCalledTimes(2);
  });

  it('contains SDK initialization failure without changing the plan', async () => {
    jest.mocked(LangfuseSpanProcessor).mockImplementationOnce(() => { throw new Error('PRIVATE_SDK_FAILURE'); });
    const server = await start();
    await request(server.getHttpServer()).post(path).expect(200);
    expect(warn.mock.calls[0][0]).toContain('LANGFUSE_INITIALIZATION_FAILED');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('contains a recording exception and a shutdown rejection without exposing raw errors', async () => {
    const server = await start();
    const getTracer = jest.spyOn(BasicTracerProvider.prototype, 'getTracer').mockImplementationOnce(() => { throw new Error('PRIVATE_RECORD_FAILURE'); });
    await request(server.getHttpServer()).post(path).expect(200);
    getTracer.mockRestore();
    mockShutdown.mockRejectedValueOnce(new Error('PRIVATE_SHUTDOWN_FAILURE'));
    await close();
    expect(warn.mock.calls.map(([message]) => message)).toEqual([
      expect.stringContaining('LANGFUSE_RECORD_FAILED'), expect.stringContaining('LANGFUSE_SHUTDOWN_FAILED'),
    ]);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('does not trace health, CRUD or a rejected saved-plan request', async () => {
    database.task.findUnique.mockResolvedValue({ ...task, subtasks: [{ id: 'saved' }] });
    const server = await start();
    await request(server.getHttpServer()).get('/api/health').expect(200);
    await request(server.getHttpServer()).get(`/api/tasks/${id}`).expect(200);
    await request(server.getHttpServer()).post(path).expect(409);
    await close();
    expect(fetch).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
    expect(mockExport).not.toHaveBeenCalled();
  });
});
