// SPDX-FileCopyrightText: 2026 Keresztes Zsolt <https://kereszteszsolt.hu>
// SPDX-License-Identifier: Apache-2.0

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.config';
import { PrismaService } from '../src/prisma.service';

const id = '4206c355-753b-44ab-852b-818e538ff1cb';
const stepId = '651b04c3-afb5-49e0-827d-a273be3c354e';
const task = {
  id, title: 'Learn TypeScript', description: null, days: 2, minutesPerDay: 30,
  createdAt: new Date('2026-10-14T12:00:00Z'), updatedAt: new Date('2026-10-14T12:00:00Z'), subtasks: [],
};
const steps = [
  { title: '  Syntax  ', estimatedMinutes: 15 },
  { title: 'Functions', estimatedMinutes: 15 },
  { title: 'Practice', estimatedMinutes: 30 },
];
const saved = { ...task, subtasks: steps.map((step, order) => ({
  ...step, title: step.title.trim(), id: order === 0 ? stepId : `step-${order}`, taskId: id,
  order, day: order < 2 ? 1 : 2, completed: false,
})) };

describe('Accepted plan and persisted progress HTTP contracts', () => {
  let app: INestApplication;
  const database = {
    $transaction: jest.fn(), $queryRaw: jest.fn(),
    task: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    subtask: { findUnique: jest.fn(), update: jest.fn() },
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService).useValue(database).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
  });
  beforeEach(() => {
    jest.resetAllMocks();
    database.$transaction.mockImplementation((change) => change(database));
    database.task.findUnique.mockResolvedValue(task);
    database.task.update.mockResolvedValue(saved);
    database.subtask.findUnique.mockResolvedValue({ taskId: id });
  });
  afterAll(async () => { await app.close(); });

  it('locks the stored task and saves the complete recomputed plan in one nested write', async () => {
    const response = await request(app.getHttpServer()).post(`/api/tasks/${id}/plan`).send({ subtasks: steps }).expect(201);
    expect(response.body.progress).toEqual({ total: 3, completed: 0, percent: 0 });
    expect(response.body.subtasks.map((step: { day: number }) => step.day)).toEqual([1, 1, 2]);
    expect(database.$transaction).toHaveBeenCalledTimes(1);
    expect(database.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(database.task.findUnique.mock.invocationCallOrder[0]);
    expect(database.task.update).toHaveBeenCalledWith({
      where: { id }, data: { subtasks: { create: saved.subtasks.map(({ title, estimatedMinutes, day, order }) => ({ title, estimatedMinutes, day, order })) } },
      include: { subtasks: { orderBy: { order: 'asc' } } },
    });
    expect(database.task.update).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['empty request', {}],
    ['missing steps', { subtasks: null }],
    ['too few steps', { subtasks: steps.slice(0, 2) }],
    ['too many steps', { subtasks: Array.from({ length: 9 }, () => steps[0]) }],
    ['blank title', { subtasks: [{ ...steps[0], title: ' ' }, ...steps.slice(1)] }],
    ['long title', { subtasks: [{ ...steps[0], title: 'a'.repeat(161) }, ...steps.slice(1)] }],
    ['string estimate', { subtasks: [{ ...steps[0], estimatedMinutes: '10' }, ...steps.slice(1)] }],
    ['fractional estimate', { subtasks: [{ ...steps[0], estimatedMinutes: 1.5 }, ...steps.slice(1)] }],
    ['zero estimate', { subtasks: [{ ...steps[0], estimatedMinutes: 0 }, ...steps.slice(1)] }],
    ['unbounded estimate', { subtasks: [{ ...steps[0], estimatedMinutes: 241 }, ...steps.slice(1)] }],
    ['client-assigned day', { subtasks: [{ ...steps[0], day: 2 }, ...steps.slice(1)] }],
    ['client-assigned order', { subtasks: [{ ...steps[0], order: 99 }, ...steps.slice(1)] }],
    ['client-assigned completed', { subtasks: [{ ...steps[0], completed: true }, ...steps.slice(1)] }],
    ['client-assigned id', { subtasks: [{ ...steps[0], id: stepId }, ...steps.slice(1)] }],
    ['extra field', { subtasks: steps, accepted: true }],
  ])('rejects %s before opening a write transaction', async (_name, body) => {
    await request(app.getHttpServer()).post(`/api/tasks/${id}/plan`).send(body).expect(400);
    expect(database.$transaction).not.toHaveBeenCalled();
    expect(database.task.update).not.toHaveBeenCalled();
  });

  it.each([
    [31, 1, 1],
    [30, 30, 30],
    [20, 20, 20],
  ])('rejects a plan that cannot fit the current budget: %j', async (...estimates) => {
    const response = await request(app.getHttpServer()).post(`/api/tasks/${id}/plan`).send({
      subtasks: estimates.map((estimatedMinutes) => ({ title: 'Step', estimatedMinutes })),
    }).expect(422);
    expect(response.body.code).toBe('PLAN_EXCEEDS_BUDGET');
    expect(database.task.update).not.toHaveBeenCalled();
  });

  it('rejects a second saved plan inside the transaction', async () => {
    database.task.findUnique.mockResolvedValue(saved);
    await request(app.getHttpServer()).post(`/api/tasks/${id}/plan`).send({ subtasks: steps }).expect(409);
    expect(database.task.update).not.toHaveBeenCalled();
  });

  it('returns 404 for a missing task without inserting subtasks', async () => {
    database.task.findUnique.mockResolvedValue(null);
    await request(app.getHttpServer()).post(`/api/tasks/${id}/plan`).send({ subtasks: steps }).expect(404);
    expect(database.task.update).not.toHaveBeenCalled();
  });

  it.each(['plan', 'completion'])('rejects an invalid %s UUID before writes', async (kind) => {
    if (kind === 'plan') await request(app.getHttpServer()).post('/api/tasks/invalid/plan').send({ subtasks: steps }).expect(400);
    else await request(app.getHttpServer()).patch('/api/subtasks/invalid').send({ completed: true }).expect(400);
    expect(database.$transaction).not.toHaveBeenCalled();
  });

  it.each([true, false])('sets completion explicitly to %s and returns persisted task progress', async (completed) => {
    database.task.findUnique.mockResolvedValue(saved);
    database.task.update.mockResolvedValue({ ...saved, subtasks: saved.subtasks.map((step) => ({ ...step, completed: step.id === stepId && completed })) });
    const response = await request(app.getHttpServer()).patch(`/api/subtasks/${stepId}`).send({ completed }).expect(200);
    expect(database.subtask.update).toHaveBeenCalledWith({ where: { id: stepId }, data: { completed } });
    expect(response.body.progress).toEqual({ total: 3, completed: completed ? 1 : 0, percent: completed ? 33 : 0 });
  });

  it.each([{}, { completed: 'true' }, { completed: 1 }, { completed: null }, { completed: true, title: 'New title' }])('rejects invalid completion body %j', async (body) => {
    await request(app.getHttpServer()).patch(`/api/subtasks/${stepId}`).send(body).expect(400);
    expect(database.subtask.update).not.toHaveBeenCalled();
    expect(database.$transaction).not.toHaveBeenCalled();
  });

  it('returns 404 for a missing step', async () => {
    database.subtask.findUnique.mockResolvedValue(null);
    await request(app.getHttpServer()).patch(`/api/subtasks/${stepId}`).send({ completed: true }).expect(404);
  });

  it('rejects a deleted step after obtaining its parent lock', async () => {
    await request(app.getHttpServer()).patch(`/api/subtasks/${stepId}`).send({ completed: true }).expect(404);
    expect(database.subtask.update).not.toHaveBeenCalled();
  });

  it.each([0, 1, 2, 3])('derives progress from %i completed saved rows, for list and detail', async (completed) => {
    const current = { ...saved, subtasks: saved.subtasks.map((step, index) => ({ ...step, completed: index < completed })) };
    database.task.findUnique.mockResolvedValue(current);
    database.task.findMany.mockResolvedValue([current]);
    const detail = await request(app.getHttpServer()).get(`/api/tasks/${id}`).expect(200);
    const list = await request(app.getHttpServer()).get('/api/tasks').expect(200);
    const expected = { total: 3, completed, percent: Math.round(completed * 100 / 3) };
    expect(detail.body.progress).toEqual(expected);
    expect(list.body[0].progress).toEqual(expected);
    expect(list.body[0].subtasks).toBeUndefined();
  });
});
