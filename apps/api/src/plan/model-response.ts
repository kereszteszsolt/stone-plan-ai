// SPDX-FileCopyrightText: 2026 Keresztes Zsolt <https://kereszteszsolt.hu>
// SPDX-License-Identifier: Apache-2.0

import { BadGatewayException } from '@nestjs/common';

export const invalidAiOutput = () => new BadGatewayException({
  code: 'INVALID_AI_OUTPUT',
  message: 'The model returned an invalid plan. Try generating again.',
});

export async function readModelResponse(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) throw invalidAiOutput();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 65536) {
        await reader.cancel();
        throw invalidAiOutput();
      }
      chunks.push(chunk.value);
    }
    return Buffer.concat(chunks).toString('utf8');
  } finally {
    reader.releaseLock();
  }
}
