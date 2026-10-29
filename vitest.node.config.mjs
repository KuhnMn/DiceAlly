import { defineConfig } from 'vitest/config';
import { testCatalog } from './scripts/test-catalog.mjs';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: process.env.DICEALLY_TEST_FILES ? JSON.parse(process.env.DICEALLY_TEST_FILES) : testCatalog().filter(test => test.runner === 'unit').map(test => test.file),
    setupFiles: ['./scripts/test-node-setup.ts'],
    // Share the expensive, immutable schema modules inside this one Node process.
    isolate: false,
    fileParallelism: false,
    maxWorkers: 1,
  },
});
