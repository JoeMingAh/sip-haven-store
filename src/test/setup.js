// Setup for the jsdom test project (see vite.config.js): every test file under src/.
import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// jsdom does not implement scrolling, and React Router's ScrollRestoration calls
// window.scrollTo on every navigation. Stub it so tests stay quiet.
window.scrollTo = vi.fn();

// Vitest runs without globals here, so Testing Library cannot register its own
// automatic cleanup. Unmount whatever the test rendered.
afterEach(() => {
  cleanup();
});
