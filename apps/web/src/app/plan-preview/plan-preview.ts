// SPDX-FileCopyrightText: 2026 Keresztes Zsolt <https://kereszteszsolt.hu>
// SPDX-License-Identifier: Apache-2.0

import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, input, signal, type OnChanges } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators, type FormControl, type FormGroup } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { TasksApiService, type PlannedSubtask, type TaskDetail } from '../tasks-api.service';

type StepForm = FormGroup<{ title: FormControl<string>; estimatedMinutes: FormControl<number> }>;

@Component({
  selector: 'app-plan-preview',
  standalone: true,
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './plan-preview.html',
  styleUrl: './plan-preview.css',
})
export class PlanPreviewComponent implements OnChanges {
  private readonly api = inject(TasksApiService);
  private readonly builder = inject(NonNullableFormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private generationVersion = 0;

  readonly task = input.required<TaskDetail>();
  readonly generating = signal(false);
  readonly error = signal('');
  readonly scheduled = signal<PlannedSubtask[]>([]);
  readonly steps = this.builder.array<StepForm>([]);
  readonly form = this.builder.group({ subtasks: this.steps });
  private readonly values = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  readonly totalMinutes = computed(() => (this.values().subtasks ?? []).reduce(
    (total, step) => total + (typeof step.estimatedMinutes === 'number' && Number.isFinite(step.estimatedMinutes) ? step.estimatedMinutes : 0), 0,
  ));
  readonly overBudget = computed(() => this.totalMinutes() > this.task().days * this.task().minutesPerDay);

  ngOnChanges(): void {
    this.generationVersion++;
    this.generating.set(false);
    this.discard();
  }

  async generate(): Promise<void> {
    if (this.generating()) return;
    const task = this.task();
    const version = ++this.generationVersion;
    this.generating.set(true);
    this.error.set('');
    try {
      const preview = await firstValueFrom(this.api.generatePreview(task.id).pipe(takeUntilDestroyed(this.destroyRef)));
      if (this.destroyRef.destroyed || version !== this.generationVersion) return;
      this.steps.clear({ emitEvent: false });
      for (const step of preview.subtasks) {
        this.steps.push(this.builder.group({
          title: [step.title, [Validators.required, Validators.pattern(/\S/), Validators.maxLength(160)]],
          estimatedMinutes: [step.estimatedMinutes, [Validators.required, Validators.min(1), Validators.max(task.minutesPerDay), Validators.pattern(/^\d+$/)]],
        }), { emitEvent: false });
      }
      this.form.updateValueAndValidity();
      this.form.markAsPristine();
      this.scheduled.set(preview.subtasks);
    } catch (error) {
      if (!this.destroyRef.destroyed && version === this.generationVersion) this.error.set(this.api.errorMessage(error));
    } finally {
      if (!this.destroyRef.destroyed && version === this.generationVersion) this.generating.set(false);
    }
  }

  discard(): void {
    if (this.generating()) return;
    this.steps.clear();
    this.scheduled.set([]);
    this.error.set('');
  }
}
