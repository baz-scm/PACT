import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'hooks',
    include: ['tests/**/*.test.ts'],
  },
});
