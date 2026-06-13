#!/usr/bin/env node
import * as fs from 'fs';
import { loadConfig, readState } from './config';
import { pollUntilApproved } from './gate-core';

export async function runCursorGate(
  planFilePath: string,
  cwd?: string,
  homeDir?: string,
  pollIntervalMs?: number
): Promise<void> {
  const state = readState(planFilePath, homeDir);
  if (!state) return;

  const config = loadConfig(cwd, homeDir);
  const result = await pollUntilApproved(state.series_id, config, pollIntervalMs);

  if (result.approved) {
    fs.writeFileSync(planFilePath, result.content, 'utf8');
  } else if (result.reason === 'timeout') {
    process.stderr.write('[PACT] Review timed out, proceeding.\n');
  }
}

if (require.main === module) {
  const planFilePath = process.argv[2];
  if (!planFilePath) process.exit(0);
  runCursorGate(planFilePath, process.cwd()).catch(() => process.exit(0)).then(() => process.exit(0));
}
