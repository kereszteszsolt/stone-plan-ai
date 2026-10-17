// SPDX-FileCopyrightText: 2026 Keresztes Zsolt <https://kereszteszsolt.hu>
// SPDX-License-Identifier: Apache-2.0

import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { configureGlobalLogger, LogLevel } from '@langfuse/core';
import { LangfuseSpanProcessor } from '@langfuse/otel';
import { LangfuseGeneration } from '@langfuse/tracing';
import { ROOT_CONTEXT, SpanStatusCode } from '@opentelemetry/api';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { BasicTracerProvider } from '@opentelemetry/sdk-trace-base';
import { type AiPlanCall } from './ai-call-diagnostics';

@Injectable()
export class LangfuseTracingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LangfuseTracingService.name);
  private provider?: BasicTracerProvider;
  private closing = false;

  onModuleInit(): void {
    const enabled = process.env['LANGFUSE_ENABLED'] ?? 'false';
    if (enabled === 'false') return;
    let publicKey: string;
    let secretKey: string;
    let baseUrl: string;
    try {
      publicKey = process.env['LANGFUSE_PUBLIC_KEY']?.trim() ?? '';
      secretKey = process.env['LANGFUSE_SECRET_KEY']?.trim() ?? '';
      const url = new URL(process.env['LANGFUSE_BASE_URL'] ?? '');
      if (enabled !== 'true' || !/^pk-lf-[a-z0-9_-]{1,200}$/i.test(publicKey) ||
        !/^sk-lf-[a-z0-9_-]{1,200}$/i.test(secretKey) || !['http:', 'https:'].includes(url.protocol) ||
        url.username || url.password || url.search || url.hash) throw new Error('Invalid tracing configuration');
      baseUrl = url.toString().replace(/\/+$/, '');
    } catch {
      this.logger.warn('LANGFUSE_INVALID_CONFIGURATION: tracing disabled; set LANGFUSE_ENABLED=true, valid backend keys and an explicit LANGFUSE_BASE_URL.');
      return;
    }

    try {
      // SDK debug/error messages can include raw payloads; only fixed application diagnostics are logged.
      configureGlobalLogger({ level: LogLevel.NONE });
      const processor = new LangfuseSpanProcessor({
        publicKey, secretKey, baseUrl,
        environment: 'default', release: '0.3',
        mediaUploadEnabled: false, compression: 'none',
        flushAt: 32, flushInterval: 5, timeout: 2,
        shouldExportSpan: ({ otelSpan }) => otelSpan.name === 'ai-plan-generation',
      });
      // Never register globally: HTTP, database and other libraries cannot emit into this provider.
      this.provider = new BasicTracerProvider({
        resource: resourceFromAttributes({ 'service.name': 'task-flow-ai-api' }),
        spanProcessors: [processor],
      });
    } catch {
      this.logger.warn('LANGFUSE_INITIALIZATION_FAILED: tracing disabled; plan generation remains available.');
    }
  }

  record(call: AiPlanCall): void {
    if (!this.provider || this.closing) return;
    try {
      const endTime = new Date();
      const span = this.provider.getTracer('task-flow-ai.plan').startSpan('ai-plan-generation', {
        startTime: new Date(endTime.getTime() - call.durationMs),
      }, ROOT_CONTEXT);
      const usageDetails: Record<string, number> = {};
      if (call.usage?.inputTokens !== undefined) usageDetails['input'] = call.usage.inputTokens;
      if (call.usage?.outputTokens !== undefined) usageDetails['output'] = call.usage.outputTokens;
      if (call.usage?.totalTokens !== undefined) usageDetails['total'] = call.usage.totalTokens;
      const generation = new LangfuseGeneration({ otelSpan: span, attributes: {
        model: call.model,
        level: call.outcome === 'success' ? 'DEFAULT' : 'ERROR',
        ...(call.errorCategory ? { statusMessage: call.errorCategory } : {}),
        metadata: {
          requestId: call.requestId, provider: call.provider, durationMs: call.durationMs,
          outcome: call.outcome,
          ...(call.errorCategory ? { errorCategory: call.errorCategory } : {}),
          usageStatus: Object.keys(usageDetails).length ? 'reported' : 'unknown',
        },
        ...(Object.keys(usageDetails).length ? { usageDetails } : {}),
      } });
      span.setStatus({ code: call.outcome === 'success' ? SpanStatusCode.OK : SpanStatusCode.ERROR });
      generation.end(endTime);
    } catch {
      this.logger.warn('LANGFUSE_RECORD_FAILED: telemetry dropped; plan generation is unchanged.');
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.closing = true;
    if (!this.provider) return;
    try {
      await this.provider.forceFlush();
    } catch {
      this.logger.warn('LANGFUSE_FLUSH_FAILED: pending telemetry may have been dropped.');
    }
    try {
      // Close the exporter even if flushing a batch failed. Network requests time out after two seconds.
      await this.provider.shutdown();
    } catch {
      this.logger.warn('LANGFUSE_SHUTDOWN_FAILED: pending telemetry may have been dropped.');
    }
  }
}
