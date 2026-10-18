// SPDX-FileCopyrightText: 2026 Keresztes Zsolt <https://kereszteszsolt.hu>
// SPDX-License-Identifier: Apache-2.0

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { mkdtempSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { chromium } = require('playwright-core');

const baseUrl = process.env.STONE_PLAN_SMOKE_URL || process.env.TASK_FLOW_SMOKE_URL || 'http://localhost:33050';
assert.ok(process.env.CHROME_EXECUTABLE, 'Set CHROME_EXECUTABLE to a local Chrome/headless-shell executable.');

async function run() {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 1200, height: 900 }, colorScheme: 'light' });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const artifacts = mkdtempSync(join(tmpdir(), 'stone-plan-ai-tfa004-'));
  const title = `Learn JavaScript array methods · TFA-004 ${randomUUID()}`;
  const pageErrors = [];
  let id;
  let saveRequests = 0;
  let previewRequests = 0;
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().endsWith('/plan')) saveRequests++;
    if (request.method() === 'POST' && request.url().endsWith('/plan-preview')) previewRequests++;
  });
  async function read() {
    const response = await context.request.get(`${baseUrl}/api/tasks/${id}`);
    assert.equal(response.status(), 200);
    return response.json();
  }
  async function reloadAndVerify(expected) {
    await page.reload();
    await page.locator(`[data-task-id="${id}"]`).click();
    await page.getByRole('heading', { name: 'Saved plan', exact: true }).waitFor();
    const current = await read();
    assert.deepEqual(current.subtasks, expected.subtasks);
    assert.deepEqual(current.progress, expected.progress);
    assert.equal(await page.locator('.subtask input:checked').count(), 1);
    assert.equal(await page.locator('app-plan-preview').count(), 0);
    assert.ok((await page.locator('.progress-label').textContent()).includes(`${expected.progress.percent}%`));
  }

  try {
    await page.goto(baseUrl);
    await page.getByRole('button', { name: 'New task', exact: true }).click();
    await page.locator('#task-title').fill(title);
    await page.locator('#task-description').fill('Practice map, filter, and reduce with simple number arrays.');
    await page.locator('#task-days').fill('3');
    await page.locator('#task-minutes').fill('60');
    const createdPromise = page.waitForResponse((response) => response.url().endsWith('/api/tasks') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Save task', exact: true }).click();
    const created = await createdPromise;
    assert.equal(created.status(), 201);
    const initial = await created.json();
    id = initial.id;
    const previewPromise = page.waitForResponse((response) => response.url().endsWith(`/${id}/plan-preview`), { timeout: 130000 });
    await page.getByRole('button', { name: 'Generate plan', exact: true }).click();
    const generated = await previewPromise;
    const preview = await generated.json();
    assert.equal(generated.status(), 200, JSON.stringify(preview));
    await page.getByLabel('Step 1 title', { exact: true }).fill('My accepted array practice');
    for (let step = 1; step <= preview.subtasks.length; step++) await page.getByLabel(`Step ${step} minutes`, { exact: true }).fill('1');
    const unsaved = await read();
    assert.deepEqual(unsaved.subtasks, []);
    assert.equal(unsaved.updatedAt, initial.updatedAt);
    await page.getByRole('button', { name: 'Save plan', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm and save', exact: true }).waitFor();
    assert.equal(saveRequests, 0);
    await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
    assert.equal(await page.getByLabel('Step 1 title', { exact: true }).inputValue(), 'My accepted array practice');

    await page.route(`**/api/tasks/${id}/plan`, (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }));
    await page.getByRole('button', { name: 'Save plan', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm and save', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Something went wrong.' }).waitFor();
    assert.equal(await page.getByLabel('Step 1 title', { exact: true }).inputValue(), 'My accepted array practice');
    await page.unroute(`**/api/tasks/${id}/plan`);
    await page.getByRole('button', { name: 'Save plan', exact: true }).click();
    const savedPromise = page.waitForResponse((response) => response.url().endsWith(`/${id}/plan`) && response.status() === 201);
    await page.getByRole('button', { name: 'Confirm and save', exact: true }).click();
    const accepted = await (await savedPromise).json();
    await page.getByRole('heading', { name: 'Saved plan', exact: true }).waitFor();
    assert.equal(accepted.subtasks.length, preview.subtasks.length);
    assert.equal(accepted.subtasks[0].title, 'My accepted array practice');
    assert.ok(accepted.subtasks.every((step, order) => step.day >= 1 && step.day <= 3 && step.order === order && step.estimatedMinutes === 1 && !step.completed));
    assert.equal(new Set(accepted.subtasks.map((step) => step.day)).size, 3);
    assert.equal(await page.getByRole('button', { name: 'New task', exact: true }).isEnabled(), true);
    const checkbox = page.locator(`[data-subtask-id="${accepted.subtasks[0].id}"]`);
    await page.route(`**/api/subtasks/${accepted.subtasks[0].id}`, (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }));
    await checkbox.click();
    await page.getByRole('alert').filter({ hasText: 'Something went wrong.' }).waitFor();
    assert.equal(await checkbox.isChecked(), false);
    await page.unroute(`**/api/subtasks/${accepted.subtasks[0].id}`);
    const completionPromise = page.waitForResponse((response) => response.url().endsWith(`/subtasks/${accepted.subtasks[0].id}`) && response.status() === 200);
    await checkbox.click();
    const completed = await (await completionPromise).json();
    assert.equal(completed.progress.completed, 1);
    assert.equal(completed.progress.percent, Math.round(100 / accepted.subtasks.length));
    await reloadAndVerify(completed);

    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    assert.equal(await page.locator('#task-days').isDisabled(), true);
    assert.equal(await page.locator('#task-minutes').isDisabled(), true);
    await page.locator('#task-description').fill('Description edited after accepting the plan.');
    const editPromise = page.waitForResponse((response) => response.url().endsWith(`/tasks/${id}`) && response.request().method() === 'PATCH');
    await page.getByRole('button', { name: 'Save task', exact: true }).click();
    assert.equal((await editPromise).status(), 200);
    await reloadAndVerify(completed);

    for (const [width, colorScheme] of [[1200, 'light'], [390, 'dark'], [320, 'light']]) {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme });
      assert.equal(await page.locator('.subtask input').count(), completed.subtasks.length);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
      await page.screenshot({ path: join(artifacts, `saved-plan-${width}-${colorScheme}.png`), fullPage: true });
    }
    console.log('Real create → generate → edit → confirm → save → complete → reload flow: passed');
    console.log('Restarting this Compose stack while keeping its PostgreSQL volume…');
    const dockerOptions = { cwd: resolve(__dirname, '../../..'), stdio: 'pipe', timeout: 120000 };
    execFileSync('docker', ['compose', 'stop'], dockerOptions);
    execFileSync('docker', ['compose', 'up', '-d', '--wait'], dockerOptions);
    await reloadAndVerify(completed);
    assert.equal(previewRequests, 1);
    assert.equal(saveRequests, 2);
    assert.deepEqual(pageErrors, []);
    console.log(`Full Compose stop/start preserved task, ${completed.subtasks.length} accepted steps and ${completed.progress.percent}% completion: passed`);
    console.log('Save/completion failure recovery and light/dark 1200/390/320 px checks: passed');
    console.log(`Local screenshots: ${artifacts}`);
  } finally {
    try {
      if (id) assert.equal((await context.request.delete(`${baseUrl}/api/tasks/${id}`)).status(), 204);
    } finally { await browser.close(); }
  }
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
