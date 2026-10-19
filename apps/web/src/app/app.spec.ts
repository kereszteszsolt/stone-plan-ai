// SPDX-FileCopyrightText: 2026 Keresztes Zsolt <https://kereszteszsolt.hu>
// SPDX-License-Identifier: Apache-2.0

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './app';
import { APP_INFO } from './app-info';
import type { TaskDetail } from './tasks-api.service';

const task: TaskDetail = {
  id: '4206c355-753b-44ab-852b-818e538ff1cb', title: 'Learn TypeScript', description: null,
  days: 3, minutesPerDay: 30, createdAt: '2026-10-14T12:00:00Z', updatedAt: '2026-10-14T12:00:00Z', subtasks: [],
  progress: { total: 0, completed: 0, percent: 0 },
};
const savedTask: TaskDetail = { ...task, progress: { total: 3, completed: 0, percent: 0 }, subtasks: [
  { id: '651b04c3-afb5-49e0-827d-a273be3c354e', taskId: task.id, title: 'Syntax', day: 1, order: 0, estimatedMinutes: 15, completed: false },
  { id: 'second-step', taskId: task.id, title: 'Functions', day: 1, order: 1, estimatedMinutes: 15, completed: false },
  { id: 'third-step', taskId: task.id, title: 'Practice', day: 2, order: 2, estimatedMinutes: 30, completed: false },
] };

