import { describe, it, expect } from 'vitest';
import { buildOrderEmail } from './webhook.js';

const mockSession = {
  customer_details: {
    name: 'Jane Doe',
    email: 'jane@example.com',
  },
  shipping_details: {
    address: {
      line1: '123 Main St',
      line2: 'Apt 4',
      city: 'Portland',
      state: 'OR',
      postal_code: '97201',
    },
  },
  amount_total: 2500,
  line_items: {
    data: [
      {
        description: "Sipper's Whisper Espresso Blend",
        quantity: 2,
      },
    ],
  },
};

describe('buildOrderEmail', () => {
  it('includes customer name in subject', () => {
    const { subject } = buildOrderEmail(mockSession);
    expect(subject).toBe("New Order — Jane Doe");
  });

  it('includes customer name and email in body', () => {
    const { text } = buildOrderEmail(mockSession);
    expect(text).toContain('Jane Doe');
    expect(text).toContain('jane@example.com');
  });

  it('converts amount from cents to dollars', () => {
    const { text } = buildOrderEmail(mockSession);
    expect(text).toContain('$25.00');
  });

  it('includes full shipping address', () => {
    const { text } = buildOrderEmail(mockSession);
    expect(text).toContain('123 Main St');
    expect(text).toContain('Apt 4');
    expect(text).toContain('Portland, OR 97201');
  });

  it('includes item name and quantity', () => {
    const { text } = buildOrderEmail(mockSession);
    expect(text).toContain("Sipper's Whisper Espresso Blend");
    expect(text).toContain('x2');
  });

  it('shows "No address provided" when shipping_details is null', () => {
    const session = { ...mockSession, shipping_details: null };
    const { text } = buildOrderEmail(session);
    expect(text).toContain('No address provided');
  });

  it('omits line2 from address when null', () => {
    const session = {
      ...mockSession,
      shipping_details: {
        address: {
          line1: '456 Oak Ave',
          line2: null,
          city: 'Seattle',
          state: 'WA',
          postal_code: '98101',
        },
      },
    };
    const { text } = buildOrderEmail(session);
    expect(text).toContain('456 Oak Ave');
    expect(text).toContain('Seattle, WA 98101');
    expect(text).not.toContain('null');
  });
});
