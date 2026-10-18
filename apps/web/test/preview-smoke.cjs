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
  const artifacts = mkdtempSync(join(tmpdir(), 'stone-plan-ai-tfa003-'));
  const title = `Learn JavaScript array methods · TFA-003 ${randomUUID()}`;
  const pageErrors = [];
  let id;
  let previewRequests = 0;
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('request', (request) => {
    assert.ok(!request.url().includes('/api/tasks/') || !request.url().endsWith('/plan'), 'Unexpected plan save');
    if (request.method() === 'POST' && request.url().endsWith('/plan-preview')) previewRequests++;
  });

  async function checkNotSaved(updatedAt) {
    const response = await context.request.get(`${baseUrl}/api/tasks/${id}`);
    assert.equal(response.status(), 200);
    const task = await response.json();
    assert.deepEqual(task.subtasks, []);
    assert.equal(task.updatedAt, updatedAt);
  }

  try {
    const created = await context.request.post(`${baseUrl}/api/tasks`, { data: {
      title, description: 'Practice map, filter, and reduce with simple number arrays.', days: 3, minutesPerDay: 60,
    } });
    assert.equal(created.status(), 201);
    const task = await created.json();
    id = task.id;
    await page.goto(baseUrl);
    await page.locator(`[data-task-id="${id}"]`).click();
    await page.getByRole('button', { name: 'Generate plan', exact: true }).waitFor();
    await checkNotSaved(task.updatedAt);

    const responsePromise = page.waitForResponse((response) => response.url().endsWith(`/${id}/plan-preview`) && response.request().method() === 'POST', { timeout: 130000 });
    await page.getByRole('button', { name: 'Generate plan', exact: true }).click();
    const response = await responsePromise;
    const preview = await response.json();
    assert.equal(response.status(), 200, JSON.stringify(preview));
    assert.ok(preview.subtasks.length >= 3 && preview.subtasks.length <= 8);
    const perDay = new Map();
    preview.subtasks.forEach((step, order) => {
      assert.equal(step.order, order);
      assert.ok(step.title.trim().length >= 1 && step.title.length <= 160);
      assert.ok(Number.isInteger(step.estimatedMinutes) && step.estimatedMinutes > 0);
      assert.ok(step.day >= 1 && step.day <= 3);
      perDay.set(step.day, (perDay.get(step.day) || 0) + step.estimatedMinutes);
    });
    assert.ok([...perDay.values()].every((minutes) => minutes <= 60));
    await page.getByLabel('Step 1 title', { exact: true }).waitFor();
    await checkNotSaved(task.updatedAt);
    await page.getByLabel('Step 1 title', { exact: true }).fill('My edited learning step');
    await page.getByLabel('Step 1 minutes', { exact: true }).fill('1');
    assert.equal(await page.getByLabel('Step 1 title', { exact: true }).inputValue(), 'My edited learning step');
    await checkNotSaved(task.updatedAt);

    for (const [width, colorScheme] of [[1200, 'light'], [390, 'dark'], [320, 'light']]) {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme });
      assert.equal(await page.locator('app-plan-preview .step input').count(), preview.subtasks.length * 2);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
      await page.screenshot({ path: join(artifacts, `preview-${width}-${colorScheme}.png`), fullPage: true });
    }

    for (const [status, code, message] of [
      [503, 'OLLAMA_UNAVAILABLE', 'The local model is offline. Start Ollama and try again.'],
      [502, 'INVALID_AI_OUTPUT', 'The local model returned an invalid plan. Try again.'],
      [422, 'PLAN_EXCEEDS_BUDGET', 'The plan does not fit your time budget. Try again.'],
      [504, 'OLLAMA_TIMEOUT', 'The local model took too long. Try again.'],
    ]) {
      await page.route(`**/api/tasks/${id}/plan-preview`, (route) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ code, message }) }));
      await page.getByRole('button', { name: 'Generate again', exact: true }).click();
      await page.getByRole('alert').filter({ hasText: message }).waitFor();
      assert.equal(await page.getByLabel('Step 1 title', { exact: true }).inputValue(), 'My edited learning step');
      assert.ok(await page.getByRole('button', { name: 'Generate again', exact: true }).isEnabled());
      await page.unroute(`**/api/tasks/${id}/plan-preview`);
    }

    await page.reload();
    await page.locator(`[data-task-id="${id}"]`).click();
    await page.getByRole('button', { name: 'Generate plan', exact: true }).waitFor();
    assert.equal(await page.locator('app-plan-preview .step').count(), 0);
    await checkNotSaved(task.updatedAt);
    assert.equal(previewRequests, 5);
    assert.deepEqual(pageErrors, []);
    console.log(`Real Ollama preview through browser → Nginx → API: passed; ${preview.subtasks.length} steps, ${[...perDay.values()].reduce((a,b)=>a+b,0)} minutes`);
    console.log('Unsaved editing, reload discard, four controlled error states and 1200/390/320 px themes: passed');
    console.log(`Local screenshots: ${artifacts}`);
  } finally {
    if (id) await context.request.delete(`${baseUrl}/api/tasks/${id}`);
    await browser.close();
  }
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
