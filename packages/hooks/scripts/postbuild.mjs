import { readFileSync, writeFileSync, chmodSync } from 'fs';

const bins = ['dist/src/cc-capture.js', 'dist/src/cc-nudge.js', 'dist/src/install.js'];
for (const p of bins) {
  const content = readFileSync(p, 'utf8');
  if (!content.startsWith('#!')) {
    writeFileSync(p, '#!/usr/bin/env node\n' + content);
  }
  chmodSync(p, 0o755);
}