describe('Task screen', () => {
  let fixture: ComponentFixture<App>;
  let app: App;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [App], providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(App);
    app = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => { http.verify(); });

  async function list(tasks: TaskDetail[] = []): Promise<void> {
    http.expectOne('/api/tasks').flush(tasks);
    await Promise.resolve();
    await fixture.whenStable();
  }

  async function select(current: TaskDetail = task): Promise<void> {
    await list([current]);
    const pending = app.selectTask(task.id);
    http.expectOne(`/api/tasks/${task.id}`).flush(current);
    await pending;
    await fixture.whenStable();
  }

  it('uses the shared brand for its title, favicon and current-year sidebar attribution', async () => {
    await list();
    expect(document.title).toBe(APP_INFO.appName);
    expect(fixture.nativeElement.querySelector('h1').textContent).toBe(APP_INFO.appName);
    expect(document.querySelector('link[rel="icon"]')?.getAttribute('href')).toBe(APP_INFO.faviconUrl);
    const footer = fixture.nativeElement.querySelector('.sidebar-footer');
    expect(footer.textContent).toContain(`© ${new Date().getFullYear()} ${APP_INFO.authorName}`);
    expect(footer.querySelector('.license-link').textContent).toBe('Apache-2.0');
    expect(footer.querySelector('.author-website').textContent).toBe(APP_INFO.authorWebsiteLabel);
    expect(footer.querySelector('.author-website').getAttribute('href')).toBe(APP_INFO.authorWebsite);
  });

  it('offers configured project/author links and clearly labels voluntary author support', async () => {
    await list();
    const dialog = fixture.nativeElement.querySelector('dialog');
    expect(dialog.getAttribute('aria-labelledby')).toBe('about-heading');
    expect(dialog.querySelector('#about-heading').textContent).toBe(`About ${APP_INFO.appName}`);
    const links = [...dialog.querySelectorAll('.about-action')] as HTMLAnchorElement[];
    expect(links.find((link) => link.textContent?.includes('Ways to support'))?.getAttribute('href')).toBe(APP_INFO.authorWaysToSupportUrl);
    const website = links.find((link) => link.textContent?.includes(APP_INFO.authorWebsiteLabel));
    expect(website?.getAttribute('href')).toBe(APP_INFO.authorWebsite);
    expect(links.find((link) => link.textContent?.includes('Source'))?.getAttribute('href')).toBe(APP_INFO.appGithubUrl);
    expect(links.find((link) => link.textContent?.includes('GitHub profile'))?.getAttribute('href')).toBe(APP_INFO.authorGithub);
    expect(links.every((link) => link.getAttribute('href') && link.rel.includes('noopener'))).toBe(true);
    expect(links.every((link) => !link.hasAttribute('title'))).toBe(true);
    expect(dialog.querySelector('.coffee-action').textContent).toContain('Buy me a Coffee');
    const supportGroup = dialog.querySelector('.about-support-actions');
    expect(supportGroup.textContent).toContain('Buy me a Coffee');
    expect(supportGroup.textContent).toContain('Ways to support');
    const copyright = dialog.querySelector('.about-copyright');
    expect(copyright.textContent).toContain(`${APP_INFO.authorName}, Apache-2.0`);
    expect(copyright.querySelector('a').getAttribute('href')).toBe(app.licenseUrl);
    expect(copyright.querySelector('.about-action')).toBeNull();
    if (!APP_INFO.appWebsite) expect(links.some((link) => link.textContent?.includes('Project website'))).toBe(false);
  });

  it('shows a described speech-bubble tooltip with the destination on focus, and dismisses it with Escape', async () => {
    await list();
    const link = fixture.nativeElement.querySelector('.about-action') as HTMLAnchorElement;
    link.dispatchEvent(new Event('focus'));
    const tooltip = fixture.nativeElement.querySelector('[role="tooltip"]') as HTMLElement;
    expect(link.getAttribute('aria-describedby')).toBe(tooltip.id);
    expect(tooltip.textContent).toContain("Author's website. Available in hu | en | ro | de.");
    expect(tooltip.textContent).toContain(APP_INFO.authorWebsite);
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    link.dispatchEvent(escape);
    expect(escape.defaultPrevented).toBe(true);
    expect(fixture.nativeElement.querySelector('[role="tooltip"]')).toBeNull();
    expect(link.hasAttribute('aria-describedby')).toBe(false);
    http.expectNone((request) => request.method !== 'GET');
  });

  it('replaces a hovered tooltip on another link focus and removes it when About closes', async () => {
    await list();
    const dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    const website = dialog.querySelector('.about-action') as HTMLAnchorElement;
    const support = dialog.querySelector('.about-support-actions a:last-child') as HTMLAnchorElement;
    website.dispatchEvent(new Event('mouseenter'));
    expect(dialog.querySelector('[role="tooltip"]')?.textContent).toContain(APP_INFO.authorWebsite);
    support.dispatchEvent(new Event('focus'));
    expect(dialog.querySelectorAll('[role="tooltip"]')).toHaveLength(1);
    expect(dialog.querySelector('[role="tooltip"]')?.textContent).toContain(APP_INFO.authorWaysToSupportUrl);
    expect(website.hasAttribute('aria-describedby')).toBe(false);
    dialog.dispatchEvent(new Event('close'));
    expect(dialog.querySelector('[role="tooltip"]')).toBeNull();
    expect(support.hasAttribute('aria-describedby')).toBe(false);
  });

  it('opens and closes native About from the navbar without changing an editable task draft', async () => {
    await list();
    app.startCreate();
    app.form.controls.title.setValue('Keep this unfinished draft');
    fixture.detectChanges();
    const dialog = fixture.nativeElement.querySelector('dialog');
    const showModal = vi.fn();
    const close = vi.fn();
    Object.defineProperties(dialog, { showModal: { value: showModal }, close: { value: close } });
    fixture.nativeElement.querySelector('.nav-about').click();
    expect(showModal).toHaveBeenCalledOnce();
    fixture.nativeElement.querySelector('.close-about').click();
    expect(close).toHaveBeenCalledOnce();
    expect(app.mode()).toBe('create');
    expect(app.form.controls.title.value).toBe('Keep this unfinished draft');
    http.expectNone((request) => request.method !== 'GET');
  });

  it('shows loading and then an empty state', async () => {
    expect(fixture.nativeElement.textContent).toContain('Loading tasks…');
    await list();
    expect(fixture.nativeElement.textContent).toContain('No tasks yet');
  });

  it('shows list errors and allows retry', async () => {
    http.expectOne('/api/tasks').flush({}, { status: 503, statusText: 'Unavailable' });
    await Promise.resolve();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Something went wrong. Please try again.');
    const pending = app.loadTasks();
    http.expectOne('/api/tasks').flush([task]);
    await pending;
    await fixture.whenStable();
    expect(app.listError()).toBe('');
    expect(fixture.nativeElement.textContent).toContain(task.title);
  });

  it('validates blank titles and whole-number time budgets without a write request', async () => {
    await list();
    app.startCreate();
    app.form.setValue({ title: '  ', description: '', days: 1.5, minutesPerDay: 30 });
    await app.saveTask();
    expect(app.form.controls.title.invalid).toBe(true);
    expect(app.form.controls.days.invalid).toBe(true);
    http.expectNone((request) => request.method === 'POST');
  });

  it('creates through the typed API service and shows saved details', async () => {
    await list();
    app.startCreate();
    app.form.setValue({ title: '  Learn TypeScript  ', description: '', days: 3, minutesPerDay: 30 });
    const pending = app.saveTask();
    expect(app.saving()).toBe(true);
    const request = http.expectOne('/api/tasks');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ title: task.title, description: null, days: 3, minutesPerDay: 30 });
    request.flush(task);
    await pending;
    await fixture.whenStable();
    expect(app.tasks()[0].id).toBe(task.id);
    expect(app.selectedTask()?.title).toBe(task.title);
    expect(fixture.nativeElement.textContent).toContain('Task created.');
  });

  it('accepts and creates a 30-day task through the form', async () => {
    await list();
    app.startCreate();
    fixture.detectChanges();
    const days = fixture.nativeElement.querySelector('#task-days') as HTMLInputElement;
    expect(days.max).toBe('30');
    days.value = '30';
    days.dispatchEvent(new Event('input', { bubbles: true }));
    app.form.controls.title.setValue('A month of practice');
    const pending = app.saveTask();
    const request = http.expectOne('/api/tasks');
    expect(request.request.body.days).toBe(30);
    request.flush({ ...task, days: 30 });
    await pending;
    expect(app.selectedTask()?.days).toBe(30);
  });

  it.each([0, 31, 1.5])('rejects invalid day count %s without sending a write', async (days) => {
    await list();
    app.startCreate();
    app.form.setValue({ title: 'Practice', description: '', days, minutesPerDay: 30 });
    await app.saveTask();
    expect(app.form.controls.days.invalid).toBe(true);
    http.expectNone((request) => request.method === 'POST');
  });

  it('updates a task to 30 days before plan acceptance', async () => {
    await select();
    app.startEdit();
    app.form.controls.days.setValue(30);
    const pending = app.saveTask();
    const request = http.expectOne(`/api/tasks/${task.id}`);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body.days).toBe(30);
    request.flush({ ...task, days: 30 });
    await pending;
    expect(app.selectedTask()?.days).toBe(30);
  });

  it('renders all 30 saved days and 60 completion controls', async () => {
    const current = { ...task, days: 30, progress: { total: 60, completed: 0, percent: 0 }, subtasks: Array.from({ length: 60 }, (_, order) => ({
      id: `step-${order}`, taskId: task.id, title: `Session ${order + 1}`, estimatedMinutes: 10,
      day: Math.floor(order / 2) + 1, order, completed: false,
    })) };
    await select(current);
    expect(app.dailyPlan()).toHaveLength(30);
    expect(app.dailyPlan().every((day) => day.minutes === 20)).toBe(true);
    expect(fixture.nativeElement.querySelectorAll('.subtask input')).toHaveLength(60);
    expect(fixture.nativeElement.textContent).toContain('Day 30');
  });

  it('keeps the draft and existing data when saving fails', async () => {
    await select();
    app.startEdit();
    app.form.controls.title.setValue('My edited draft');
    const pending = app.saveTask();
    http.expectOne(`/api/tasks/${task.id}`).flush({ message: ['title: rejected'] }, { status: 400, statusText: 'Bad Request' });
    await pending;
    await fixture.whenStable();
    expect(app.mode()).toBe('edit');
    expect(app.form.controls.title.value).toBe('My edited draft');
    expect(app.tasks()[0].title).toBe(task.title);
    expect(fixture.nativeElement.textContent).toContain('title: rejected');
  });

  it('updates a selected task and can clear its description', async () => {
    await select();
    app.startEdit();
    app.form.controls.title.setValue('Updated task');
    const pending = app.saveTask();
    const request = http.expectOne(`/api/tasks/${task.id}`);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body.description).toBeNull();
    request.flush({ ...task, title: 'Updated task' });
    await pending;
    expect(app.tasks()[0].title).toBe('Updated task');
    expect(app.notice()).toBe('Task updated.');
  });

  it('shows detail loading and a missing-record error', async () => {
    await list([task]);
    const pending = app.selectTask(task.id);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Loading task…');
    http.expectOne(`/api/tasks/${task.id}`).flush({ message: 'Task not found.' }, { status: 404, statusText: 'Not Found' });
    await pending;
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Task not found.');
  });

  it('ignores a stale detail response after a different selection', async () => {
    await list([task]);
    const first = app.selectTask(task.id);
    const firstRequest = http.expectOne(`/api/tasks/${task.id}`);
    const other = { ...task, id: '651b04c3-afb5-49e0-827d-a273be3c354e', title: 'Other task' };
    const second = app.selectTask(other.id);
    http.expectOne(`/api/tasks/${other.id}`).flush(other);
    await second;
    firstRequest.flush(task);
    await first;
    expect(app.selectedTask()?.id).toBe(other.id);
  });

  it('requires confirmation and removes a task only after DELETE succeeds', async () => {
    await select();
    await app.deleteTask();
    http.expectNone((request) => request.method === 'DELETE');
    app.confirmingDelete.set(true);
    const pending = app.deleteTask();
    const request = http.expectOne(`/api/tasks/${task.id}`);
    expect(request.request.method).toBe('DELETE');
    expect(app.tasks()).toHaveLength(1);
    request.flush(null, { status: 204, statusText: 'No Content' });
    await pending;
    expect(app.tasks()).toHaveLength(0);
    expect(app.selectedTask()).toBeNull();
    expect(app.notice()).toBe('Task deleted.');
  });

  it('keeps the task visible and shows a delete failure', async () => {
    await select();
    app.confirmingDelete.set(true);
    const pending = app.deleteTask();
    http.expectOne(`/api/tasks/${task.id}`).flush({}, { status: 500, statusText: 'Error' });
    await pending;
    await fixture.whenStable();
    expect(app.tasks()).toHaveLength(1);
    expect(app.selectedTask()?.id).toBe(task.id);
    expect(fixture.nativeElement.textContent).toContain('Something went wrong. Please try again.');
  });

  it('displays the saved daily plan and releases the parent save state', async () => {
    await select();
    app.planSaving.set(true);
    app.acceptSavedPlan(savedTask);
    await fixture.whenStable();
    expect(app.busy()).toBe(false);
    expect(app.dailyPlan().map((day) => day.minutes)).toEqual([30, 30]);
    expect(fixture.nativeElement.querySelectorAll('.subtask input')).toHaveLength(3);
    expect(fixture.nativeElement.querySelector('app-plan-preview')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('0 / 3 steps complete · 0%');
  });

  it('changes checkbox and list/detail progress only after the server accepts completion', async () => {
    await select(savedTask);
    const checkbox = fixture.nativeElement.querySelector('.subtask input') as HTMLInputElement;
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change', { bubbles: true }));
    const request = http.expectOne(`/api/subtasks/${savedTask.subtasks[0].id}`);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ completed: true });
    expect(checkbox.checked).toBe(false);
    expect(app.selectedTask()?.progress.percent).toBe(0);
    request.flush({ ...savedTask, progress: { total: 3, completed: 1, percent: 33 }, subtasks: savedTask.subtasks.map((step, index) => ({ ...step, completed: index === 0 })) });
    await fixture.whenStable();
    expect(checkbox.checked).toBe(true);
    expect(app.tasks()[0].progress.percent).toBe(33);
    expect(app.selectedTask()?.progress.percent).toBe(33);
    expect(app.busy()).toBe(false);
  });

  it('keeps persisted completion and enables retry after a failed checkbox update', async () => {
    await select(savedTask);
    const checkbox = fixture.nativeElement.querySelector('.subtask input') as HTMLInputElement;
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change', { bubbles: true }));
    http.expectOne(`/api/subtasks/${savedTask.subtasks[0].id}`).flush({}, { status: 500, statusText: 'Error' });
    await fixture.whenStable();
    expect(checkbox.checked).toBe(false);
    expect(app.selectedTask()?.subtasks[0].completed).toBe(false);
    expect(app.busy()).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Something went wrong. Please try again.');
  });

  it('can mark a completed step incomplete again', async () => {
    const completed = { ...savedTask, progress: { total: 3, completed: 1, percent: 33 }, subtasks: savedTask.subtasks.map((step, index) => ({ ...step, completed: index === 0 })) };
    await select(completed);
    const checkbox = fixture.nativeElement.querySelector('.subtask input') as HTMLInputElement;
    checkbox.checked = false;
    checkbox.dispatchEvent(new Event('change', { bubbles: true }));
    const request = http.expectOne(`/api/subtasks/${savedTask.subtasks[0].id}`);
    expect(request.request.body).toEqual({ completed: false });
    request.flush(savedTask);
    await fixture.whenStable();
    expect(checkbox.checked).toBe(false);
    expect(app.tasks()[0].progress.percent).toBe(0);
  });

  it('locks saved-plan budgets while allowing title/description edits', async () => {
    await select(savedTask);
    app.startEdit();
    expect(app.form.controls.days.disabled).toBe(true);
    expect(app.form.controls.minutesPerDay.disabled).toBe(true);
    expect(app.form.controls.title.enabled).toBe(true);
    app.cancelForm();
    app.startCreate();
    expect(app.form.controls.days.enabled).toBe(true);
    expect(app.form.controls.minutesPerDay.enabled).toBe(true);
  });
});
