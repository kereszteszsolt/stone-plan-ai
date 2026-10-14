// SPDX-FileCopyrightText: 2026 Keresztes Zsolt <https://kereszteszsolt.hu>
// SPDX-License-Identifier: Apache-2.0

import { HttpClient } from '@angular/common/http';
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
}
