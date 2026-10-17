// SPDX-FileCopyrightText: 2026 Keresztes Zsolt <https://kereszteszsolt.hu>
// SPDX-License-Identifier: Apache-2.0

// Never inherit an opt-in remote telemetry destination during unit tests.
process.env['LANGFUSE_ENABLED'] = 'false';
