// SPDX-FileCopyrightText: 2026 Keresztes Zsolt <https://kereszteszsolt.hu>
// SPDX-License-Identifier: Apache-2.0

import { Logger, ServiceUnavailableException, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.config';
import { PrismaService } from '../src/prisma.service';
import { readTokenUsage, safeErrorCategory, safeModelIdentifier, type AiProvider } from '../src/plan/ai-call-diagnostics';
import { OllamaService } from '../src/plan/ollama.service';
import { PlanPreviewService } from '../src/plan/plan-preview.service';

const id = '4206c355-753b-44ab-852b-818e538ff1cb';
const task = { id, title: 'PRIVATE_TASK_TITLE', description: 'PRIVATE_DESCRIPTION\n{"event":"injected"}', days: 2, minutesPerDay: 30, subtasks: [] };
const steps = [10, 20, 30].map((estimatedMinutes) => ({ title: 'PRIVATE_STEP_TITLE', estimatedMinutes }));
const apiKey = 'sk-or-v1-PRIVATE_API_KEY';
const path = `/api/tasks/${id}/plan-preview`;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const keys = ['AI_PROVIDER', 'OLLAMA_BASE_URL', 'OLLAMA_MODEL', 'OLLAMA_TIMEOUT_MS', 'OPENROUTER_API_KEY', 'OPENROUTER_MODEL', 'OPENROUTER_BASE_URL', 'OPENROUTER_TIMEOUT_MS'] as const;
const originalEnvironment = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

function reply(provider: AiProvider, counts?: object, content = JSON.stringify({ subtasks: steps })): Response {
  return new Response(JSON.stringify(provider === 'ollama'
    ? { done: true, message: { content }, ...counts }
    : { choices: [{ finish_reason: 'stop', message: { role: 'assistant', content } }], ...counts }));
}

function counts(provider: AiProvider, input = 12, output = 7) {
  return provider === 'ollama' ? { prompt_eval_count: input, eval_count: output }
    : { usage: { prompt_tokens: input, completion_tokens: output, total_tokens: input + output } };
}

describe('Plan-call diagnostics through the existing HTTP endpoint', () => {
  let app: INestApplication;
  let log: jest.SpyInstance;
  let errorLog: jest.SpyInstance;
  let warnLog: jest.SpyInstance;
  const database = { task: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() }, subtask: { create: jest.fn() } };

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(PrismaService).useValue(database).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
  });
  beforeEach(() => {
    process.env['AI_PROVIDER'] = 'ollama';
    process.env['OLLAMA_BASE_URL'] = 'http://ollama.local:11434';
    process.env['OLLAMA_MODEL'] = 'fixture-model:small';
    process.env['OLLAMA_TIMEOUT_MS'] = '1000';
    process.env['OPENROUTER_API_KEY'] = apiKey;
    process.env['OPENROUTER_MODEL'] = 'fixture/small-model';
    process.env['OPENROUTER_BASE_URL'] = 'https://openrouter.test/api/v1';
    process.env['OPENROUTER_TIMEOUT_MS'] = '1000';
    database.task.findUnique.mockResolvedValue(task);
    log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    errorLog = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    warnLog = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Unexpected mocked model request'));
  });
  afterEach(() => {
    const recorded = JSON.stringify([log.mock.calls, errorLog.mock.calls, warnLog.mock.calls]);
    expect(recorded).not.toMatch(/PRIVATE_|Split the goal|Bearer |authorization/i);
    expect(database.task.create).not.toHaveBeenCalled();
    expect(database.task.update).not.toHaveBeenCalled();
    expect(database.subtask.create).not.toHaveBeenCalled();
    jest.restoreAllMocks();
    for (const key of keys) {
      if (originalEnvironment[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnvironment[key];
    }
  });
  afterAll(async () => { await app.close(); });

  function event(response: request.Response, provider: AiProvider, outcome: string, errorCategory: string | null = null) {
    expect(log).toHaveBeenCalledTimes(1);
    const value = JSON.parse(log.mock.calls[0][0]);
    expect(value).toMatchObject({ event: 'ai_plan_call', provider, outcome, errorCategory });
    expect(value.model).toBe(provider === 'ollama' ? 'fixture-model:small' : 'fixture/small-model');
    expect(value.requestId).toMatch(uuid);
    expect(value.requestId).toBe(response.headers['x-request-id']);
    expect(Number.isInteger(value.durationMs)).toBe(true);
    expect(value.durationMs).toBeGreaterThanOrEqual(0);
    expect(Object.keys(value).sort()).toEqual([
      'durationMs', 'errorCategory', 'event', 'model', 'outcome', 'provider', 'requestId',
      ...(value.usage ? ['usage'] : []),
    ].sort());
    return value;
  }

  describe.each<AiProvider>(['ollama', 'openrouter'])('%s', (provider) => {
    beforeEach(() => { process.env['AI_PROVIDER'] = provider; });

    it('logs one successful outcome, correlates the response, and preserves the unsaved body', async () => {
      jest.mocked(fetch).mockResolvedValue(reply(provider, counts(provider)));
      const response = await request(app.getHttpServer()).post(path).set('X-Request-ID', 'PRIVATE_CALLER_ID').set('Authorization', 'Bearer PRIVATE_HEADER_KEY').send({}).expect(200);
      expect(response.body).toEqual({ subtasks: steps.map((step, order) => ({ ...step, order, day: order < 2 ? 1 : 2 })) });
      const value = event(response, provider, 'success');
      expect(value.usage).toEqual(provider === 'ollama' ? { inputTokens: 12, outputTokens: 7 } : { inputTokens: 12, outputTokens: 7, totalTokens: 19 });
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('leaves missing usage absent instead of inventing zeroes', async () => {
      jest.mocked(fetch).mockResolvedValue(reply(provider));
      const response = await request(app.getHttpServer()).post(path).expect(200);
      expect(event(response, provider, 'success')).not.toHaveProperty('usage');
    });

    it('keeps a reported zero without computing missing counts', async () => {
      jest.mocked(fetch).mockResolvedValue(reply(provider, provider === 'ollama' ? { prompt_eval_count: 0 } : { usage: { prompt_tokens: 0, cost: 'PRIVATE_COST' } }));
      const response = await request(app.getHttpServer()).post(path).expect(200);
      expect(event(response, provider, 'success').usage).toEqual({ inputTokens: 0 });
    });

    it('ignores malformed usage without rejecting a valid plan', async () => {
      jest.mocked(fetch).mockResolvedValue(reply(provider, provider === 'ollama'
        ? { prompt_eval_count: 'PRIVATE_USAGE', eval_count: -1 }
        : { usage: { prompt_tokens: 'PRIVATE_USAGE', completion_tokens: -1, total_tokens: 1.5 } }));
      const response = await request(app.getHttpServer()).post(path).expect(200);
      expect(event(response, provider, 'success')).not.toHaveProperty('usage');
    });

    it('records a timeout category without the thrown error or a second request', async () => {
      const controller = new AbortController();
      const timeout = jest.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal);
      jest.mocked(fetch).mockImplementation((_url, options) => new Promise((_resolve, reject) => {
        options?.signal?.addEventListener('abort', () => reject(options.signal?.reason));
        controller.abort(new DOMException('PRIVATE_TIMEOUT_DETAIL', 'TimeoutError'));
      }));
      const response = await request(app.getHttpServer()).post(path).expect(504);
      expect(event(response, provider, 'failure', provider === 'ollama' ? 'OLLAMA_TIMEOUT' : 'OPENROUTER_TIMEOUT')).not.toHaveProperty('usage');
      expect(timeout).toHaveBeenCalledWith(1000);
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('records a provider outage without logging the response body or credentials', async () => {
      jest.mocked(fetch).mockResolvedValue(new Response(`PRIVATE_PROVIDER_BODY ${apiKey}`, { status: 503 }));
      const response = await request(app.getHttpServer()).post(path).expect(503);
      event(response, provider, 'failure', provider === 'ollama' ? 'OLLAMA_UNAVAILABLE' : 'OPENROUTER_UNAVAILABLE');
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('retains known token counts for a rejected model proposal without logging its text', async () => {
      jest.mocked(fetch).mockResolvedValue(reply(provider, counts(provider), 'PRIVATE_RAW_MODEL_REPLY'));
      const response = await request(app.getHttpServer()).post(path).expect(502);
      expect(event(response, provider, 'failure', 'INVALID_AI_OUTPUT').usage.inputTokens).toBe(12);
    });

    it('records budget rejection once and preserves its existing HTTP error', async () => {
      jest.mocked(fetch).mockResolvedValue(reply(provider, counts(provider), JSON.stringify({ subtasks: steps.map((step) => ({ ...step, estimatedMinutes: 30 })) })));
      const response = await request(app.getHttpServer()).post(path).expect(422);
      event(response, provider, 'failure', 'PLAN_EXCEEDS_BUDGET');
    });

    it('does not leak a key accidentally configured as the model identifier', async () => {
      process.env[provider === 'ollama' ? 'OLLAMA_MODEL' : 'OPENROUTER_MODEL'] = apiKey;
      jest.mocked(fetch).mockResolvedValue(reply(provider));
      const response = await request(app.getHttpServer()).post(path).expect(200);
      const value = JSON.parse(log.mock.calls[0][0]);
      expect(value.model).toBe('unknown');
      expect(value.requestId).toBe(response.headers['x-request-id']);
      expect(log).toHaveBeenCalledTimes(1);
    });

    it('keeps concurrent requests and their reported usage separate', async () => {
      let releaseFirst: (response: Response) => void;
      jest.mocked(fetch).mockImplementationOnce(() => new Promise((resolve) => { releaseFirst = resolve; }))
        .mockImplementationOnce(async () => { releaseFirst(reply(provider, counts(provider, 10, 5))); return reply(provider, counts(provider, 20, 8)); });
      const responses = await Promise.all([
        request(app.getHttpServer()).post(path).expect(200), request(app.getHttpServer()).post(path).expect(200),
      ]);
      expect(log).toHaveBeenCalledTimes(2);
      const values = log.mock.calls.map(([payload]) => JSON.parse(payload));
      expect(new Set(responses.map((response) => response.headers['x-request-id'])).size).toBe(2);
      expect(new Set(values.map((value) => value.requestId))).toEqual(new Set(responses.map((response) => response.headers['x-request-id'])));
      expect(values.map((value) => value.usage.inputTokens).sort()).toEqual([10, 20]);
      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });

  it.each(['bad-body', 'missing-task', 'saved-plan', 'invalid-provider'])('does not invent a provider event for %s', async (failure) => {
    if (failure === 'missing-task') database.task.findUnique.mockResolvedValue(null);
    if (failure === 'saved-plan') database.task.findUnique.mockResolvedValue({ ...task, subtasks: [{ id: 'saved' }] });
    if (failure === 'invalid-provider') process.env['AI_PROVIDER'] = 'PRIVATE_INVALID_PROVIDER';
    const status = failure === 'bad-body' ? 400 : failure === 'missing-task' ? 404 : failure === 'saved-plan' ? 409 : 503;
    await request(app.getHttpServer()).post(path).send(failure === 'bad-body' ? { title: 'PRIVATE_CALLER_TEXT' } : {}).expect(status);
    expect(log).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('uses a fixed category for an unexpected error and rethrows the original failure', async () => {
    const failure = new Error('PRIVATE_UNEXPECTED_FAILURE');
    jest.spyOn(app.get(OllamaService), 'generate').mockRejectedValue(failure);
    await expect(app.get(PlanPreviewService).generate(id)).rejects.toBe(failure);
    expect(JSON.parse(log.mock.calls[0][0]).errorCategory).toBe('UNKNOWN_ERROR');
    expect(log).toHaveBeenCalledTimes(1);
  });
});

describe('Bounded diagnostic metadata', () => {
  it.each([undefined, '', 'PRIVATE_MODEL\ninjected', 'a'.repeat(161), 'replace-with-your-installed-model-name', apiKey, `fixture/${apiKey}`])('redacts unsafe model identifier %p', (model) => {
    expect(safeModelIdentifier(model, apiKey)).toBe('unknown');
  });

  it.each([null, 'PRIVATE_USAGE', -1, 1.5, Number.MAX_SAFE_INTEGER + 1, { private: 'PRIVATE_USAGE' }])('drops invalid token count %p without copying other fields', (value) => {
    expect(readTokenUsage('ollama', { prompt_eval_count: value, eval_count: 7, extra: 'PRIVATE_USAGE' })).toEqual({ outputTokens: 7 });
    expect(readTokenUsage('openrouter', { usage: { prompt_tokens: value, completion_tokens: 7, cost: 'PRIVATE_USAGE' } })).toEqual({ outputTokens: 7 });
  });

  it('does not trust arbitrary exception codes or raw exception messages', () => {
    expect(safeErrorCategory(new ServiceUnavailableException({ code: 'PRIVATE_ERROR_CODE', message: 'PRIVATE_ERROR_MESSAGE' }))).toBe('UNKNOWN_ERROR');
    expect(safeErrorCategory('PRIVATE_ERROR_MESSAGE')).toBe('UNKNOWN_ERROR');
  });
});
