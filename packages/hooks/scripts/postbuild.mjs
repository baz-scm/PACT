import { readFileSync, writeFileSync, chmodSync } from 'fs';

const bins = ['dist/cc-capture.js', 'dist/cc-gate.js', 'dist/cc-nudge.js', 'dist/cursor-gate.js', 'dist/install.js'];
for (const p of bins) {
  const content = readFileSync(p, 'utf8');
  if (!content.startsWith('#!')) {
    writeFileSync(p, '#!/usr/bin/env node\n' + content);
  }
  chmodSync(p, 0o755);
}
