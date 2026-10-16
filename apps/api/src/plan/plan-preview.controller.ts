// SPDX-FileCopyrightText: 2026 Keresztes Zsolt <https://kereszteszsolt.hu>
// SPDX-License-Identifier: Apache-2.0

import { BadRequestException, Body, Controller, HttpCode, Param, ParseUUIDPipe, Post, Res } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { ServerResponse } from 'node:http';
import { PlanPreviewService } from './plan-preview.service';

@Controller('tasks')
export class PlanPreviewController {
  constructor(private readonly preview: PlanPreviewService) {}

  @Post(':id/plan-preview')
  @HttpCode(200)
  generate(@Param('id', new ParseUUIDPipe()) id: string, @Body() body: unknown, @Res({ passthrough: true }) response: ServerResponse) {
    if (body !== undefined && body !== null && (
      typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length
    )) {
      throw new BadRequestException('Plan generation uses the saved task. Send an empty request body.');
    }
    const requestId = randomUUID();
    response.setHeader('X-Request-ID', requestId);
    return this.preview.generate(id, requestId);
  }
}
