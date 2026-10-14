// SPDX-FileCopyrightText: 2026 Keresztes Zsolt <https://kereszteszsolt.hu>
// SPDX-License-Identifier: Apache-2.0

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from './app';
import type { TaskDetail } from './tasks-api.service';

const task: TaskDetail = {
  id: '4206c355-753b-44ab-852b-818e538ff1cb', title: 'Learn TypeScript', description: null,
  days: 3, minutesPerDay: 30, createdAt: '2026-10-14T12:00:00Z', updatedAt: '2026-10-14T12:00:00Z', subtasks: [],
};

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

  async function select(): Promise<void> {
    await list([task]);
    const pending = app.selectTask(task.id);
    http.expectOne(`/api/tasks/${task.id}`).flush(task);
    await pending;
    await fixture.whenStable();
  }

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
});
