import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import ComingSoon from './ComingSoon.jsx';

describe('ComingSoon', () => {
  let fetchMock;
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('says the first collection is brewing', () => {
    render(<ComingSoon />);
    expect(
      screen.getByRole('heading', { level: 2, name: 'Our first collection is brewing' }),
    ).toBeInTheDocument();
  });

  it('adds a short line that invites an email', () => {
    render(<ComingSoon />);
    const panel = screen.getByRole('region', { name: 'Our first collection is brewing' });
    expect(within(panel).getByText(/leave your email/i)).toBeInTheDocument();
  });

  it('has the email signup form inside the panel', () => {
    render(<ComingSoon />);
    const panel = screen.getByRole('region', { name: 'Our first collection is brewing' });
    expect(within(panel).getByLabelText('Email address')).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Join the list' })).toBeInTheDocument();
  });

  it('really signs people up', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) });
    render(<ComingSoon />);

    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'jane@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Join the list' }));

    expect(
      await screen.findByText(
        "You're on the list. We'll let you know the moment our first collection is ready.",
      ),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/subscribe');
  });

  it('shows no price and nothing to buy', () => {
    const { container } = render(<ComingSoon />);
    expect(container).not.toHaveTextContent('$');
    expect(screen.queryByText(/add to cart/i)).not.toBeInTheDocument();
  });
});
