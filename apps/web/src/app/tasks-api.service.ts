// SPDX-FileCopyrightText: 2026 Keresztes Zsolt <https://kereszteszsolt.hu>
// SPDX-License-Identifier: Apache-2.0

import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

export interface TaskInput {
  title: string;
  description: string | null;
  days: number;
  minutesPerDay: number;
}

export interface Task extends TaskInput {
  id: string;
  createdAt: string;
  updatedAt: string;
  progress: { total: number; completed: number; percent: number };
}

export interface Subtask {
  id: string;
  taskId: string;
  title: string;
  day: number;
  order: number;
  estimatedMinutes: number;
  completed: boolean;
}

export interface TaskDetail extends Task {
  subtasks: Subtask[];
}

export interface PlannedSubtask {
  title: string;
  estimatedMinutes: number;
  day: number;
  order: number;
}

export interface PlanPreview {
  subtasks: PlannedSubtask[];
}

@Injectable({ providedIn: 'root' })
export class TasksApiService {
  private readonly http = inject(HttpClient);
  private readonly url = '/api/tasks';

  list(): Observable<Task[]> {
    return this.http.get<Task[]>(this.url);
  }

  get(id: string): Observable<TaskDetail> {
    return this.http.get<TaskDetail>(`${this.url}/${id}`);
  }

  create(input: TaskInput): Observable<TaskDetail> {
    return this.http.post<TaskDetail>(this.url, input);
  }

  update(id: string, input: Partial<TaskInput>): Observable<TaskDetail> {
    return this.http.patch<TaskDetail>(`${this.url}/${id}`, input);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }

  generatePreview(id: string): Observable<PlanPreview> {
    return this.http.post<PlanPreview>(`${this.url}/${id}/plan-preview`, {});
  }

  savePlan(id: string, subtasks: { title: string; estimatedMinutes: number }[]): Observable<TaskDetail> {
    return this.http.post<TaskDetail>(`${this.url}/${id}/plan`, { subtasks });
  }

  setCompleted(id: string, completed: boolean): Observable<TaskDetail> {
    return this.http.patch<TaskDetail>(`/api/subtasks/${id}`, { completed });
  }

  errorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) return 'Unable to reach the server. Please try again.';
      const body: unknown = error.error;
      const aiCodes = ['OLLAMA_NOT_CONFIGURED', 'OLLAMA_UNAVAILABLE', 'OLLAMA_TIMEOUT', 'INVALID_AI_OUTPUT'];
      const aiError = body && typeof body === 'object' && 'code' in body && typeof body.code === 'string' && aiCodes.includes(body.code);
      if (error.status >= 500 && !aiError) return 'Something went wrong. Please try again.';
      if (body && typeof body === 'object' && 'message' in body) {
        if (typeof body.message === 'string') return body.message;
        if (Array.isArray(body.message) && body.message.every((item: unknown) => typeof item === 'string')) {
          return body.message.join(' ');
        }
      }
    }
    return 'Something went wrong. Please try again.';
  }
}
