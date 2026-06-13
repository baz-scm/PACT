import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'server',
    include: ['tests/**/*.test.ts'],
    env: {
      NODE_OPTIONS: '--disable-warning=ExperimentalWarning',
    },
  },
});
