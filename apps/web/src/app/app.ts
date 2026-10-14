// SPDX-FileCopyrightText: 2026 Keresztes Zsolt <https://kereszteszsolt.hu>
// SPDX-License-Identifier: Apache-2.0

import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal, type OnInit } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators, type AbstractControl, type ValidationErrors } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { TasksApiService, type Task, type TaskDetail } from './tasks-api.service';
import { PlanPreviewComponent } from './plan-preview/plan-preview';

function integer(control: AbstractControl): ValidationErrors | null {
  return Number.isInteger(control.value) ? null : { integer: true };
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [DatePipe, ReactiveFormsModule, PlanPreviewComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  private readonly api = inject(TasksApiService);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private selectionVersion = 0;

  readonly tasks = signal<Task[]>([]);
  readonly selectedId = signal<string | null>(null);
  readonly selectedTask = signal<TaskDetail | null>(null);
  readonly loading = signal(true);
  readonly detailLoading = signal(false);
  readonly saving = signal(false);
  readonly deleting = signal(false);
  readonly listError = signal('');
  readonly detailError = signal('');
  readonly formError = signal('');
  readonly notice = signal('');
  readonly mode = signal<'idle' | 'create' | 'edit'>('idle');
  readonly confirmingDelete = signal(false);
  readonly busy = computed(() => this.saving() || this.deleting());
  readonly form = this.formBuilder.group({
    title: ['', [Validators.required, Validators.maxLength(160)]],
    description: ['', Validators.maxLength(2000)],
    days: [3, [Validators.required, Validators.min(1), Validators.max(14), integer]],
    minutesPerDay: [30, [Validators.required, Validators.min(15), Validators.max(240), integer]],
  });

  ngOnInit(): void {
    void this.loadTasks();
  }

  async loadTasks(): Promise<void> {
    this.loading.set(true);
    this.listError.set('');
    try {
      const tasks = await firstValueFrom(this.api.list());
      this.tasks.set(tasks);
      if (this.selectedId() && !tasks.some((task) => task.id === this.selectedId())) {
        this.selectedId.set(null);
        this.selectedTask.set(null);
        this.selectionVersion++;
        this.detailLoading.set(false);
        this.detailError.set('');
      }
    } catch (error) {
      this.listError.set(this.api.errorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

  async selectTask(id: string): Promise<void> {
    if (this.busy() || this.mode() !== 'idle') return;
    const version = ++this.selectionVersion;
    this.selectedId.set(id);
    this.selectedTask.set(null);
    this.detailLoading.set(true);
    this.detailError.set('');
    this.notice.set('');
    this.confirmingDelete.set(false);
    try {
      const task = await firstValueFrom(this.api.get(id));
      if (version === this.selectionVersion) this.selectedTask.set(task);
    } catch (error) {
      if (version === this.selectionVersion) this.detailError.set(this.api.errorMessage(error));
    } finally {
      if (version === this.selectionVersion) this.detailLoading.set(false);
    }
  }

  startCreate(): void {
    if (this.loading() || this.busy() || this.mode() !== 'idle') return;
    this.selectionVersion++;
    this.selectedId.set(null);
    this.selectedTask.set(null);
    this.detailLoading.set(false);
    this.detailError.set('');
    this.formError.set('');
    this.notice.set('');
    this.confirmingDelete.set(false);
    this.form.reset({ title: '', description: '', days: 3, minutesPerDay: 30 });
    this.mode.set('create');
  }

  startEdit(): void {
    const task = this.selectedTask();
    if (!task || this.busy()) return;
    this.form.reset({
      title: task.title,
      description: task.description ?? '',
      days: task.days,
      minutesPerDay: task.minutesPerDay,
    });
    this.formError.set('');
    this.notice.set('');
    this.confirmingDelete.set(false);
    this.mode.set('edit');
  }

  cancelForm(): void {
    if (this.busy()) return;
    this.mode.set('idle');
    this.formError.set('');
  }

  async saveTask(): Promise<void> {
    if (this.busy() || this.mode() === 'idle') return;
    this.form.markAllAsTouched();
    const value = this.form.getRawValue();
    const title = value.title.trim();
    if (!title) this.form.controls.title.setErrors({ required: true });
    if (this.form.invalid) return;
    const input = { ...value, title, description: value.description.trim() || null };
    const id = this.selectedId();
    const editing = this.mode() === 'edit';
    if (editing && !id) return;
    this.saving.set(true);
    this.formError.set('');
    this.notice.set('');
    try {
      const task = await firstValueFrom(editing && id ? this.api.update(id, input) : this.api.create(input));
      this.tasks.update((tasks) => [task, ...tasks.filter((item) => item.id !== task.id)]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id)));
      this.selectedId.set(task.id);
      this.selectedTask.set(task);
      this.mode.set('idle');
      this.notice.set(editing ? 'Task updated.' : 'Task created.');
    } catch (error) {
      this.formError.set(this.api.errorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }

  async deleteTask(): Promise<void> {
    const id = this.selectedId();
    if (!id || !this.confirmingDelete() || this.busy()) return;
    this.deleting.set(true);
    this.detailError.set('');
    this.notice.set('');
    try {
      await firstValueFrom(this.api.delete(id));
      this.tasks.update((tasks) => tasks.filter((task) => task.id !== id));
      this.selectedId.set(null);
      this.selectedTask.set(null);
      this.confirmingDelete.set(false);
      this.notice.set('Task deleted.');
    } catch (error) {
      this.detailError.set(this.api.errorMessage(error));
    } finally {
      this.deleting.set(false);
    }
  }

}
