import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Footer from './Footer.jsx';
import { GUIDES } from '../data/guides.js';

// The mocked array is the one Footer reads, so a test can add a guide to it.
vi.mock('../data/guides.js', () => ({ GUIDES: [] }));

afterEach(() => {
  GUIDES.length = 0;
});

function renderFooter() {
  return render(
    <MemoryRouter>
      <Footer />
    </MemoryRouter>,
  );
}

describe('Footer', () => {
  it('links to every page a shopper can visit', () => {
    renderFooter();
    const nav = screen.getByRole('navigation', { name: 'Footer' });
    const expected = {
      Tea: '/tea',
      Coffee: '/coffee',
      Quiz: '/quiz',
      'Our Story': '/our-story',
      Contact: '/contact',
      'Shipping & Returns': '/shipping-returns',
      Privacy: '/privacy',
    };
    for (const [name, href] of Object.entries(expected)) {
      expect(within(nav).getByRole('link', { name })).toHaveAttribute('href', href);
    }
  });

  it('leaves out Learn while there are no guides', () => {
    renderFooter();
    expect(screen.queryByRole('link', { name: 'Learn' })).not.toBeInTheDocument();
  });

  it('adds Learn once a guide exists', () => {
    GUIDES.push({ slug: 'steeping-basics' });
    renderFooter();
    expect(screen.getByRole('link', { name: 'Learn' })).toHaveAttribute('href', '/learn');
  });

  it('invites an email signup', () => {
    renderFooter();
    const footer = screen.getByRole('contentinfo');
    expect(
      within(footer).getByRole('heading', { level: 2, name: 'Stay in the loop' }),
    ).toBeInTheDocument();
    expect(within(footer).getByLabelText('Email address')).toHaveAttribute('type', 'email');
    expect(within(footer).getByRole('button', { name: 'Join the list' })).toBeInTheDocument();
  });

  it('shows the brand and the current year', () => {
    renderFooter();
    const footer = screen.getByRole('contentinfo');
    expect(footer).toHaveTextContent('Sip Haven');
    expect(footer).toHaveTextContent(String(new Date().getFullYear()));
  });
});
