import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { CartProvider } from './cart/CartContext.jsx';
import Layout from './components/Layout.jsx';
import { lazyPage } from './lazyPage.js';
import { routes } from './router.jsx';

const LAZY = Symbol.for('react.lazy');

// The test setup preloads every page (src/test/setup.js), so most tests never see a page
// load. These use pages of their own that have not been loaded yet.
function renderInLayout(path, children) {
  const router = createMemoryRouter(
    [{ path: '/', element: <CartProvider><Layout /></CartProvider>, children }],
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
}

describe('lazy pages', () => {
  it('every route in the router is a lazily loaded page', () => {
    const pages = routes[0].children.map((route) => route.element.type);
    expect(pages.length).toBeGreaterThan(10);
    for (const page of pages) expect(page.$$typeof).toBe(LAZY);
  });

  it('keeps the header and footer up while the page loads, then shows it', async () => {
    let finish;
    const Page = lazyPage(
      () => new Promise((resolve) => (finish = () => resolve({ default: () => <h1>Loaded page</h1> }))),
    );
    renderInLayout('/', [{ index: true, element: <Page /> }]);

    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Loaded page' })).not.toBeInTheDocument();

    finish();
    expect(await screen.findByRole('heading', { name: 'Loaded page' })).toBeInTheDocument();
  });

  it('loads the module once, however often it is preloaded or shown', async () => {
    const load = vi.fn(async () => ({ default: () => <p>Once</p> }));
    const Page = lazyPage(load);
    await Page.preload();
    await Page.preload();
    renderInLayout('/', [{ index: true, element: <Page /> }]);
    expect(screen.getByText('Once')).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('renders the real quiz page once its code arrives', async () => {
    const Quiz = lazyPage(() => import('./pages/Quiz.jsx'));
    renderInLayout('/quiz', [{ path: 'quiz', element: <Quiz /> }]);
    const main = within(screen.getByRole('main'));
    expect(await main.findByRole('heading', { level: 1, name: 'Find your cup' })).toBeInTheDocument();
  });

  it('renders the real home page once its code arrives', async () => {
    const Home = lazyPage(() => import('./pages/Home.jsx'));
    renderInLayout('/', [{ index: true, element: <Home /> }]);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'A little haven in every cup.' }),
    ).toBeInTheDocument();
  });
});
