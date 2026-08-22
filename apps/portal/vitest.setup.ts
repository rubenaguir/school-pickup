import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// @testing-library/react's own auto-cleanup only fires off a global `afterEach`,
// which we don't have (no `test.globals` — same explicit-import convention as
// every other *.test.ts in this repo), so it's wired here instead.
afterEach(() => {
  cleanup();
});
