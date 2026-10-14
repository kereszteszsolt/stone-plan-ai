// SPDX-FileCopyrightText: 2026 Keresztes Zsolt <https://kereszteszsolt.hu>
// SPDX-License-Identifier: Apache-2.0

import { BadRequestException, Body, Controller, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { PlanPreviewService } from './plan-preview.service';

@Controller('tasks')
export class PlanPreviewController {
  constructor(private readonly preview: PlanPreviewService) {}

  @Post(':id/plan-preview')
  @HttpCode(200)
  generate(@Param('id', new ParseUUIDPipe()) id: string, @Body() body: unknown) {
    if (body !== undefined && body !== null && (
      typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length
    )) {
      throw new BadRequestException('Plan generation uses the saved task. Send an empty request body.');
    }
    return this.preview.generate(id);
  }
}
