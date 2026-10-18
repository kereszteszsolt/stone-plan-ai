// SPDX-FileCopyrightText: 2026 Keresztes Zsolt <https://kereszteszsolt.hu>
// SPDX-License-Identifier: Apache-2.0

const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { mkdtempSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { chromium } = require('playwright-core');

const baseUrl = process.env.STONE_PLAN_SMOKE_URL || process.env.TASK_FLOW_SMOKE_URL || 'http://localhost:33050';
assert.ok(process.env.CHROME_EXECUTABLE, 'Set CHROME_EXECUTABLE to a local Chrome/headless-shell executable.');

async function run() {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 1200, height: 900 }, colorScheme: 'light' });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const artifacts = mkdtempSync(join(tmpdir(), 'stone-plan-ai-tfa007-'));
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  let id;
  let previewRequests = 0;
  try {
    await page.goto(baseUrl);
    await page.getByRole('button', { name: 'New task', exact: true }).click();
    await page.locator('#task-title').fill(`30-day practice · TFA-007 ${randomUUID()}`);
    assert.equal(await page.locator('#task-days').getAttribute('max'), '30');
    for (const invalid of ['0', '31', '1.5']) {
      await page.locator('#task-days').fill(invalid);
      assert.equal(await page.locator('#task-days').evaluate((input) => input.checkValidity()), false);
    }
    await page.locator('#task-days').fill('30');
    await page.locator('#task-minutes').fill('30');
    const creation = page.waitForResponse((response) => response.url().endsWith('/api/tasks') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Save task', exact: true }).click();
    const created = await creation;
    assert.equal(created.status(), 201);
    const task = await created.json();
    id = task.id;
    assert.equal(task.days, 30);

    // Only generation is a browser fixture; CRUD, acceptance and completion hit the real API/database.
    const subtasks = Array.from({ length: 60 }, (_, order) => ({ title: `Practice session ${order + 1}`, estimatedMinutes: 10, day: Math.floor(order / 2) + 1, order }));
    await page.route(`**/api/tasks/${id}/plan-preview`, async (route) => {
      previewRequests++;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ subtasks }) });
    });
    await page.getByRole('button', { name: 'Generate plan', exact: true }).click();
    await page.locator('#step-title-59').waitFor();
    assert.equal(await page.locator('.step').count(), 60);
    assert.match(await page.locator('.preview').textContent(), /Generated day 30/);
    const untouched = await context.request.get(`${baseUrl}/api/tasks/${id}`);
    assert.deepEqual((await untouched.json()).subtasks, []);
    await page.locator('#step-title-59').fill('Final month review');
    await page.locator('#step-minutes-59').fill('20');
    await page.screenshot({ path: join(artifacts, 'desktop-preview.png') });
    await page.getByRole('button', { name: 'Save plan', exact: true }).click();
    const acceptance = page.waitForResponse((response) => response.url().endsWith(`/api/tasks/${id}/plan`) && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Confirm and save', exact: true }).click();
    const acceptedResponse = await acceptance;
    assert.equal(acceptedResponse.status(), 201);
    const accepted = await acceptedResponse.json();
    assert.equal(accepted.subtasks.length, 60);
    const daily = new Map();
    for (const step of accepted.subtasks) daily.set(step.day, (daily.get(step.day) || 0) + step.estimatedMinutes);
    assert.equal(daily.size, 30);
    assert.ok([...daily.values()].every((minutes) => minutes > 0 && minutes <= 30));
    assert.equal([...daily.values()].filter((minutes) => minutes === 20).length, 29);
    assert.equal([...daily.values()].filter((minutes) => minutes === 30).length, 1);
    assert.ok(accepted.subtasks.every((step, order) => step.order === order));
    assert.equal(accepted.subtasks[59].title, 'Final month review');
    assert.equal(accepted.subtasks[59].estimatedMinutes, 20);
    const completion = page.waitForResponse((response) => response.url().endsWith(`/api/subtasks/${accepted.subtasks[59].id}`));
    await page.locator(`[data-subtask-id="${accepted.subtasks[59].id}"]`).click();
    assert.equal((await completion).status(), 200);
    await page.reload();
    await page.locator(`[data-task-id="${id}"]`).click();
    await page.locator('.plan-day').last().waitFor();
    assert.equal(await page.locator('.plan-day').count(), 30);
    assert.equal(await page.locator('.subtask input:checked').count(), 1);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.locator('.plan-day').last().scrollIntoViewIfNeeded();
    await page.screenshot({ path: join(artifacts, 'mobile-saved.png') });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    assert.equal(previewRequests, 1);
    assert.deepEqual(pageErrors, []);
    console.log(`30-day browser create, fixture preview, real 60-step acceptance/completion/reload and mobile layout: passed. Screenshots: ${artifacts}`);
  } finally {
    try {
      if (id) {
        const deleted = await context.request.delete(`${baseUrl}/api/tasks/${id}`);
        assert.ok(deleted.status() === 204 || deleted.status() === 404);
      }
    } finally {
      await browser.close();
    }
  }
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
