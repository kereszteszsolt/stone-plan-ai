// SPDX-FileCopyrightText: 2026 Keresztes Zsolt <https://kereszteszsolt.hu>
// SPDX-License-Identifier: Apache-2.0

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { configureApp } from '../src/app.config';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';
import { Prisma } from '../src/generated/prisma/client';

const id = '4206c355-753b-44ab-852b-818e538ff1cb';
const task = {
  id, title: 'Learn TypeScript', description: null, days: 3, minutesPerDay: 30,
  createdAt: new Date('2026-10-14T12:00:00Z'), updatedAt: new Date('2026-10-14T12:00:00Z'),
  subtasks: [],
};
const input = { title: 'Learn TypeScript', days: 3, minutesPerDay: 30 };
const missing = () => new Prisma.PrismaClientKnownRequestError('Record missing', { code: 'P2025', clientVersion: '7.10.0' });

describe('Task CRUD HTTP boundary', () => {
  let app: INestApplication;
  const database = {
    $transaction: jest.fn(), $queryRaw: jest.fn(),
    task: {
      findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(),
    },
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
    database.task.findMany.mockResolvedValue([task]);
    database.task.findUnique.mockResolvedValue(task);
    database.task.create.mockResolvedValue(task);
    database.task.update.mockResolvedValue(task);
    database.task.delete.mockResolvedValue(task);
  });

  afterAll(async () => { await app.close(); });

  it('lists tasks in a deterministic newest-first order', async () => {
    const response = await request(app.getHttpServer()).get('/api/tasks').expect(200);
    expect(response.body[0].id).toBe(id);
    expect(database.task.findMany).toHaveBeenCalledWith({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], include: { subtasks: { select: { completed: true } } },
    });
    expect(response.body[0].progress).toEqual({ total: 0, completed: 0, percent: 0 });
  });

  it('reads one task with ordered subtasks', async () => {
    const response = await request(app.getHttpServer()).get(`/api/tasks/${id}`).expect(200);
    expect(response.body.subtasks).toEqual([]);
    expect(database.task.findUnique).toHaveBeenCalledWith({ where: { id }, include: { subtasks: { orderBy: { order: 'asc' } } } });
  });

  it('trims text and creates a task with a nullable description', async () => {
    await request(app.getHttpServer()).post('/api/tasks').send({ ...input, title: '  Learn TypeScript  ' }).expect(201);
    expect(database.task.create.mock.calls[0][0].data).toEqual({ ...input, description: null });
  });

  it.each([
    ['missing title', { days: 3, minutesPerDay: 30 }],
    ['blank title', { ...input, title: '   ' }],
    ['long title', { ...input, title: 'a'.repeat(161) }],
    ['wrong title type', { ...input, title: 5 }],
    ['long description', { ...input, description: 'a'.repeat(2001) }],
    ['wrong description type', { ...input, description: [] }],
    ['zero days', { ...input, days: 0 }],
    ['too many days', { ...input, days: 31 }],
    ['fractional days', { ...input, days: 1.5 }],
    ['string days', { ...input, days: '3' }],
    ['too few minutes', { ...input, minutesPerDay: 14 }],
    ['too many minutes', { ...input, minutesPerDay: 241 }],
    ['fractional minutes', { ...input, minutesPerDay: 15.5 }],
    ['unknown property', { ...input, completed: true }],
    ['client-supplied id', { ...input, id }],
  ])('rejects %s before writing to Prisma', async (_name, body) => {
    const response = await request(app.getHttpServer()).post('/api/tasks').send(body).expect(400);
    expect(response.body.message.length).toBeGreaterThan(0);
    expect(database.task.create).not.toHaveBeenCalled();
  });

  it.each([1, 14, 15, 30])('accepts the day boundary %i', async (days) => {
    await request(app.getHttpServer()).post('/api/tasks').send({ ...input, days }).expect(201);
    expect(database.task.create.mock.calls[0][0].data.days).toBe(days);
  });

  it('updates an unsaved task to a 30-day horizon', async () => {
    await request(app.getHttpServer()).patch(`/api/tasks/${id}`).send({ days: 30 }).expect(200);
    expect(database.task.update.mock.calls[0][0].data).toEqual({ days: 30 });
  });

  it.each([15, 240])('accepts the minutes boundary %i', async (minutesPerDay) => {
    await request(app.getHttpServer()).post('/api/tasks').send({ ...input, minutesPerDay }).expect(201);
  });

  it('supports partial updates and clearing the description', async () => {
    await request(app.getHttpServer()).patch(`/api/tasks/${id}`).send({ description: null }).expect(200);
    expect(database.task.update.mock.calls[0][0].data).toEqual({ description: null });
  });

  it.each([{}, { days: 0 }, { days: 31 }, { days: 1.5 }, { days: '30' }, { title: null }, { createdAt: '2026-01-01' }])('rejects invalid updates: %j', async (body) => {
    await request(app.getHttpServer()).patch(`/api/tasks/${id}`).send(body).expect(400);
    expect(database.task.update).not.toHaveBeenCalled();
  });

  it('returns 404 for a missing task', async () => {
    database.task.findUnique.mockResolvedValue(null);
    await request(app.getHttpServer()).get(`/api/tasks/${id}`).expect(404);
    await request(app.getHttpServer()).patch(`/api/tasks/${id}`).send({ title: 'Updated' }).expect(404);
  });

  it.each(['get', 'patch', 'delete'] as const)('rejects a malformed id on %s', async (method) => {
    await request(app.getHttpServer())[method]('/api/tasks/not-a-uuid').send({ title: 'Updated' }).expect(400);
    expect(database.task.findUnique).not.toHaveBeenCalled();
    expect(database.task.delete).not.toHaveBeenCalled();
  });

  it('deletes a task with a 204 response', async () => {
    await request(app.getHttpServer()).delete(`/api/tasks/${id}`).expect(204, '');
    expect(database.task.delete).toHaveBeenCalledWith({ where: { id } });
  });

  it('maps a missing delete record to 404', async () => {
    database.task.delete.mockRejectedValue(missing());
    await request(app.getHttpServer()).delete(`/api/tasks/${id}`).expect(404);
  });

  it('maps a concurrent deletion during update to 404', async () => {
    database.task.update.mockRejectedValue(missing());
    await request(app.getHttpServer()).patch(`/api/tasks/${id}`).send({ title: 'Updated' }).expect(404);
  });

  it('keeps an existing saved plan within its original time budget', async () => {
    database.task.findUnique.mockResolvedValue({ ...task, subtasks: [{ id: 'subtask' }] });
    await request(app.getHttpServer()).patch(`/api/tasks/${id}`).send({ days: 5 }).expect(409);
    expect(database.task.update).not.toHaveBeenCalled();
    await request(app.getHttpServer()).patch(`/api/tasks/${id}`).send({ title: 'Renamed goal' }).expect(200);
  });
});
