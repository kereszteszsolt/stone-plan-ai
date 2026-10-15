// SPDX-FileCopyrightText: 2026 Keresztes Zsolt <https://kereszteszsolt.hu>
// SPDX-License-Identifier: Apache-2.0

const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('./dist/generated/prisma/client');

const taskId = process.env.SMOKE_TASK_ID;
const phase = process.env.SMOKE_PHASE;
assert.ok(taskId, 'SMOKE_TASK_ID is required');
assert.ok(['create', 'verify', 'cleanup'].includes(phase), 'Unknown smoke phase');

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function run() {
  if (phase === 'cleanup') {
    await prisma.task.deleteMany({ where: { id: taskId } });
    return;
  }

  if (phase === 'create') {
    const task = await prisma.task.create({
      data: {
        id: taskId,
        title: 'TFA-001 persistence smoke',
        days: 2,
        minutesPerDay: 30,
        subtasks: {
          create: { title: 'Check persistence', day: 1, order: 0, estimatedMinutes: 20 },
        },
      },
      include: { subtasks: true },
    });
    assert.equal(task.description, null);
    assert.ok(task.createdAt instanceof Date);
    assert.ok(task.updatedAt instanceof Date);
    assert.equal(task.subtasks[0].completed, false);
    assert.equal(task.subtasks[0].taskId, taskId);
    await assert.rejects(
      prisma.subtask.create({
        data: { taskId, title: 'Duplicate order', day: 1, order: 0, estimatedMinutes: 10 },
      }),
      { code: 'P2002' },
    );
    await assert.rejects(
      prisma.subtask.create({
        data: { taskId: randomUUID(), title: 'Orphan', day: 1, order: 0, estimatedMinutes: 10 },
      }),
      { code: 'P2003' },
    );
    console.log('Prisma create, defaults, unique order and foreign key: passed');
    return;
  }

  const task = await prisma.task.findUniqueOrThrow({
    where: { id: taskId },
    include: { subtasks: true },
  });
  assert.equal(task.title, 'TFA-001 persistence smoke');
  assert.equal(task.days, 2);
  assert.equal(task.minutesPerDay, 30);
  assert.equal(task.subtasks.length, 1);
  assert.equal(task.subtasks[0].estimatedMinutes, 20);
  assert.equal(task.subtasks[0].completed, false);
  await prisma.task.delete({ where: { id: taskId } });
  assert.equal(await prisma.subtask.count({ where: { taskId } }), 0);
  console.log('Restart persistence and cascading deletion: passed');
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
