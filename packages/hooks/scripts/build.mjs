import { build } from 'esbuild';
import { rmSync } from 'fs';

rmSync('dist', { recursive: true, force: true });

const shared = {
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outdir: 'dist',
};

await Promise.all([
  build({ ...shared, entryPoints: ['src/cc-capture.ts'] }),
  build({ ...shared, entryPoints: ['src/cc-nudge.ts'] }),
  build({ ...shared, entryPoints: ['src/install.ts'] }),
]);
