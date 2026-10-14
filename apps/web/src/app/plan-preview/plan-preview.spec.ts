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
    expect(fixture.nativeElement.textContent).toContain('Waiting for the local model…');
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

  it('preserves edited preview data if regeneration fails, and replaces it on success', async () => {
    await generate();
    component.steps.at(0).controls.title.setValue('Keep this draft');
    const pending = component.generate();
    http.expectOne(url).flush({ code: 'INVALID_AI_OUTPUT', message: 'Invalid plan. Try again.' }, { status: 502, statusText: 'Error' });
    await pending;
    expect(component.steps.at(0).controls.title.value).toBe('Keep this draft');
    await generate();
    expect(component.steps.at(0).controls.title.value).toBe(preview.subtasks[0].title);
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
});
