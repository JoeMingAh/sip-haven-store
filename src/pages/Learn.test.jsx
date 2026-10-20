import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '../router.jsx';
import { GUIDES } from '../data/guides.js';

// The mocked array is the one the pages and the header read, so a test can add a
// guide to it. Nothing is in it to begin with, which is how the site ships.
vi.mock('../data/guides.js', () => ({ GUIDES: [] }));

afterEach(() => {
  GUIDES.length = 0;
});

const STEEPING = {
  slug: 'steeping-basics',
  title: 'Steeping basics',
  summary: 'How hot, how long and how much.',
  body: ['Start with fresh, cold water.', 'Warm the pot before you add the leaves.', 'Pour, then wait.'],
};
const COLD_BREW = {
  slug: 'cold-brew-at-home',
  title: 'Cold brew at home',
  summary: 'A slow, gentle way to make coffee.',
  body: ['Grind the beans coarsely.'],
};

function renderAt(path) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

const main = () => within(screen.getByRole('main'));
const heading = (name, level = 1) => main().getByRole('heading', { level, name });

describe('Learn: no guides yet', () => {
  it('has its own single h1, since the panel under it is an h2', () => {
    renderAt('/learn');
    expect(main().getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(heading('Brewing guides')).toBeInTheDocument();
  });

  it('is still inside the layout', () => {
    renderAt('/learn');
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('says guides are on the way, in a panel of its own', () => {
    renderAt('/learn');
    const panel = main().getByRole('region', { name: 'Guides are on the way' });
    expect(within(panel).getByRole('heading', { level: 2 })).toBeInTheDocument();
  });

  it('promises no date: the panel gives no timeline', () => {
    renderAt('/learn');
    const panel = main().getByRole('region', { name: 'Guides are on the way' });
    expect(panel).not.toHaveTextContent(/\d|\bsoon\b|tomorrow|\b(days?|weeks?|months?)\b/i);
  });

  it('lists no guide and links to none', () => {
    renderAt('/learn');
    expect(main().queryByRole('article')).not.toBeInTheDocument();
    const hrefs = main()
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'));
    expect(hrefs.filter((href) => href.startsWith('/learn'))).toEqual([]);
  });

  it('gives the visitor somewhere to go: the quiz, tea and coffee', () => {
    renderAt('/learn');
    expect(main().getByRole('link', { name: 'Take the quiz' })).toHaveAttribute('href', '/quiz');
    expect(main().getByRole('link', { name: 'Browse tea' })).toHaveAttribute('href', '/tea');
    expect(main().getByRole('link', { name: 'Browse coffee' })).toHaveAttribute('href', '/coffee');
  });

  it('uses the filled-button look that passes contrast: sage-deep behind cream text', () => {
    renderAt('/learn');
    expect(main().getByRole('link', { name: 'Take the quiz' })).toHaveClass('bg-sage-deep', 'text-cream');
  });

  it('has no price and nothing to add to a cart', () => {
    renderAt('/learn');
    expect(screen.getByRole('main')).not.toHaveTextContent('$');
    expect(screen.queryByText(/add to cart/i)).not.toBeInTheDocument();
  });
});

describe('Learn: the link to it', () => {
  it('is left out of the header and the footer while GUIDES is empty', () => {
    renderAt('/learn');
    expect(within(screen.getByRole('banner')).queryByRole('link', { name: 'Learn' })).not.toBeInTheDocument();
    expect(
      within(screen.getByRole('contentinfo')).queryByRole('link', { name: 'Learn' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Learn' })).not.toBeInTheDocument();
  });

  it('is left out on every other page too', () => {
    renderAt('/');
    expect(screen.queryByRole('link', { name: 'Learn' })).not.toBeInTheDocument();
  });

  it('shows up in the header and the footer once a guide exists', () => {
    GUIDES.push(STEEPING);
    renderAt('/');
    const inHeader = within(screen.getByRole('banner')).getByRole('link', { name: 'Learn' });
    const inFooter = within(screen.getByRole('contentinfo')).getByRole('link', { name: 'Learn' });
    expect(inHeader).toHaveAttribute('href', '/learn');
    expect(inFooter).toHaveAttribute('href', '/learn');
  });
});

describe('Learn: with guides', () => {
  it('lists each guide as a link to its page, with its summary', () => {
    GUIDES.push(STEEPING, COLD_BREW);
    renderAt('/learn');
    expect(main().getByRole('link', { name: 'Steeping basics' })).toHaveAttribute(
      'href',
      '/learn/steeping-basics',
    );
    expect(main().getByRole('link', { name: 'Cold brew at home' })).toHaveAttribute(
      'href',
      '/learn/cold-brew-at-home',
    );
    expect(main().getByText('How hot, how long and how much.')).toBeInTheDocument();
    expect(main().getByText('A slow, gentle way to make coffee.')).toBeInTheDocument();
  });

  it('keeps the order of GUIDES', () => {
    GUIDES.push(COLD_BREW, STEEPING);
    renderAt('/learn');
    const titles = main()
      .getAllByRole('heading', { level: 2 })
      .map((item) => item.textContent);
    expect(titles).toEqual(['Cold brew at home', 'Steeping basics']);
  });

  it('keeps the one h1 and drops the "on the way" panel', () => {
    GUIDES.push(STEEPING);
    renderAt('/learn');
    expect(main().getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(heading('Brewing guides')).toBeInTheDocument();
    expect(main().queryByRole('region', { name: 'Guides are on the way' })).not.toBeInTheDocument();
    expect(main().queryByText(/on the way/i)).not.toBeInTheDocument();
  });

  it('gives each guide a heading under the h1', () => {
    GUIDES.push(STEEPING);
    renderAt('/learn');
    const levels = main()
      .getAllByRole('heading')
      .map((item) => Number(item.tagName[1]));
    expect(levels).toEqual([1, 2]);
  });

  it('opens a guide when its link is followed', async () => {
    GUIDES.push(STEEPING);
    const router = renderAt('/learn');
    fireEvent.click(main().getByRole('link', { name: 'Steeping basics' }));
    await act(async () => {});
    expect(router.state.location.pathname).toBe('/learn/steeping-basics');
    expect(heading('Steeping basics')).toBeInTheDocument();
  });
});

describe('Guide: a slug nobody has written', () => {
  it('shows the not-found page when there are no guides at all', () => {
    renderAt('/learn/some-guide');
    expect(heading("We couldn't find that page")).toBeInTheDocument();
    expect(main().getByRole('link', { name: 'Browse tea' })).toHaveAttribute('href', '/tea');
    expect(main().getByRole('link', { name: 'Browse coffee' })).toHaveAttribute('href', '/coffee');
  });

  it('shows the not-found page for a slug that is not among the guides', () => {
    GUIDES.push(STEEPING);
    renderAt('/learn/cold-brew-at-home');
    expect(heading("We couldn't find that page")).toBeInTheDocument();
    expect(main().queryByText('Steeping basics')).not.toBeInTheDocument();
  });

  it('does not match a slug written in another case', () => {
    GUIDES.push(STEEPING);
    renderAt('/learn/Steeping-Basics');
    expect(heading("We couldn't find that page")).toBeInTheDocument();
  });

  it('does not take a word every object has for a guide', () => {
    GUIDES.push(STEEPING);
    renderAt('/learn/constructor');
    expect(heading("We couldn't find that page")).toBeInTheDocument();
  });

  it('is still inside the layout, with exactly one h1', () => {
    renderAt('/learn/some-guide');
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(main().getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });
});

describe('Guide: a guide that exists', () => {
  it('shows the title as the one h1, inside the layout', () => {
    GUIDES.push(STEEPING);
    renderAt('/learn/steeping-basics');
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(main().getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(heading('Steeping basics')).toBeInTheDocument();
  });

  it('shows the summary, then each paragraph of the body in order', () => {
    GUIDES.push(STEEPING);
    renderAt('/learn/steeping-basics');
    const paragraphs = [...screen.getByRole('article').querySelectorAll('p')].map((item) => item.textContent);
    expect(paragraphs).toEqual([STEEPING.summary, ...STEEPING.body]);
  });

  it('finds the right guide among several', () => {
    GUIDES.push(STEEPING, COLD_BREW);
    renderAt('/learn/cold-brew-at-home');
    expect(heading('Cold brew at home')).toBeInTheDocument();
    expect(main().getByText('Grind the beans coarsely.')).toBeInTheDocument();
    expect(main().queryByText('Start with fresh, cold water.')).not.toBeInTheDocument();
  });

  it('shows the body as plain text: no markdown and no markup', () => {
    GUIDES.push({
      ...STEEPING,
      body: ['**Not bold**, and a <em>tag</em> stays text.'],
    });
    renderAt('/learn/steeping-basics');
    expect(main().getByText('**Not bold**, and a <em>tag</em> stays text.')).toBeInTheDocument();
    expect(screen.getByRole('article').querySelector('em, strong')).toBeNull();
  });

  it('links back to all the guides', () => {
    GUIDES.push(STEEPING);
    renderAt('/learn/steeping-basics');
    expect(main().getByRole('link', { name: 'All guides' })).toHaveAttribute('href', '/learn');
  });

  it('keeps its text to a readable width', () => {
    GUIDES.push(STEEPING);
    renderAt('/learn/steeping-basics');
    expect(screen.getByRole('article')).toHaveClass('max-w-prose');
  });

  it('copes with a guide that has no summary or no body', () => {
    GUIDES.push({ slug: 'bare', title: 'Bare guide' });
    renderAt('/learn/bare');
    expect(heading('Bare guide')).toBeInTheDocument();
    expect(screen.getByRole('article').querySelectorAll('p')).toHaveLength(0);
  });

  it('has no price and nothing to add to a cart', () => {
    GUIDES.push(STEEPING);
    renderAt('/learn/steeping-basics');
    expect(screen.getByRole('main')).not.toHaveTextContent('$');
    expect(screen.queryByText(/add to cart/i)).not.toBeInTheDocument();
  });
});
