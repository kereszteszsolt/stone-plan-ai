// SPDX-FileCopyrightText: 2026 Keresztes Zsolt <https://kereszteszsolt.hu>
// SPDX-License-Identifier: Apache-2.0

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PlanPreviewComponent } from './plan-preview';
import type { PlanPreview, TaskDetail } from '../tasks-api.service';

const task: TaskDetail = {
  id: '4206c355-753b-44ab-852b-818e538ff1cb', title: 'Learn TypeScript', description: null,
  days: 2, minutesPerDay: 30, createdAt: '2026-10-14T12:00:00Z', updatedAt: '2026-10-14T12:00:00Z', subtasks: [],
  progress: { total: 0, completed: 0, percent: 0 },
};
const preview: PlanPreview = { subtasks: [
  { title: 'Review syntax', estimatedMinutes: 10, day: 1, order: 0 },
  { title: 'Write typed functions', estimatedMinutes: 20, day: 1, order: 1 },
  { title: 'Practice with a program', estimatedMinutes: 30, day: 2, order: 2 },
] };
const url = `/api/tasks/${task.id}/plan-preview`;

describe('Unsaved plan preview', () => {
  let fixture: ComponentFixture<PlanPreviewComponent>;
  let component: PlanPreviewComponent;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [PlanPreviewComponent], providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PlanPreviewComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('task', task);
    fixture.detectChanges();
  });
  afterEach(() => { http.verify(); });

  async function generate(): Promise<void> {
    const pending = component.generate();
    const request = http.expectOne(url);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({});
    request.flush(preview);
    await pending;
    await fixture.whenStable();
  }

  it('generates only on an explicit request and prevents duplicate in-flight requests', async () => {
    http.expectNone(url);
    const pending = component.generate();
    const request = http.expectOne(url);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Waiting for the model…');
    await component.generate();
    http.expectNone(url);
    request.flush(preview);
    await pending;
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Unsaved preview');
    expect(component.scheduled().map((step) => step.day)).toEqual([1, 1, 2]);
    expect(component.generating()).toBe(false);
  });

  it('allows native title/estimate editing without any save request', async () => {
    await generate();
    const title = fixture.nativeElement.querySelector('#step-title-0') as HTMLInputElement;
    title.value = 'My revised step';
    title.dispatchEvent(new Event('input', { bubbles: true }));
    const estimate = fixture.nativeElement.querySelector('#step-minutes-0') as HTMLInputElement;
    estimate.value = '11';
    estimate.dispatchEvent(new Event('input', { bubbles: true }));
    expect(component.steps.at(0).getRawValue()).toEqual({ title: 'My revised step', estimatedMinutes: 11 });
    expect(component.totalMinutes()).toBe(61);
    http.expectNone((request) => request.method !== 'GET');
  });

  it('renders, edits and explicitly accepts a full 30-day preview with 60 steps', async () => {
    fixture.componentRef.setInput('task', { ...task, days: 30 });
    fixture.detectChanges();
    const subtasks = Array.from({ length: 60 }, (_, order) => ({ title: `Session ${order + 1}`, estimatedMinutes: 10, day: Math.floor(order / 2) + 1, order }));
    const pending = component.generate();
    http.expectOne(url).flush({ subtasks });
    await pending;
    await fixture.whenStable();
    expect(component.steps.length).toBe(60);
    expect(fixture.nativeElement.textContent).toContain('30-day plan');
    expect(fixture.nativeElement.textContent).toContain('Generated day 30');
    const lastTitle = fixture.nativeElement.querySelector('#step-title-59') as HTMLInputElement;
    lastTitle.value = 'Final review';
    lastTitle.dispatchEvent(new Event('input', { bubbles: true }));
    http.expectNone((request) => request.url.endsWith('/plan'));
    component.requestSave();
    expect(component.confirmingSave()).toBe(true);
    const saving = component.confirmSave();
    const request = http.expectOne(`/api/tasks/${task.id}/plan`);
    expect(request.request.body.subtasks).toHaveLength(60);
    expect(request.request.body.subtasks[59]).toEqual({ title: 'Final review', estimatedMinutes: 10 });
    expect(request.request.body.subtasks.every((step: object) => !('day' in step) && !('order' in step))).toBe(true);
    request.flush({ ...task, days: 30 });
    await saving;
    expect(component.error()).toBe('');
  });

  it('flags invalid step values and excess edited total time', async () => {
    await generate();
    component.steps.at(0).controls.title.setValue('   ');
    component.steps.at(0).controls.estimatedMinutes.setValue(1.5);
    expect(component.form.invalid).toBe(true);
    component.steps.at(0).controls.title.setValue('Valid title');
    component.steps.at(0).controls.estimatedMinutes.setValue(30);
    expect(component.overBudget()).toBe(true);
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('These estimates exceed your total time budget.');
  });

  it.each([
    [503, 'OLLAMA_UNAVAILABLE', 'The local model is offline. Start Ollama and try again.'],
    [504, 'OLLAMA_TIMEOUT', 'The local model took too long. Try again.'],
    [502, 'INVALID_AI_OUTPUT', 'The local model returned an invalid plan. Try again.'],
    [422, 'PLAN_EXCEEDS_BUDGET', 'The plan does not fit your time budget. Try again.'],
    [503, 'AI_PROVIDER_NOT_CONFIGURED', 'Set the backend AI_PROVIDER to ollama or openrouter.'],
    [503, 'OPENROUTER_NOT_CONFIGURED', 'Configure the backend OpenRouter key and model.'],
    [503, 'OPENROUTER_ACCESS_DENIED', 'OpenRouter denied this request. Check the backend API key.'],
    [503, 'OPENROUTER_CREDITS_REQUIRED', 'OpenRouter has insufficient credits. Check the account balance.'],
    [503, 'OPENROUTER_MODEL_UNSUPPORTED', 'Check the model structured-output support.'],
    [503, 'OPENROUTER_RATE_LIMITED', 'OpenRouter is rate limited. Wait a moment, then try again.'],
    [503, 'OPENROUTER_UNAVAILABLE', 'OpenRouter is unavailable. Try again.'],
    [504, 'OPENROUTER_TIMEOUT', 'OpenRouter took too long. Try again.'],
    [502, 'OPENROUTER_OUTPUT_TRUNCATED', 'The model reached its output token limit. Increase the limit, then try again.'],
  ])('explains model/plan failure %s and allows retry', async (status, code, message) => {
    const pending = component.generate();
    http.expectOne(url).flush({ code, message }, { status, statusText: 'Error' });
    await pending;
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain(message);
    expect(component.generating()).toBe(false);
    await generate();
    expect(component.error()).toBe('');
    expect(component.scheduled()).toHaveLength(3);
  });

  it.each([
    [502, 'INVALID_AI_OUTPUT'], [503, 'OPENROUTER_RATE_LIMITED'],
  ])('preserves edited preview data after %s/%s, and replaces it on success', async (status, code) => {
    await generate();
    component.steps.at(0).controls.title.setValue('Keep this draft');
    const pending = component.generate();
    http.expectOne(url).flush({ code, message: 'Unable to generate. Try again.' }, { status, statusText: 'Error' });
    await pending;
    expect(component.steps.at(0).controls.title.value).toBe('Keep this draft');
    await generate();
    expect(component.steps.at(0).controls.title.value).toBe(preview.subtasks[0].title);
  });

  it('keeps unknown server failures generic instead of displaying private details', async () => {
    const pending = component.generate();
    http.expectOne(url).flush({ code: 'OPENROUTER_PRIVATE_DETAIL', message: 'private provider response' }, { status: 503, statusText: 'Error' });
    await pending;
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Something went wrong. Please try again.');
    expect(fixture.nativeElement.textContent).not.toContain('private provider response');
  });

  it('discards a preview without a persistence request', async () => {
    await generate();
    component.discard();
    expect(component.steps.length).toBe(0);
    expect(component.scheduled()).toHaveLength(0);
    http.expectNone((request) => request.method !== 'GET');
  });

  it('ignores a late response after its task input changes', async () => {
    const pending = component.generate();
    const request = http.expectOne(url);
    fixture.componentRef.setInput('task', { ...task, id: '651b04c3-afb5-49e0-827d-a273be3c354e' });
    fixture.detectChanges();
    request.flush(preview);
    await pending;
    expect(component.scheduled()).toHaveLength(0);
  });

  it('cancels a pending HTTP request when leaving the task view', async () => {
    const pending = component.generate();
    const request = http.expectOne(url);
    fixture.destroy();
    await pending;
    expect(request.cancelled).toBe(true);
  });

  it('saves edited titles/estimates only after explicit confirmation and prevents duplicate requests', async () => {
    await generate();
    component.steps.at(0).controls.title.setValue('  My accepted step  ');
    component.steps.at(0).controls.estimatedMinutes.setValue(5);
    component.requestSave();
    http.expectNone(`/api/tasks/${task.id}/plan`);
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Confirm and save');
    const saved: TaskDetail = { ...task, subtasks: preview.subtasks.map((step, order) => ({
      ...step, id: `saved-${order}`, taskId: task.id, completed: false,
      ...(order === 0 ? { title: 'My accepted step', estimatedMinutes: 5 } : {}),
    })), progress: { total: 3, completed: 0, percent: 0 } };
    let emitted: TaskDetail | undefined;
    component.saved.subscribe((value) => { emitted = value; });
    const pending = component.confirmSave();
    const request = http.expectOne(`/api/tasks/${task.id}/plan`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ subtasks: [
      { title: 'My accepted step', estimatedMinutes: 5 },
      { title: 'Write typed functions', estimatedMinutes: 20 },
      { title: 'Practice with a program', estimatedMinutes: 30 },
    ] });
    await component.confirmSave();
    http.expectNone(`/api/tasks/${task.id}/plan`);
    request.flush(saved);
    await pending;
    expect(emitted).toEqual(saved);
    expect(component.saving()).toBe(false);
  });

  it('keeps edits when confirmation is cancelled and refuses save without confirmation', async () => {
    await generate();
    component.steps.at(0).controls.title.setValue('Keep my edit');
    component.requestSave();
    component.confirmingSave.set(false);
    await component.confirmSave();
    expect(component.steps.at(0).controls.title.value).toBe('Keep my edit');
    http.expectNone(`/api/tasks/${task.id}/plan`);
  });

  it('refuses to confirm an invalid or over-budget edited plan', async () => {
    await generate();
    component.steps.at(0).controls.title.setValue(' ');
    component.requestSave();
    expect(component.confirmingSave()).toBe(false);
    component.steps.at(0).controls.title.setValue('Valid');
    component.steps.at(0).controls.estimatedMinutes.setValue(30);
    component.requestSave();
    expect(component.confirmingSave()).toBe(false);
    http.expectNone(`/api/tasks/${task.id}/plan`);
  });

  it.each([400, 409, 422, 500])('keeps the edited draft and releases busy state after a failed save (%s)', async (status) => {
    await generate();
    component.steps.at(0).controls.title.setValue('Keep this draft');
    const busy: boolean[] = [];
    component.savingChange.subscribe((value) => busy.push(value));
    component.requestSave();
    const pending = component.confirmSave();
    http.expectOne(`/api/tasks/${task.id}/plan`).flush({ message: 'Save rejected.' }, { status, statusText: 'Error' });
    await pending;
    expect(component.steps.at(0).controls.title.value).toBe('Keep this draft');
    expect(component.error()).toBeTruthy();
    expect(component.confirmingSave()).toBe(false);
    expect(busy).toEqual([true, false]);
  });
});
