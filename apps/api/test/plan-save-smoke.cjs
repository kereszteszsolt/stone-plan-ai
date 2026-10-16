// SPDX-FileCopyrightText: 2026 Keresztes Zsolt <https://kereszteszsolt.hu>
// SPDX-License-Identifier: Apache-2.0

const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('./dist/generated/prisma/client');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const baseUrl = 'http://127.0.0.1:3000/api';
const fixtureIds = [];
const subtasks = [15, 15, 30].map((estimatedMinutes, index) => ({ title: `Accepted step ${index + 1}`, estimatedMinutes }));

function call(path, method = 'GET', body) {
  return fetch(`${baseUrl}${path}`, { method, headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
async function create(days = 3) {
  const response = await call('/tasks', 'POST', { title: `Plan API smoke ${randomUUID()}`, days, minutesPerDay: 30 });
  assert.equal(response.status, 201);
  const task = await response.json();
  fixtureIds.push(task.id);
  return task;
}
async function read(id) {
  const response = await call(`/tasks/${id}`);
  assert.equal(response.status, 200);
  return response.json();
}

async function run() {
  const initial = await create();
  const path = `/tasks/${initial.id}/plan`;
  assert.equal((await call(path, 'POST', { subtasks: subtasks.map((step) => ({ ...step, estimatedMinutes: 31 })) })).status, 422);
  const unchanged = await read(initial.id);
  assert.deepEqual(unchanged.subtasks, []);
  assert.equal(unchanged.updatedAt, initial.updatedAt);
  assert.equal((await call(path, 'POST', { subtasks: subtasks.map((step) => ({ ...step, day: 99 })) })).status, 400);
  const responses = await Promise.all([call(path, 'POST', { subtasks }), call(path, 'POST', { subtasks })]);
  assert.deepEqual(responses.map((response) => response.status).sort(), [201, 409]);
  const accepted = await read(initial.id);
  assert.equal(accepted.subtasks.length, 3);
  assert.deepEqual(accepted.subtasks.map(({ day, order }) => [day, order]), [[1, 0], [2, 1], [3, 2]]);
  assert.deepEqual(accepted.progress, { total: 3, completed: 0, percent: 0 });
  assert.equal((await call(`/tasks/${initial.id}`, 'PATCH', { minutesPerDay: 60 })).status, 409);
  const completionPath = `/subtasks/${accepted.subtasks[0].id}`;
  assert.equal((await call(completionPath, 'PATCH', { completed: 'true' })).status, 400);
  for (const completed of [true, true, false]) {
    const response = await call(completionPath, 'PATCH', { completed });
    assert.equal(response.status, 200);
    const task = await response.json();
    assert.deepEqual(task.progress, { total: 3, completed: completed ? 1 : 0, percent: completed ? 33 : 0 });
    assert.equal((await read(initial.id)).subtasks[0].completed, completed);
  }
  assert.equal((await call(`/tasks/${initial.id}`, 'PATCH', { title: `${initial.title} renamed`, description: 'Plan stays intact' })).status, 200);
  assert.deepEqual((await read(initial.id)).subtasks, accepted.subtasks);
  assert.equal((await call(`/tasks/${initial.id}/plan-preview`, 'POST', {})).status, 409);
  assert.equal((await call(`/subtasks/${randomUUID()}`, 'PATCH', { completed: true })).status, 404);

  for (let iteration = 0; iteration < 4; iteration++) {
    const task = await create();
    const [edit, save] = await Promise.all([
      call(`/tasks/${task.id}`, 'PATCH', { days: 1, minutesPerDay: 15 }),
      call(`/tasks/${task.id}/plan`, 'POST', { subtasks }),
    ]);
    assert.ok((edit.status === 200 && save.status === 422) || (edit.status === 409 && save.status === 201), `Unexpected race outcome: ${edit.status}/${save.status}`);
    const current = await read(task.id);
    if (current.subtasks.length) {
      assert.equal(current.subtasks.length, 3);
      assert.equal(current.days, 3);
      assert.equal(current.minutesPerDay, 30);
    } else {
      assert.equal(current.days, 1);
      assert.equal(current.minutesPerDay, 15);
    }
  }
  const month = await create(30);
  const monthSteps = Array.from({ length: 60 }, (_, index) => ({ title: `Daily session ${index + 1}`, estimatedMinutes: 10 }));
  assert.equal((await call(`/tasks/${month.id}/plan`, 'POST', { subtasks: monthSteps.slice(0, 29) })).status, 400);
  assert.deepEqual((await read(month.id)).subtasks, []);
  assert.equal((await call(`/tasks/${month.id}/plan`, 'POST', { subtasks: monthSteps })).status, 201);
  const acceptedMonth = await read(month.id);
  assert.equal(acceptedMonth.days, 30);
  assert.equal(acceptedMonth.subtasks.length, 60);
  assert.deepEqual(acceptedMonth.subtasks.map(({ day, order }) => [day, order]), monthSteps.map((_, order) => [Math.floor(order / 2) + 1, order]));
  assert.equal((await call(`/subtasks/${acceptedMonth.subtasks[59].id}`, 'PATCH', { completed: true })).status, 200);
  assert.deepEqual((await read(month.id)).progress, { total: 60, completed: 1, percent: 2 });
  await call(`/tasks/${initial.id}`, 'DELETE');
  assert.equal(await prisma.subtask.count({ where: { taskId: initial.id } }), 0);
  console.log('Live atomic plan acceptance, 30-day/60-step persistence, concurrent duplicate/budget guards, idempotent completion and cascade: passed');
}

run().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => {
  await prisma.task.deleteMany({ where: { id: { in: fixtureIds } } });
  await prisma.$disconnect();
});
