// SPDX-FileCopyrightText: 2026 Keresztes Zsolt <https://kereszteszsolt.hu>
// SPDX-License-Identifier: Apache-2.0

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { configureApp } from '../src/app.config';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';

describe('API HTTP boundary', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns the liveness contract at /api/health', async () => {
    await request(app.getHttpServer())
      .get('/api/health')
      .expect('Content-Type', /json/)
      .expect(200, { status: 'ok' });
  });

  it('requires the /api prefix', async () => {
    await request(app.getHttpServer()).get('/health').expect(404);
  });

  it('does not expose task CRUD before its story', async () => {
    await request(app.getHttpServer()).get('/api/tasks').expect(404);
  });
});
