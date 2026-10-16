// SPDX-FileCopyrightText: 2026 Keresztes Zsolt <https://kereszteszsolt.hu>
// SPDX-License-Identifier: Apache-2.0

import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaService } from './prisma.service';
import { TasksController } from './tasks/tasks.controller';
import { TasksService } from './tasks/tasks.service';
import { PlanPreviewController } from './plan/plan-preview.controller';
import { PlanPreviewService } from './plan/plan-preview.service';
import { OllamaService } from './plan/ollama.service';
import { OpenRouterService } from './plan/openrouter.service';
import { PlanController } from './plan/plan.controller';
import { SubtasksController } from './tasks/subtasks.controller';

@Module({
  controllers: [HealthController, TasksController, PlanPreviewController, PlanController, SubtasksController],
  providers: [PrismaService, TasksService, PlanPreviewService, OllamaService, OpenRouterService],
})
export class AppModule {}
