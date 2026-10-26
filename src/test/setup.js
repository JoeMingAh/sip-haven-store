// Setup for the jsdom test project (see vite.config.js): every test file under src/.
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeAll, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// The pages load lazily (src/router.jsx), so the first render of a page would show the
// loading placeholder. Fetch them all up front, so a test can render a route and look at
// the page straight away. This runs after the test file's own imports and vi.mock
// calls, so the pages loaded here are the ones the test uses. src/lazyPage.test.jsx
// checks the lazy loading itself on a fresh copy of the router.
beforeAll(async () => {
  const { preloadPages } = await import('../lazyPage.js');
  await import('../router.jsx');
  await preloadPages();
});

// jsdom does not implement scrolling, and React Router's ScrollRestoration calls
// window.scrollTo on every navigation. Stub it so tests stay quiet.
window.scrollTo = vi.fn();

// Vitest runs without globals here, so Testing Library cannot register its own
// automatic cleanup. Unmount whatever the test rendered.
afterEach(() => {
  cleanup();
});
