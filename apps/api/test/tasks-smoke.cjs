// SPDX-FileCopyrightText: 2026 Keresztes Zsolt <https://kereszteszsolt.hu>
// SPDX-License-Identifier: Apache-2.0

const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('./dist/generated/prisma/client');
const baseUrl = 'http://127.0.0.1:3000/api/tasks';
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
let taskId;

async function call(path, method = 'GET', body) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function run() {
  const input = { title: `TFA-002 HTTP smoke ${randomUUID()}`, days: 3, minutesPerDay: 30 };
  const created = await call('', 'POST', input);
  assert.equal(created.status, 201);
  const task = await created.json();
  taskId = task.id;
  assert.equal(task.description, null);
  assert.deepEqual(task.subtasks, []);
  assert.ok((await (await call('')).json()).some((item) => item.id === taskId));

  const changed = await call(`/${taskId}`, 'PATCH', { title: `${input.title} updated`, description: 'Persist this edit', days: 5 });
  assert.equal(changed.status, 200);
  const read = await call(`/${taskId}`);
  assert.equal(read.status, 200);
  const saved = await read.json();
  assert.equal(saved.title, `${input.title} updated`);
  assert.equal(saved.description, 'Persist this edit');
  assert.equal(saved.days, 5);
  assert.equal(saved.minutesPerDay, 30);

  const invalid = await call(`/${taskId}`, 'PATCH', { days: 15 });
  assert.equal(invalid.status, 400);
  assert.ok((await invalid.json()).message.length);
  assert.equal((await (await call(`/${taskId}`)).json()).days, 5);
  assert.equal((await call('/not-a-uuid')).status, 400);
  assert.equal((await call(`/${randomUUID()}`)).status, 404);

  await prisma.subtask.create({ data: { taskId, title: 'Cascade fixture', day: 1, order: 0, estimatedMinutes: 15 } });
  assert.equal((await call(`/${taskId}`, 'PATCH', { minutesPerDay: 60 })).status, 409);
  const deleted = await call(`/${taskId}`, 'DELETE');
  assert.equal(deleted.status, 204);
  assert.equal(await deleted.text(), '');
  assert.equal(await prisma.subtask.count({ where: { taskId } }), 0);
  assert.equal((await call(`/${taskId}`)).status, 404);
  assert.equal((await call(`/${taskId}`, 'DELETE')).status, 404);
  assert.ok(!(await (await call('')).json()).some((item) => item.id === taskId));
  console.log('Live task CRUD, validation, persisted edits and HTTP cascading deletion: passed');
}

run()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(async () => {
    if (taskId) await prisma.task.deleteMany({ where: { id: taskId } });
    await prisma.$disconnect();
  });
