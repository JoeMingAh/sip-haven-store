# Order Notification Webhook — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send an email to `joseph@siphaven.com` every time a Stripe payment completes, containing the customer name, shipping address, items ordered, and total paid.

**Architecture:** A Vercel serverless function at `/api/webhook` receives `checkout.session.completed` events from Stripe, verifies the signature, retrieves full session details (with line items expanded), and sends a plain-text notification email via Resend. The email-building logic is extracted as a pure function so it can be unit tested without mocking Stripe or Resend.

**Tech Stack:** stripe (already installed), resend (new), Vitest (already configured)

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `api/webhook.js` | Create | Vercel serverless function — verifies Stripe signature, retrieves session, sends email |
| `api/webhook.test.js` | Create | Unit tests for `buildOrderEmail` pure function |
| `package.json` | Modify | Add resend dependency |

---

## Task 1: Install resend and write failing tests

**Files:**
- Modify: `package.json`
- Create: `api/webhook.test.js`

- [ ] **Step 1: Install resend**

  ```bash
  npm install resend
  ```

  Expected: resend added to `dependencies` in `package.json`.

- [ ] **Step 2: Create `api/webhook.test.js`**

  ```javascript
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
  ```

- [ ] **Step 3: Run tests to confirm they fail**

  ```bash
  npm test
  ```

  Expected: FAIL — `Cannot find module './webhook.js'`

- [ ] **Step 4: Commit**

  ```bash
  git add package.json package-lock.json api/webhook.test.js
  git commit -m "test: add failing tests for buildOrderEmail"
  ```

---

## Task 2: Implement api/webhook.js

**Files:**
- Create: `api/webhook.js`

- [ ] **Step 1: Create `api/webhook.js`**

  ```javascript
  import Stripe from 'stripe';
  import { Resend } from 'resend';

  // Vercel must NOT parse the body — Stripe signature verification needs raw bytes
  export const config = { api: { bodyParser: false } };

  export function buildOrderEmail(session) {
    const name = session.customer_details?.name || 'Unknown';
    const email = session.customer_details?.email || 'Unknown';
    const address = session.shipping_details?.address;

    const addressText = address
      ? [
          address.line1,
          address.line2,
          `${address.city}, ${address.state} ${address.postal_code}`,
        ]
          .filter(Boolean)
          .join('\n')
      : 'No address provided';

    const itemsText = (session.line_items?.data || [])
      .map((item) => `- ${item.description || 'Unknown item'} x${item.quantity}`)
      .join('\n');

    const total = `$${(session.amount_total / 100).toFixed(2)}`;

    return {
      subject: `New Order — ${name}`,
      text: [
        'New order received!',
        '',
        `Customer: ${name}`,
        `Email: ${email}`,
        '',
        'Shipping Address:',
        addressText,
        '',
        'Items:',
        itemsText,
        '',
        `Total: ${total}`,
      ].join('\n'),
    };
  }

  export default async function handler(req, res) {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // Collect raw body for Stripe signature verification
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const rawBody = Buffer.concat(chunks);

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    let event;
    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        req.headers['stripe-signature'],
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).json({ error: 'Invalid signature' });
    }

    if (event.type !== 'checkout.session.completed') {
      return res.status(200).json({ received: true });
    }

    const session = await stripe.checkout.sessions.retrieve(
      event.data.object.id,
      { expand: ['line_items.data.price.product'] }
    );

    const { subject, text } = buildOrderEmail(session);

    const resend = new Resend(process.env.RESEND_API_KEY);

    try {
      await resend.emails.send({
        from: 'orders@siphaven.com', // change to onboarding@resend.dev if domain not yet verified
        to: 'joseph@siphaven.com',
        subject,
        text,
      });
    } catch (err) {
      console.error('Failed to send email:', err);
      return res.status(500).json({ error: 'Failed to send notification email' });
    }

    return res.status(200).json({ received: true });
  }
  ```

- [ ] **Step 2: Run tests to confirm all 7 pass**

  ```bash
  npm test
  ```

  Expected:
  ```
  Test Files  2 passed (2)
       Tests  14 passed (14)
  ```
  (7 new webhook tests + 7 existing checkout tests)

- [ ] **Step 3: Commit**

  ```bash
  git add api/webhook.js
  git commit -m "feat: add Stripe webhook order notification via Resend"
  ```

---

## Task 3: Set up Resend, Stripe webhook, and deploy

This task is performed by the user — no code changes.

- [ ] **Step 1: Create Resend account and get API key**

  1. Go to **resend.com** → sign up with `joseph@siphaven.com`
  2. In the Resend dashboard → **API Keys** → **Create API Key**
  3. Name it `sip-haven-store`, give it **Full access**
  4. Copy the key (starts with `re_`)

- [ ] **Step 2: Verify siphaven.com domain in Resend (for orders@siphaven.com sender)**

  1. In Resend dashboard → **Domains** → **Add Domain** → enter `siphaven.com`
  2. Resend shows DNS records to add — go to GoDaddy DNS for siphaven.com and add them
  3. Wait for Resend to show the domain as **Verified** (can take a few minutes)

  > If you want to test before the domain is verified, temporarily change `from: 'orders@siphaven.com'` to `from: 'onboarding@resend.dev'` in `api/webhook.js` and redeploy. Change it back once the domain is verified.

- [ ] **Step 3: Register webhook endpoint in Stripe**

  1. Go to **dashboard.stripe.com → Developers → Webhooks → Add endpoint**
  2. Endpoint URL: `https://siphaven.com/api/webhook`
  3. Events to listen to: select `checkout.session.completed`
  4. Click **Add endpoint**
  5. On the next screen, click **Reveal** next to **Signing secret** — copy it (starts with `whsec_`)

- [ ] **Step 4: Add environment variables to Vercel**

  Go to **vercel.com/joemingahs-projects/sip-haven-store/settings/environment-variables** and add:

  | Name | Value |
  |---|---|
  | `STRIPE_WEBHOOK_SECRET` | `whsec_...` (from Step 3) |
  | `RESEND_API_KEY` | `re_...` (from Step 1) |

  Set both to **Production**, **Preview**, and **Development**.

- [ ] **Step 5: Push and redeploy**

  ```bash
  git push origin master
  vercel --prod
  ```

- [ ] **Step 6: Test end-to-end**

  1. Go to **siphaven.com**, add a product to cart, click Secure Checkout
  2. Use test card `4242 4242 4242 4242` / any future date / any CVC / any ZIP
  3. Complete the payment
  4. Within 30 seconds, check `joseph@siphaven.com` for the order notification email
  5. Verify it contains the customer name, shipping address, item, and total
