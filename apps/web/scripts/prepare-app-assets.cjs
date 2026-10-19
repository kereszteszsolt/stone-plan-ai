// SPDX-FileCopyrightText: 2026 Keresztes Zsolt <https://kereszteszsolt.hu>
// SPDX-License-Identifier: Apache-2.0

const { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');

const source = resolve(__dirname, '../../../brand');
const output = resolve(__dirname, '../.app-info');
const metadata = readFileSync(resolve(source, 'branding.json'), 'utf8');
JSON.parse(metadata);

// Angular packages assets only from inside its workspace; brand/ remains the editable source.
rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
writeFileSync(resolve(output, 'app-info.json'), metadata);
cpSync(resolve(source, 'assets'), resolve(output, 'assets'), { recursive: true });
