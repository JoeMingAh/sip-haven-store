import { lazy } from 'react';

// Every page registered here, so they can all be loaded ahead of time (see preloadPages).
const pages = [];

/**
 * A page component whose code is fetched the first time it is shown, so each page only
 * loads its own JavaScript. Show it inside <Suspense> (Layout wraps the page outlet).
 *
 * `load` is a function returning import('./pages/Some.jsx'). Once the module has been
 * fetched (by showing the page or by preload()), the page renders straight away instead
 * of suspending first.
 */
export function lazyPage(load) {
  let module;
  const preload = () =>
    module ? Promise.resolve(module) : load().then((loaded) => (module = loaded));

  // React reads a thenable that has already settled without suspending, so a page that
  // was preloaded renders in the same pass.
  const Page = lazy(() => (module ? { then: (resolve) => resolve(module) } : preload()));
  Page.preload = preload;
  pages.push(Page);
  return Page;
}

/** Fetches the code of every lazy page. The tests use it so pages render synchronously. */
export function preloadPages() {
  return Promise.all(pages.map((page) => page.preload()));
}
