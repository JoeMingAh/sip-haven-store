import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '../router.jsx';

// The quiz reads the store flag and the lineup, so each test sets both here.
// getProducts follows the real one: every product, or only those in the category.
const shop = vi.hoisted(() => ({ open: false, products: [] }));
vi.mock('../../lib/store-config.js', async (importOriginal) => ({
  ...(await importOriginal()),
  isStoreOpen: () => shop.open,
}));
vi.mock('../../lib/catalog.js', async (importOriginal) => ({
  ...(await importOriginal()),
  getProducts: (category) =>
    category ? shop.products.filter((entry) => entry.category === category) : [...shop.products],
}));

// The signup form posts to /api/subscribe; every test gets a fake fetch so nothing
// can reach the network.
let fetchMock;
beforeEach(() => {
  shop.open = false;
  shop.products = [];
  fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const variant = (format, cents, overrides = {}) => ({
  id: `${format}-1`,
  format,
  size_label: 'one size',
  price_cents: cents,
  stripe_price_id: `price_${format}`,
  ...overrides,
});

const item = (overrides = {}) => ({
  slug: 'jasmine-pearls',
  name: 'Jasmine Pearls',
  category: 'tea',
  short_description: 'A floral green tea.',
  flavor_notes: ['jasmine'],
  caffeine: 'low',
  tags: ['green', 'floral'],
  featured: false,
  images: [],
  variants: [variant('loose-leaf', 1800)],
  ...overrides,
});

// In lineup order. What each scores for tea + caffeine-free + floral + a slow ritual:
//   Chamomile Meadow  none  herbal, floral   loose leaf + tea bags   4 + 2 + 1 = 7   from $12.00
//   Mint Calm         none  herbal, minty    tea bags                4            from $11.00
//   Jasmine Pearls    low   green, floral    loose leaf              2 + 1 = 3    from $18.00
//   Breakfast Black   high  black, malty     tea bags + K-Cup        0 (left out)
//   Dawn Roast        high  earthy, nutty    whole bean + ground     a coffee
//   Evening Decaf     none  sweet, caramel   ground                  a coffee
const LINEUP = [
  item({
    slug: 'chamomile-meadow',
    name: 'Chamomile Meadow',
    caffeine: 'none',
    tags: ['herbal', 'floral'],
    variants: [variant('loose-leaf', 1400), variant('tea-bags', 1200)],
  }),
  item({
    slug: 'mint-calm',
    name: 'Mint Calm',
    caffeine: 'none',
    tags: ['herbal', 'minty'],
    variants: [variant('tea-bags', 1100)],
  }),
  item(),
  item({
    slug: 'breakfast-black',
    name: 'Breakfast Black',
    caffeine: 'high',
    tags: ['black', 'malty'],
    variants: [variant('tea-bags', 1000), variant('k-cup', 900)],
  }),
  item({
    slug: 'dawn-roast',
    name: 'Dawn Roast',
    category: 'coffee',
    caffeine: 'high',
    tags: ['earthy', 'nutty'],
    variants: [variant('whole-bean', 1650), variant('ground', 1650)],
  }),
  item({
    slug: 'evening-decaf',
    name: 'Evening Decaf',
    category: 'coffee',
    caffeine: 'none',
    tags: ['sweet', 'caramel'],
    variants: [variant('ground', 1500)],
  }),
];

const QUESTIONS = [
  'What are you in the mood for?',
  'How much caffeine would you like?',
  'Which flavors sound best?',
  'How do you like to make your cup?',
];
const BLENDING = "We're still blending your perfect match";
const PICKS = "Here's what we'd pour for you";

// Answer buttons to press, in order.
const TEA_NONE_FLORAL_RITUAL = ['Tea', 'Caffeine-free', 'Floral', 'A slow ritual'];

function renderQuiz(path = '/quiz') {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

const main = () => within(screen.getByRole('main'));
// The one h2 on the page: the current question, or the heading of the result.
const stepHeading = () => main().getByRole('heading', { level: 2 });
// The answer button whose text begins with `label` (a hint follows the label).
const answerButton = (label) => main().getByRole('button', { name: (name) => name.startsWith(label) });
// A press as a browser delivers it: the control takes focus, then the click arrives.
// fireEvent.click alone skips the focus, which would leave it wherever it was and let a
// test pass whether or not the quiz moves focus itself.
const press = (element, init) => {
  element.focus();
  fireEvent.click(element, init);
};
const choose = (...labels) => labels.forEach((label) => press(answerButton(label)));
const backButton = () => main().getByRole('button', { name: 'Back' });
const startOverButton = () => main().getByRole('button', { name: 'Start over' });
// The product names on the cards, in page order.
const names = () => main().queryAllByRole('heading', { level: 3 }).map((heading) => heading.textContent);
// The dots sit directly above the question's heading.
const dotsOf = (heading) => heading.previousElementSibling;

describe('Quiz: the page', () => {
  it('is a page inside the layout with one h1', () => {
    renderQuiz();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(main().getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(main().getByRole('heading', { level: 1, name: 'Find your cup' })).toBeInTheDocument();
  });

  it('keeps its h1 on every question and on the result', () => {
    renderQuiz();
    for (const label of TEA_NONE_FLORAL_RITUAL) {
      expect(main().getByRole('heading', { level: 1, name: 'Find your cup' })).toBeInTheDocument();
      choose(label);
    }
    expect(main().getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });
});

describe('Quiz: the questions', () => {
  it('starts with the first question and its three answers', () => {
    renderQuiz();
    expect(stepHeading()).toHaveTextContent(QUESTIONS[0]);
    const group = main().getByRole('group', { name: new RegExp(QUESTIONS[0].replace('?', '\\?')) });
    expect(within(group).getAllByRole('button')).toHaveLength(3);
    expect(answerButton('Tea')).toBeInTheDocument();
    expect(answerButton('Coffee')).toBeInTheDocument();
    expect(answerButton('Either one')).toBeInTheDocument();
  });

  it('shows one question at a time', () => {
    renderQuiz();
    expect(main().getAllByRole('heading', { level: 2 })).toHaveLength(1);
    for (const later of QUESTIONS.slice(1)) {
      expect(main().queryByText(later, { exact: false })).not.toBeInTheDocument();
    }
    choose('Tea');
    expect(main().getAllByRole('heading', { level: 2 })).toHaveLength(1);
    expect(main().queryByText(QUESTIONS[0], { exact: false })).not.toBeInTheDocument();
    expect(stepHeading()).toHaveTextContent(QUESTIONS[1]);
  });

  it('asks the four questions in order, each answered by pressing a button', () => {
    renderQuiz();
    const asked = [];
    for (const label of TEA_NONE_FLORAL_RITUAL) {
      asked.push(stepHeading().textContent);
      choose(label);
    }
    QUESTIONS.forEach((prompt, index) => expect(asked[index]).toContain(prompt));
  });

  it('offers the caffeine levels as the shop words them', () => {
    renderQuiz();
    choose('Tea');
    const group = main().getByRole('group');
    expect(within(group).getAllByRole('button')).toHaveLength(4);
    for (const label of ['Caffeine-free', 'Low', 'Medium', 'High']) {
      expect(answerButton(label)).toBeInTheDocument();
    }
  });

  it('offers the four flavor families', () => {
    renderQuiz();
    choose('Tea', 'Low');
    const group = main().getByRole('group');
    expect(within(group).getAllByRole('button')).toHaveLength(4);
    for (const label of ['Floral', 'Fruity', 'Earthy', 'Sweet and spiced']) {
      expect(answerButton(label)).toBeInTheDocument();
    }
  });

  it('names the formats under the brewing-style answers in the shop\'s words', () => {
    renderQuiz();
    choose('Tea', 'Low', 'Floral');
    expect(answerButton('Quick and easy')).toHaveTextContent('K-Cup, Tea bags, Ground');
    expect(answerButton('A slow ritual')).toHaveTextContent('Loose leaf, Whole bean');
    expect(answerButton('Either way is fine')).toBeInTheDocument();
  });

  it('has answers that are real buttons and submit nothing', () => {
    renderQuiz();
    const group = main().getByRole('group');
    for (const button of within(group).getAllByRole('button')) {
      expect(button.tagName).toBe('BUTTON');
      expect(button).toHaveAttribute('type', 'button');
    }
  });

  it('groups the answers under their question, so a screen reader announces both', () => {
    renderQuiz();
    const group = main().getByRole('group');
    expect(group).toHaveAccessibleName(stepHeading().textContent);
  });

  it('ignores the second click of a double click, which would answer the next question by accident', () => {
    renderQuiz();
    press(answerButton('Tea'), { detail: 1 });
    expect(stepHeading()).toHaveTextContent(QUESTIONS[1]);

    // The double click's second click lands on whatever replaced the button.
    press(answerButton('Low'), { detail: 2 });
    expect(stepHeading()).toHaveTextContent(QUESTIONS[1]);
    expect(answerButton('Low')).not.toHaveAttribute('aria-current');

    // A deliberate press afterwards still works.
    press(answerButton('Low'), { detail: 1 });
    expect(stepHeading()).toHaveTextContent(QUESTIONS[2]);
  });

  it('answers with the keyboard too: a key press arrives as a click with no click count', () => {
    renderQuiz();
    press(answerButton('Tea'), { detail: 0 });
    expect(stepHeading()).toHaveTextContent(QUESTIONS[1]);
  });
});

describe('Quiz: progress', () => {
  it('hides the dots from assistive technology and has one for each question', () => {
    renderQuiz();
    const dots = dotsOf(stepHeading());
    expect(dots).toHaveAttribute('aria-hidden', 'true');
    expect(dots.children).toHaveLength(4);
  });

  it('says which question this is in visually hidden text, inside the heading that takes focus', () => {
    renderQuiz();
    const number = main().getByText('Question 1 of 4');
    expect(number).toHaveClass('sr-only');
    expect(stepHeading()).toContainElement(number);
    // The dots carry no text: the number is not repeated in the part that is hidden.
    expect(dotsOf(stepHeading())).not.toHaveTextContent(/question/i);
  });

  it('counts up as the questions are answered', () => {
    renderQuiz();
    expect(main().getByText('Question 1 of 4')).toBeInTheDocument();
    choose('Tea');
    expect(main().getByText('Question 2 of 4')).toBeInTheDocument();
    expect(main().queryByText('Question 1 of 4')).not.toBeInTheDocument();
    choose('Low');
    expect(main().getByText('Question 3 of 4')).toBeInTheDocument();
    choose('Floral');
    expect(main().getByText('Question 4 of 4')).toBeInTheDocument();
  });

  it('draws finished, current and coming dots differently', () => {
    renderQuiz();
    choose('Tea'); // now on question 2
    const [done, current, comingA, comingB] = [...dotsOf(stepHeading()).children].map(
      (dot) => dot.className,
    );
    expect(done).not.toBe(current);
    expect(current).not.toBe(comingA);
    expect(done).not.toBe(comingA);
    expect(comingA).toBe(comingB);
  });

  it('shows no dots and no question number on the result', () => {
    shop.open = true;
    shop.products = LINEUP;
    renderQuiz();
    choose(...TEA_NONE_FLORAL_RITUAL);
    expect(main().queryByText(/Question \d of 4/)).not.toBeInTheDocument();
    // Nothing above the heading: on a question the dots are there.
    expect(stepHeading().previousElementSibling).toBeNull();
  });
});

describe('Quiz: moving between questions', () => {
  it('does not take focus when the page first loads', () => {
    renderQuiz();
    expect(document.body).toHaveFocus();
  });

  it('has a heading that can be focused by script but is not in the tab order', () => {
    renderQuiz();
    expect(stepHeading()).toHaveAttribute('tabindex', '-1');
  });

  it('moves focus to the heading of the next question', () => {
    renderQuiz();
    choose('Tea');
    expect(stepHeading()).toHaveTextContent(QUESTIONS[1]);
    expect(stepHeading()).toHaveFocus();
    choose('Low');
    expect(stepHeading()).toHaveTextContent(QUESTIONS[2]);
    expect(stepHeading()).toHaveFocus();
    choose('Floral');
    expect(stepHeading()).toHaveTextContent(QUESTIONS[3]);
    expect(stepHeading()).toHaveFocus();
  });

  it('moves focus to the heading of the question it goes back to', () => {
    renderQuiz();
    choose('Tea', 'Low');
    press(backButton());
    expect(stepHeading()).toHaveTextContent(QUESTIONS[1]);
    expect(stepHeading()).toHaveFocus();
    press(backButton());
    expect(stepHeading()).toHaveTextContent(QUESTIONS[0]);
    expect(stepHeading()).toHaveFocus();
  });

  it('has no Back or Start over button on the first question', () => {
    renderQuiz();
    expect(main().queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();
    expect(main().queryByRole('button', { name: 'Start over' })).not.toBeInTheDocument();
  });

  it('has Back and Start over buttons from the second question on', () => {
    renderQuiz();
    choose('Tea');
    expect(backButton()).toHaveAttribute('type', 'button');
    expect(startOverButton()).toHaveAttribute('type', 'button');
  });

  it('goes back one question and shows the answer that was given', () => {
    renderQuiz();
    choose('Tea', 'Low');
    expect(stepHeading()).toHaveTextContent(QUESTIONS[2]);

    press(backButton());
    expect(stepHeading()).toHaveTextContent(QUESTIONS[1]);
    expect(answerButton('Low')).toHaveAttribute('aria-current', 'true');
    expect(answerButton('Caffeine-free')).not.toHaveAttribute('aria-current');
    expect(answerButton('Medium')).not.toHaveAttribute('aria-current');

    press(backButton());
    expect(stepHeading()).toHaveTextContent(QUESTIONS[0]);
    expect(answerButton('Tea')).toHaveAttribute('aria-current', 'true');
  });

  it('marks the answer that was given with a tick as well as a color', () => {
    renderQuiz();
    choose('Tea', 'Low');
    press(backButton());
    expect(answerButton('Low').querySelector('svg')).not.toBeNull();
    expect(answerButton('Low').querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    // Only that one: no other answer on the question has a tick.
    const group = main().getByRole('group');
    expect(group.querySelectorAll('svg')).toHaveLength(1);
  });

  it('marks no answer on a question that has not been answered', () => {
    renderQuiz();
    choose('Tea');
    const group = main().getByRole('group');
    for (const button of within(group).getAllByRole('button')) {
      expect(button).not.toHaveAttribute('aria-current');
    }
  });

  it('lets an answer be changed, and keeps the others', () => {
    renderQuiz();
    choose('Tea', 'Low');
    press(backButton());
    choose('Medium');
    expect(stepHeading()).toHaveTextContent(QUESTIONS[2]);
    press(backButton());
    expect(answerButton('Medium')).toHaveAttribute('aria-current', 'true');
    expect(answerButton('Low')).not.toHaveAttribute('aria-current');
    press(backButton());
    expect(answerButton('Tea')).toHaveAttribute('aria-current', 'true');
  });

  it('starts over from a later question, with nothing remembered', () => {
    renderQuiz();
    choose('Tea', 'Low');
    press(startOverButton());
    expect(stepHeading()).toHaveTextContent(QUESTIONS[0]);
    expect(main().getByText('Question 1 of 4')).toBeInTheDocument();
    expect(stepHeading()).toHaveFocus();
    expect(answerButton('Tea')).not.toHaveAttribute('aria-current');
    choose('Tea');
    expect(answerButton('Low')).not.toHaveAttribute('aria-current');
    expect(main().queryByRole('button', { name: 'Start over' })).toBeInTheDocument();
  });
});

describe('Quiz: the result, store open', () => {
  beforeEach(() => {
    shop.open = true;
    shop.products = LINEUP;
  });

  it('shows the products that fit the answers as product cards, best match first', () => {
    renderQuiz();
    choose(...TEA_NONE_FLORAL_RITUAL);
    expect(stepHeading()).toHaveTextContent(PICKS);
    expect(names()).toEqual(['Chamomile Meadow', 'Mint Calm', 'Jasmine Pearls']);
  });

  it('shows each pick\'s from price and links it to its product page', () => {
    renderQuiz();
    choose(...TEA_NONE_FLORAL_RITUAL);
    expect(main().getByText('from $12.00')).toBeInTheDocument();
    expect(main().getByText('from $11.00')).toBeInTheDocument();
    expect(main().getByText('from $18.00')).toBeInTheDocument();
    expect(main().getByRole('link', { name: 'Chamomile Meadow' })).toHaveAttribute(
      'href',
      '/products/chamomile-meadow',
    );
  });

  it('has one h1, then one h2, then a card heading for each pick', () => {
    renderQuiz();
    choose(...TEA_NONE_FLORAL_RITUAL);
    const headings = main().getAllByRole('heading');
    expect(headings.map((heading) => [heading.tagName, heading.textContent])).toEqual([
      ['H1', 'Find your cup'],
      ['H2', PICKS],
      ['H3', 'Chamomile Meadow'],
      ['H3', 'Mint Calm'],
      ['H3', 'Jasmine Pearls'],
    ]);
  });

  it('moves focus to the heading of the result', () => {
    renderQuiz();
    choose(...TEA_NONE_FLORAL_RITUAL);
    expect(stepHeading()).toHaveFocus();
    expect(stepHeading()).toHaveAttribute('tabindex', '-1');
  });

  it('follows the answers: a coffee drinker is shown coffee only', () => {
    renderQuiz();
    choose('Coffee', 'High', 'Earthy', 'A slow ritual');
    expect(names()).toEqual(['Dawn Roast']);
  });

  it('shows teas and coffees together for either', () => {
    renderQuiz();
    choose('Either one', 'Caffeine-free', 'Sweet and spiced', 'Either way is fine');
    expect(names()).toEqual(['Evening Decaf', 'Chamomile Meadow', 'Mint Calm']);
  });

  it('shows at most three picks', () => {
    shop.products = Array.from({ length: 5 }, (_, index) =>
      item({ slug: `tea-${index}`, name: `Tea ${index}`, caffeine: 'none' }),
    );
    renderQuiz();
    choose(...TEA_NONE_FLORAL_RITUAL);
    expect(names()).toEqual(['Tea 0', 'Tea 1', 'Tea 2']);
  });

  it('never shows a product that cannot be bought, however well it fits', () => {
    shop.products = [
      item({
        slug: 'perfect-but-unsynced',
        name: 'Perfect But Unsynced',
        caffeine: 'none',
        tags: ['floral'],
        variants: [variant('loose-leaf', 1000, { stripe_price_id: undefined })],
      }),
      ...LINEUP,
    ];
    renderQuiz();
    choose(...TEA_NONE_FLORAL_RITUAL);
    expect(main().queryByText('Perfect But Unsynced')).not.toBeInTheDocument();
    expect(names()).toEqual(['Chamomile Meadow', 'Mint Calm', 'Jasmine Pearls']);
  });

  it('does not offer to add anything to the cart from here', () => {
    renderQuiz();
    choose(...TEA_NONE_FLORAL_RITUAL);
    expect(screen.queryByText(/add to cart/i)).not.toBeInTheDocument();
  });

  it('is no longer introducing the questions', () => {
    renderQuiz();
    expect(main().getByText(/quick questions/i)).toBeInTheDocument();
    choose(...TEA_NONE_FLORAL_RITUAL);
    expect(main().queryByText(/quick questions/i)).not.toBeInTheDocument();
  });

  it('goes back to the last question with its answer shown', () => {
    renderQuiz();
    choose(...TEA_NONE_FLORAL_RITUAL);
    press(backButton());
    expect(stepHeading()).toHaveTextContent(QUESTIONS[3]);
    expect(stepHeading()).toHaveFocus();
    expect(answerButton('A slow ritual')).toHaveAttribute('aria-current', 'true');
    expect(main().queryByText('Chamomile Meadow')).not.toBeInTheDocument();
  });

  it('recalculates after an answer is changed, keeping the other answers', () => {
    renderQuiz();
    choose(...TEA_NONE_FLORAL_RITUAL);
    expect(names()).toEqual(['Chamomile Meadow', 'Mint Calm', 'Jasmine Pearls']);

    press(backButton()); // question 4
    press(backButton()); // question 3
    press(backButton()); // question 2
    choose('High'); // question 3: Floral is still marked from before
    expect(answerButton('Floral')).toHaveAttribute('aria-current', 'true');
    choose('Floral');
    expect(answerButton('A slow ritual')).toHaveAttribute('aria-current', 'true');
    choose('A slow ritual');

    expect(names()).toEqual(['Breakfast Black', 'Chamomile Meadow', 'Jasmine Pearls']);
  });

  it('starts over from the result', () => {
    renderQuiz();
    choose(...TEA_NONE_FLORAL_RITUAL);
    press(startOverButton());
    expect(stepHeading()).toHaveTextContent(QUESTIONS[0]);
    expect(stepHeading()).toHaveFocus();
    expect(main().queryByText('Chamomile Meadow')).not.toBeInTheDocument();
    expect(main().getByText('Question 1 of 4')).toBeInTheDocument();
    expect(answerButton('Tea')).not.toHaveAttribute('aria-current');
  });

  it('can be taken again after starting over, with different answers', () => {
    renderQuiz();
    choose(...TEA_NONE_FLORAL_RITUAL);
    press(startOverButton());
    choose('Coffee', 'High', 'Earthy', 'A slow ritual');
    expect(names()).toEqual(['Dawn Roast']);
  });
});

describe('Quiz: when nothing fits, store open', () => {
  beforeEach(() => {
    shop.open = true;
  });

  it('says the match is still being blended and offers the signup, with no cards', () => {
    shop.products = [LINEUP[3]]; // Breakfast Black: high caffeine, no floral tag, wrong format
    renderQuiz();
    choose(...TEA_NONE_FLORAL_RITUAL);
    expect(stepHeading()).toHaveTextContent(BLENDING);
    expect(main().getByLabelText('Email address')).toBeInTheDocument();
    expect(main().getByRole('button', { name: 'Join the list' })).toBeInTheDocument();
    expect(main().queryByText('Breakfast Black')).not.toBeInTheDocument();
    expect(names()).toEqual([]);
  });

  it('does the same for an empty lineup', () => {
    shop.products = [];
    renderQuiz();
    choose(...TEA_NONE_FLORAL_RITUAL);
    expect(stepHeading()).toHaveTextContent(BLENDING);
    expect(main().getByLabelText('Email address')).toBeInTheDocument();
  });

  it('does the same when everything that fits cannot be bought yet', () => {
    shop.products = [
      item({
        caffeine: 'none',
        tags: ['floral'],
        variants: [variant('loose-leaf', 1000, { stripe_price_id: undefined })],
      }),
    ];
    renderQuiz();
    choose(...TEA_NONE_FLORAL_RITUAL);
    expect(stepHeading()).toHaveTextContent(BLENDING);
    expect(main().queryByText('Jasmine Pearls')).not.toBeInTheDocument();
  });

  it('moves focus to the heading, and still offers Back and Start over', () => {
    shop.products = [];
    renderQuiz();
    choose(...TEA_NONE_FLORAL_RITUAL);
    expect(stepHeading()).toHaveFocus();
    press(backButton());
    expect(stepHeading()).toHaveTextContent(QUESTIONS[3]);
    choose('A slow ritual');
    press(startOverButton());
    expect(stepHeading()).toHaveTextContent(QUESTIONS[0]);
  });
});

describe('Quiz: store closed', () => {
  beforeEach(() => {
    shop.open = false;
    shop.products = LINEUP;
  });

  it('still asks the questions', () => {
    renderQuiz();
    expect(stepHeading()).toHaveTextContent(QUESTIONS[0]);
    choose('Tea');
    expect(stepHeading()).toHaveTextContent(QUESTIONS[1]);
  });

  it('ends with the still-blending line and the signup form, not with products', () => {
    renderQuiz();
    choose(...TEA_NONE_FLORAL_RITUAL);
    expect(stepHeading()).toHaveTextContent(BLENDING);
    expect(stepHeading()).toHaveFocus();
    expect(main().getByLabelText('Email address')).toBeInTheDocument();
    expect(main().getByRole('button', { name: 'Join the list' })).toBeInTheDocument();
  });

  it('has only decorative art on the still-blending panel', () => {
    renderQuiz();
    choose(...TEA_NONE_FLORAL_RITUAL);
    // An image with empty alt text has no role, so a screen reader skips it.
    expect(main().queryByRole('img')).not.toBeInTheDocument();
  });

  it('shows no product, price or way to buy, even for a lineup that fits perfectly', () => {
    renderQuiz();
    choose(...TEA_NONE_FLORAL_RITUAL);
    for (const entry of LINEUP) expect(screen.queryByText(entry.name)).not.toBeInTheDocument();
    expect(screen.getByRole('main')).not.toHaveTextContent('$');
    expect(screen.queryByText(/add to cart/i)).not.toBeInTheDocument();
    expect(main().queryAllByRole('heading', { level: 3 })).toHaveLength(0);
    expect(main().queryByRole('link', { name: /chamomile/i })).not.toBeInTheDocument();
    expect(main().queryByRole('article')).not.toBeInTheDocument();
  });

  it('shows no price on any question either', () => {
    renderQuiz();
    expect(screen.getByRole('main')).not.toHaveTextContent('$');
    choose('Tea', 'Low', 'Floral');
    expect(screen.getByRole('main')).not.toHaveTextContent('$');
  });

  it('goes back from the still-blending line to the last question', () => {
    renderQuiz();
    choose(...TEA_NONE_FLORAL_RITUAL);
    press(backButton());
    expect(stepHeading()).toHaveTextContent(QUESTIONS[3]);
    expect(answerButton('A slow ritual')).toHaveAttribute('aria-current', 'true');
  });
});

describe('Quiz: the signup on the result', () => {
  // Which interest the signup form sends depends on the drink the shopper chose.
  const posted = () => JSON.parse(fetchMock.mock.calls[0][1].body);

  async function signUp() {
    fireEvent.change(main().getByLabelText('Email address'), {
      target: { value: 'sam@example.com' },
    });
    fireEvent.click(main().getByRole('button', { name: 'Join the list' }));
    // Let the form finish, so its state update lands inside the test.
    await screen.findByText(/You're on the list/);
  }

  it.each([
    ['Tea', 'tea'],
    ['Coffee', 'coffee'],
    ['Either one', 'both'],
  ])('sends the interest for %s as %s when the store is closed', async (drink, interest) => {
    renderQuiz();
    choose(drink, 'Low', 'Floral', 'A slow ritual');
    await signUp();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/subscribe');
    expect(posted()).toEqual({ email: 'sam@example.com', interest });
  });

  it('sends the interest too when the store is open but nothing fits', async () => {
    shop.open = true;
    shop.products = [];
    renderQuiz();
    choose('Coffee', 'High', 'Earthy', 'A slow ritual');
    await signUp();
    expect(posted()).toEqual({ email: 'sam@example.com', interest: 'coffee' });
  });

  it('follows the answer that was changed, not the first one given', async () => {
    renderQuiz();
    choose('Tea', 'Low', 'Floral', 'A slow ritual');
    press(backButton());
    press(backButton());
    press(backButton());
    press(backButton());
    choose('Coffee', 'Low', 'Floral', 'A slow ritual');
    await signUp();
    expect(posted().interest).toBe('coffee');
  });
});
