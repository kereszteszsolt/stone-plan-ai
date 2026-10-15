// SPDX-FileCopyrightText: 2026 Keresztes Zsolt <https://kereszteszsolt.hu>
// SPDX-License-Identifier: Apache-2.0

const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { mkdtempSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { chromium } = require('playwright-core');

const baseUrl = process.env.TASK_FLOW_SMOKE_URL || 'http://localhost:8080';
assert.ok(process.env.CHROME_EXECUTABLE, 'Set CHROME_EXECUTABLE to your local Chrome/headless-shell executable.');

async function run() {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_EXECUTABLE,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const context = await browser.newContext({ viewport: { width: 1200, height: 900 }, colorScheme: 'light' });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const ids = new Set();
  const artifacts = mkdtempSync(join(tmpdir(), 'task-flow-ai-tfa002-'));
  const title = `TFA-002 browser ${randomUUID()}`;
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  async function save(method) {
    const response = page.waitForResponse((response) => response.request().method() === method && response.url().includes('/api/tasks'));
    await page.getByRole('button', { name: 'Save task', exact: true }).click();
    return response;
  }

  async function detail(id, expectedTitle) {
    await page.locator(`[data-task-id="${id}"]`).click();
    await page.locator('#detail-heading').filter({ hasText: expectedTitle }).waitFor();
  }

  try {
    await page.goto(baseUrl);
    await page.getByRole('button', { name: 'New task', exact: true }).click();
    await page.getByLabel('Title', { exact: false }).fill(title);
    await page.getByLabel('Description', { exact: false }).fill('A real browser fixture');
    await page.getByLabel('Days', { exact: true }).fill('4');
    await page.getByLabel('Minutes per day', { exact: true }).fill('45');
    const created = await save('POST');
    assert.equal(created.status(), 201);
    const task = await created.json();
    const id = task.id;
    ids.add(id);
    await page.locator('#detail-heading').filter({ hasText: title }).waitFor();
    await page.reload();
    await detail(id, title);
    assert.ok((await page.locator('.task-facts').innerText()).includes('180 minutes'));
    assert.equal(await page.locator('.description').innerText(), 'A real browser fixture');

    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    const updatedTitle = `${title} updated`;
    await page.getByLabel('Title', { exact: false }).fill(updatedTitle);
    await page.getByLabel('Description', { exact: false }).fill('Updated details');
    await page.getByLabel('Days', { exact: true }).fill('5');
    await page.getByLabel('Minutes per day', { exact: true }).fill('60');
    assert.equal((await save('PATCH')).status(), 200);
    await page.reload();
    await detail(id, updatedTitle);
    assert.ok((await page.locator('.task-facts').innerText()).includes('300 minutes'));
    assert.equal(await page.locator('.description').innerText(), 'Updated details');

    for (const [width, colorScheme] of [[1200, 'light'], [390, 'dark'], [320, 'light']]) {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme });
      await page.getByRole('button', { name: 'Edit', exact: true }).click();
      await page.getByLabel('Title', { exact: false }).waitFor();
      assert.equal(await page.locator('fieldset input, fieldset textarea').count(), 4);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
      await page.screenshot({ path: join(artifacts, `form-${width}-${colorScheme}.png`), fullPage: true });
      await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    }

    await page.setViewportSize({ width: 1200, height: 900 });
    await page.emulateMedia({ colorScheme: 'light' });
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    const draftTitle = `${title} retry`;
    await page.getByLabel('Title', { exact: false }).fill(draftTitle);
    const failingRoute = async (route) => {
      if (route.request().method() === 'PATCH') await route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
      else await route.continue();
    };
    await page.route(`**/api/tasks/${id}`, failingRoute);
    assert.equal((await save('PATCH')).status(), 503);
    await page.getByRole('alert').filter({ hasText: 'Something went wrong.' }).waitFor();
    assert.equal(await page.getByLabel('Title', { exact: false }).inputValue(), draftTitle);
    assert.equal((await (await context.request.get(`${baseUrl}/api/tasks/${id}`)).json()).title, updatedTitle);
    await page.unroute(`**/api/tasks/${id}`, failingRoute);
    assert.equal((await save('PATCH')).status(), 200);
    await page.locator('#detail-heading').filter({ hasText: draftTitle }).waitFor();

    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.equal((await context.request.get(`${baseUrl}/api/tasks/${id}`)).status(), 200);
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    const deleted = page.waitForResponse((response) => response.request().method() === 'DELETE');
    await page.getByRole('button', { name: 'Delete task', exact: true }).click();
    assert.equal((await deleted).status(), 204);
    ids.delete(id);
    await page.reload();
    assert.equal((await context.request.get(`${baseUrl}/api/tasks/${id}`)).status(), 404);
    assert.equal(await page.locator(`[data-task-id="${id}"]`).count(), 0);

    await page.route('**/api/tasks', (route) => route.abort());
    await page.reload();
    await page.getByRole('alert').filter({ hasText: 'Unable to reach the server.' }).waitFor();
    await page.unroute('**/api/tasks');
    await page.getByRole('button', { name: 'Try again', exact: true }).click();
    await page.getByRole('alert').waitFor({ state: 'hidden' });
    assert.deepEqual(pageErrors, []);
    console.log('Browser CRUD/reload, failed-save recovery, deletion confirmation, list retry and responsive themes: passed');
    console.log(`Local screenshots: ${artifacts}`);
  } finally {
    for (const id of ids) await context.request.delete(`${baseUrl}/api/tasks/${id}`);
    await browser.close();
  }
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
