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

// In lineup order. What each scores for tea + calm + caffeine-free + floral + "Surprise me"
// (no aroma) + a slow ritual. None of these has moods, so the mood adds nothing here. Caffeine-free is a filter too: a product with any caffeine is
// left out, however well it fits the rest.
//   Chamomile Meadow  none  herbal, floral   honey        loose leaf + tea bags  16 + 8 + 1 = 25  from $12.00
//   Mint Calm         none  herbal, minty    mint, herbal tea bags               16             from $11.00
//   Jasmine Pearls    low   green, floral    jasmine      loose leaf             left out (it has caffeine)
//   Breakfast Black   high  black, malty     malty        tea bags + K-Cup       left out (it has caffeine)
//   Dawn Roast        high  earthy, nutty    roasted      whole bean + ground    a coffee
//   Evening Decaf     none  sweet, caramel   caramel      ground                 a coffee
// For tea + low caffeine + floral + no aroma + a slow ritual, Jasmine Pearls scores
// 16 + 8 + 1 = 25 (from $18.00) and Chamomile Meadow 8 + 1 = 9.
const LINEUP = [
  item({
    slug: 'chamomile-meadow',
    name: 'Chamomile Meadow',
    caffeine: 'none',
    tags: ['herbal', 'floral'],
    aromas: ['honey'],
    variants: [variant('loose-leaf', 1400), variant('tea-bags', 1200)],
  }),
  item({
    slug: 'mint-calm',
    name: 'Mint Calm',
    caffeine: 'none',
    tags: ['herbal', 'minty'],
    aromas: ['mint', 'herbal'],
    variants: [variant('tea-bags', 1100)],
  }),
  item({ aromas: ['jasmine'] }),
  item({
    slug: 'breakfast-black',
    name: 'Breakfast Black',
    caffeine: 'high',
    tags: ['black', 'malty'],
    aromas: ['malty'],
    variants: [variant('tea-bags', 1000), variant('k-cup', 900)],
  }),
  item({
    slug: 'dawn-roast',
    name: 'Dawn Roast',
    category: 'coffee',
    caffeine: 'high',
    tags: ['earthy', 'nutty'],
    aromas: ['roasted'],
    variants: [variant('whole-bean', 1650), variant('ground', 1650)],
  }),
  item({
    slug: 'evening-decaf',
    name: 'Evening Decaf',
    category: 'coffee',
    caffeine: 'none',
    tags: ['sweet', 'caramel'],
    aromas: ['caramel'],
    variants: [variant('ground', 1500)],
  }),
];

const QUESTIONS = [
  'Tea or coffee today?',
  'How do you want to feel?',
  'How much caffeine would you like?',
  'Which flavors sound best?',
  'Which aroma pulls you in?',
  'How do you like to make your cup?',
];
const STYLE_QUESTION = QUESTIONS[5];
const BLENDING = "We're still blending your perfect match";
const PICKS = "Here's what we'd pour for you";

// Answer buttons to press, in order. "Surprise me" is the aroma answer with no preference.
const TEA_NONE_FLORAL_RITUAL = ['Tea', 'Calm and unwound', 'Caffeine-free', 'Floral', 'Surprise me', 'A slow ritual'];

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
const names = () =>
  main()
    .queryAllByRole('article')
    .map((card) => within(card).getByRole('heading', { level: 3 }).textContent);
const SIGNUP_HEADING = 'Get your matches by email';
// The requests the page made to one address, as parsed JSON bodies.
const postsTo = (url) =>
  fetchMock.mock.calls.filter(([to]) => to === url).map(([, init]) => JSON.parse(init.body));
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

  it('asks the six questions in order, each answered by pressing a button', () => {
    renderQuiz();
    const asked = [];
    for (const label of TEA_NONE_FLORAL_RITUAL) {
      asked.push(stepHeading().textContent);
      choose(label);
    }
    QUESTIONS.forEach((prompt, index) => expect(asked[index]).toContain(prompt));
  });

  it('asks "Tea or coffee today?" first, and how they want to feel right after, with the five moods and Surprise me', () => {
    renderQuiz();
    expect(stepHeading()).toHaveTextContent('Tea or coffee today?');
    choose('Tea');
    expect(stepHeading()).toHaveTextContent('How do you want to feel?');
    const group = main().getByRole('group');
    expect(within(group).getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Calm and unwound',
      'Focused and productive',
      'Energized and ready',
      'Cozy and comforted',
      'Light and refreshed',
      'Surprise me No preference',
    ]);
    choose('Energized and ready');
    expect(stepHeading()).toHaveTextContent('How much caffeine would you like?');
  });

  it('offers the caffeine levels as the shop words them', () => {
    renderQuiz();
    choose('Tea', 'Calm and unwound');
    const group = main().getByRole('group');
    expect(within(group).getAllByRole('button')).toHaveLength(4);
    for (const label of ['Caffeine-free', 'Low', 'Medium', 'High']) {
      expect(answerButton(label)).toBeInTheDocument();
    }
  });

  it('offers the four flavor families', () => {
    renderQuiz();
    choose('Tea', 'Calm and unwound', 'Low');
    const group = main().getByRole('group');
    expect(within(group).getAllByRole('button')).toHaveLength(4);
    for (const label of ['Floral', 'Fruity', 'Earthy', 'Sweet and spiced']) {
      expect(answerButton(label)).toBeInTheDocument();
    }
  });

  it('asks about aroma right after flavor, with the five aroma families and "Surprise me"', () => {
    renderQuiz();
    choose('Tea', 'Calm and unwound', 'Low', 'Floral');
    expect(stepHeading()).toHaveTextContent('Which aroma pulls you in?');
    const group = main().getByRole('group');
    expect(within(group).getAllByRole('button')).toHaveLength(6);
    for (const label of [
      'Floral',
      'Toasty and smoky',
      'Bright and citrusy',
      'Sweet',
      'Fresh and herbal',
      'Surprise me',
    ]) {
      expect(answerButton(label)).toBeInTheDocument();
    }
    expect(answerButton('Bright and citrusy')).toHaveTextContent('Citrus, lemon, bergamot, berry');
  });

  it('names the formats under the brewing-style answers in the shop\'s words', () => {
    renderQuiz();
    choose('Tea', 'Calm and unwound', 'Low', 'Floral', 'Surprise me');
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

  // The answers sit on the sage-tint panel. Plain sage is only 3.1:1 against it, thin for
  // a 2px outline; sage-deep is 5.3:1. The cream fill and the wood hover fill are as before.
  it('outlines the answers in sage-deep, not plain sage', () => {
    renderQuiz();
    const group = main().getByRole('group');
    for (const button of within(group).getAllByRole('button')) {
      expect(button).toHaveClass('border-2', 'border-sage-deep');
      expect(button).not.toHaveClass('border-sage');
      expect(button).toHaveClass('bg-cream', 'hover:bg-wood');
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
    press(answerButton('Cozy and comforted'), { detail: 2 });
    expect(stepHeading()).toHaveTextContent(QUESTIONS[1]);
    expect(answerButton('Cozy and comforted')).not.toHaveAttribute('aria-current');

    // A deliberate press afterwards still works.
    press(answerButton('Cozy and comforted'), { detail: 1 });
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
    expect(dots.children).toHaveLength(6);
  });

  it('says which question this is in visually hidden text, inside the heading that takes focus', () => {
    renderQuiz();
    const number = main().getByText('Question 1 of 6');
    expect(number).toHaveClass('sr-only');
    expect(stepHeading()).toContainElement(number);
    // The dots carry no text: the number is not repeated in the part that is hidden.
    expect(dotsOf(stepHeading())).not.toHaveTextContent(/question/i);
  });

  it('counts up as the questions are answered', () => {
    renderQuiz();
    expect(main().getByText('Question 1 of 6')).toBeInTheDocument();
    choose('Tea');
    expect(main().getByText('Question 2 of 6')).toBeInTheDocument();
    expect(main().queryByText('Question 1 of 6')).not.toBeInTheDocument();
    choose('Calm and unwound');
    expect(main().getByText('Question 3 of 6')).toBeInTheDocument();
    choose('Low');
    expect(main().getByText('Question 4 of 6')).toBeInTheDocument();
    choose('Floral');
    expect(main().getByText('Question 5 of 6')).toBeInTheDocument();
    choose('Surprise me');
    expect(main().getByText('Question 6 of 6')).toBeInTheDocument();
  });

  it('shows 6 steps: six dots and "of 6" on every question', () => {
    renderQuiz();
    for (const label of TEA_NONE_FLORAL_RITUAL) {
      expect(dotsOf(stepHeading()).children).toHaveLength(6);
      expect(stepHeading()).toHaveTextContent(/Question \d of 6/);
      choose(label);
    }
    expect(TEA_NONE_FLORAL_RITUAL).toHaveLength(6);
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

  // The coming dots are hollow rings on the sage-tint panel. Plain sage is only 3.1:1
  // there, too faint for a thin outline; sage-deep is 5.3:1.
  it('draws the coming dots as sage-deep rings, not plain sage rings', () => {
    renderQuiz();
    choose('Tea'); // now on question 2: one dot done, one current, two coming
    const [done, current, comingA, comingB] = [...dotsOf(stepHeading()).children];
    for (const dot of [comingA, comingB]) {
      expect(dot).toHaveClass('border-2', 'border-sage-deep');
      expect(dot).not.toHaveClass('border-sage');
    }
    // The ones behind and this one are filled, with no ring: filled against hollow stays
    // a difference of shape, whatever the colors do.
    for (const dot of [done, current]) {
      expect(dot).toHaveClass('bg-sage-deep');
      expect(dot).not.toHaveClass('border-2');
    }
  });

  it('shows no dots and no question number on the result', () => {
    shop.open = true;
    shop.products = LINEUP;
    renderQuiz();
    choose(...TEA_NONE_FLORAL_RITUAL);
    expect(main().queryByText(/Question \d of 6/)).not.toBeInTheDocument();
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
    choose('Calm and unwound');
    expect(stepHeading()).toHaveTextContent(QUESTIONS[2]);
    expect(stepHeading()).toHaveFocus();
    choose('Low');
    expect(stepHeading()).toHaveTextContent(QUESTIONS[3]);
    expect(stepHeading()).toHaveFocus();
    choose('Floral');
    expect(stepHeading()).toHaveTextContent(QUESTIONS[4]);
    expect(stepHeading()).toHaveFocus();
    choose('Surprise me');
    expect(stepHeading()).toHaveTextContent(QUESTIONS[5]);
    expect(stepHeading()).toHaveFocus();
  });

  it('moves focus to the heading of the question it goes back to', () => {
    renderQuiz();
    choose('Tea', 'Calm and unwound', 'Low');
    press(backButton());
    expect(stepHeading()).toHaveTextContent(QUESTIONS[2]);
    expect(stepHeading()).toHaveFocus();
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
    choose('Tea', 'Calm and unwound', 'Low');
    expect(stepHeading()).toHaveTextContent(QUESTIONS[3]);

    press(backButton());
    expect(stepHeading()).toHaveTextContent(QUESTIONS[2]);
    expect(answerButton('Low')).toHaveAttribute('aria-current', 'true');
    expect(answerButton('Caffeine-free')).not.toHaveAttribute('aria-current');
    expect(answerButton('Medium')).not.toHaveAttribute('aria-current');

    press(backButton());
    expect(stepHeading()).toHaveTextContent(QUESTIONS[1]);
    expect(answerButton('Calm and unwound')).toHaveAttribute('aria-current', 'true');
    expect(answerButton('Cozy and comforted')).not.toHaveAttribute('aria-current');

    press(backButton());
    expect(stepHeading()).toHaveTextContent(QUESTIONS[0]);
    expect(answerButton('Tea')).toHaveAttribute('aria-current', 'true');
  });

  it('marks the answer that was given with a tick as well as a color', () => {
    renderQuiz();
    choose('Tea', 'Calm and unwound', 'Low');
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
    choose('Tea', 'Calm and unwound', 'Low');
    press(backButton());
    choose('Medium');
    expect(stepHeading()).toHaveTextContent(QUESTIONS[3]);
    press(backButton());
    expect(answerButton('Medium')).toHaveAttribute('aria-current', 'true');
    expect(answerButton('Low')).not.toHaveAttribute('aria-current');
    press(backButton());
    expect(answerButton('Calm and unwound')).toHaveAttribute('aria-current', 'true');
    press(backButton());
    expect(answerButton('Tea')).toHaveAttribute('aria-current', 'true');
  });

  it('starts over from a later question, with nothing remembered', () => {
    renderQuiz();
    choose('Tea', 'Calm and unwound', 'Low');
    press(startOverButton());
    expect(stepHeading()).toHaveTextContent(QUESTIONS[0]);
    expect(main().getByText('Question 1 of 6')).toBeInTheDocument();
    expect(stepHeading()).toHaveFocus();
    expect(answerButton('Tea')).not.toHaveAttribute('aria-current');
    choose('Tea');
    expect(answerButton('Calm and unwound')).not.toHaveAttribute('aria-current');
    choose('Calm and unwound');
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
    expect(names()).toEqual(['Chamomile Meadow', 'Mint Calm']);
  });

  it('shows each pick\'s from price and links it to its product page', () => {
    renderQuiz();
    choose(...TEA_NONE_FLORAL_RITUAL);
    expect(main().getByText('from $12.00')).toBeInTheDocument();
    expect(main().getByText('from $11.00')).toBeInTheDocument();
    expect(main().getByRole('link', { name: 'Chamomile Meadow' })).toHaveAttribute(
      'href',
      '/products/chamomile-meadow',
    );
  });

  it('has one h1, then one h2, then a card heading for each pick, then the signup heading', () => {
    renderQuiz();
    choose(...TEA_NONE_FLORAL_RITUAL);
    const headings = main().getAllByRole('heading');
    expect(headings.map((heading) => [heading.tagName, heading.textContent])).toEqual([
      ['H1', 'Find your cup'],
      ['H2', PICKS],
      ['H3', 'Chamomile Meadow'],
      ['H3', 'Mint Calm'],
      ['H3', SIGNUP_HEADING],
    ]);
  });

  it('offers the signup under the picks, labelled by its heading', () => {
    renderQuiz();
    choose(...TEA_NONE_FLORAL_RITUAL);
    const signup = main().getByRole('region', { name: SIGNUP_HEADING });
    expect(within(signup).getByLabelText('Email address')).toBeInTheDocument();
  });

  it('moves focus to the heading of the result', () => {
    renderQuiz();
    choose(...TEA_NONE_FLORAL_RITUAL);
    expect(stepHeading()).toHaveFocus();
    expect(stepHeading()).toHaveAttribute('tabindex', '-1');
  });

  it('follows the answers: a coffee drinker is shown coffee only', () => {
    renderQuiz();
    choose('Coffee', 'Calm and unwound', 'High', 'Earthy', 'Surprise me', 'A slow ritual');
    expect(names()).toEqual(['Dawn Roast']);
  });

  it('shows teas and coffees together for either', () => {
    renderQuiz();
    choose('Either one', 'Calm and unwound', 'Caffeine-free', 'Sweet and spiced', 'Surprise me', 'Either way is fine');
    expect(names()).toEqual(['Evening Decaf', 'Chamomile Meadow', 'Mint Calm']);
  });

  it('lets the aroma decide between products that tie on everything else', () => {
    // Chamomile Meadow and Mint Calm are both caffeine-free teas with no fruity tag.
    renderQuiz();
    choose('Tea', 'Calm and unwound', 'Caffeine-free', 'Fruity', 'Surprise me', 'Either way is fine');
    expect(names()).toEqual(['Chamomile Meadow', 'Mint Calm']);

    press(backButton()); // style
    press(backButton()); // aroma
    choose('Fresh and herbal', 'Either way is fine'); // Mint Calm smells of mint
    expect(names()).toEqual(['Mint Calm', 'Chamomile Meadow']);

    press(backButton());
    press(backButton());
    choose('Sweet', 'Either way is fine'); // Chamomile Meadow smells of honey
    expect(names()).toEqual(['Chamomile Meadow', 'Mint Calm']);
  });

  describe('with moods on the lineup', () => {
    // The same lineup, tagged with moods. Breakfast Black is the most energizing, but it
    // has caffeine.
    const MOODS = {
      'chamomile-meadow': ['calm', 'cozy'],
      'mint-calm': ['refreshed', 'energized'],
      'breakfast-black': ['energized', 'focused'],
      'dawn-roast': ['energized'],
    };
    beforeEach(() => {
      shop.products = LINEUP.map((product) => ({ ...product, moods: MOODS[product.slug] ?? [] }));
    });

    it('lets the mood decide between products that tie on taste', () => {
      // Chamomile Meadow and Mint Calm are both caffeine-free teas with no fruity tag.
      renderQuiz();
      choose('Tea', 'Cozy and comforted', 'Caffeine-free', 'Fruity', 'Surprise me', 'Either way is fine');
      expect(names()).toEqual(['Chamomile Meadow', 'Mint Calm']);

      press(startOverButton());
      choose('Tea', 'Light and refreshed', 'Caffeine-free', 'Fruity', 'Surprise me', 'Either way is fine');
      expect(names()).toEqual(['Mint Calm', 'Chamomile Meadow']);
    });

    it('shows only caffeine-free products to an energized shopper who chose caffeine-free', () => {
      renderQuiz();
      choose('Either one', 'Energized and ready', 'Caffeine-free', 'Earthy', 'Surprise me', 'Either way is fine');
      // Breakfast Black and Dawn Roast are energizing (and Dawn Roast is earthy), but have caffeine.
      expect(names()).toEqual(['Mint Calm', 'Chamomile Meadow', 'Evening Decaf']);
      expect(main().queryByText('Breakfast Black')).not.toBeInTheDocument();
      expect(main().queryByText('Dawn Roast')).not.toBeInTheDocument();
    });

    it('does not let the mood outweigh the caffeine choice', () => {
      // Calm fits Chamomile Meadow, but Low caffeine fits Jasmine Pearls, which comes first.
      renderQuiz();
      choose('Tea', 'Calm and unwound', 'Low', 'Fruity', 'Surprise me', 'Either way is fine');
      expect(names()).toEqual(['Jasmine Pearls', 'Chamomile Meadow']);
    });
  });

  it('puts the product whose tags and aromas both fit first', () => {
    renderQuiz();
    // Floral (tag) and jasmine (aroma) both fit Jasmine Pearls; Chamomile Meadow is floral only.
    choose('Tea', 'Calm and unwound', 'Medium', 'Floral', 'Floral', 'Either way is fine');
    expect(names()).toEqual(['Jasmine Pearls', 'Chamomile Meadow']);
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
    expect(names()).toEqual(['Chamomile Meadow', 'Mint Calm']);
  });

  it('never shows a product with caffeine to someone who chose caffeine-free, however well it fits', () => {
    // Jasmine Pearls is floral and comes in loose leaf, which is everything else they
    // asked for, but it has some caffeine.
    renderQuiz();
    choose(...TEA_NONE_FLORAL_RITUAL);
    expect(main().queryByText('Jasmine Pearls')).not.toBeInTheDocument();
    expect(main().queryByText('Breakfast Black')).not.toBeInTheDocument();
  });

  it('shows that same product to someone who chose Low caffeine', () => {
    renderQuiz();
    choose('Tea', 'Calm and unwound', 'Low', 'Floral', 'Surprise me', 'A slow ritual');
    expect(names()).toEqual(['Jasmine Pearls', 'Chamomile Meadow']);
  });

  it('stops showing it when the shopper goes back and changes Low to Caffeine-free', () => {
    renderQuiz();
    choose('Tea', 'Calm and unwound', 'Low', 'Floral', 'Surprise me', 'A slow ritual');
    expect(names()).toContain('Jasmine Pearls');

    press(backButton()); // question 6
    press(backButton()); // question 5
    press(backButton()); // question 4
    press(backButton()); // question 3, caffeine
    choose('Caffeine-free', 'Floral', 'Surprise me', 'A slow ritual');
    expect(names()).toEqual(['Chamomile Meadow', 'Mint Calm']);
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
    expect(stepHeading()).toHaveTextContent(STYLE_QUESTION);
    expect(stepHeading()).toHaveFocus();
    expect(answerButton('A slow ritual')).toHaveAttribute('aria-current', 'true');
    expect(main().queryByText('Chamomile Meadow')).not.toBeInTheDocument();
  });

  it('recalculates after an answer is changed, keeping the other answers', () => {
    renderQuiz();
    choose(...TEA_NONE_FLORAL_RITUAL);
    expect(names()).toEqual(['Chamomile Meadow', 'Mint Calm']);

    press(backButton()); // question 6
    press(backButton()); // question 5
    press(backButton()); // question 4
    press(backButton()); // question 3, caffeine
    choose('High'); // question 4: Floral is still marked from before
    expect(answerButton('Floral')).toHaveAttribute('aria-current', 'true');
    choose('Floral');
    expect(answerButton('Surprise me')).toHaveAttribute('aria-current', 'true');
    choose('Surprise me');
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
    expect(main().getByText('Question 1 of 6')).toBeInTheDocument();
    expect(answerButton('Tea')).not.toHaveAttribute('aria-current');
  });

  it('can be taken again after starting over, with different answers', () => {
    renderQuiz();
    choose(...TEA_NONE_FLORAL_RITUAL);
    press(startOverButton());
    choose('Coffee', 'Calm and unwound', 'High', 'Earthy', 'Toasty and smoky', 'A slow ritual');
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

  it('does the same when the only matches have caffeine and the shopper chose caffeine-free', () => {
    shop.products = [LINEUP[2]]; // Jasmine Pearls: floral and loose leaf, but with some caffeine
    renderQuiz();
    choose(...TEA_NONE_FLORAL_RITUAL);
    expect(stepHeading()).toHaveTextContent(BLENDING);
    expect(main().queryByText('Jasmine Pearls')).not.toBeInTheDocument();
    expect(names()).toEqual([]);
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
    expect(stepHeading()).toHaveTextContent(STYLE_QUESTION);
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
    // The only h3 is the signup's own heading: no product card.
    expect(
      main()
        .queryAllByRole('heading', { level: 3 })
        .map((heading) => heading.textContent),
    ).toEqual([SIGNUP_HEADING]);
    expect(main().queryByRole('link', { name: /chamomile/i })).not.toBeInTheDocument();
    expect(main().queryByRole('article')).not.toBeInTheDocument();
  });

  it('shows no price on any question either', () => {
    renderQuiz();
    expect(screen.getByRole('main')).not.toHaveTextContent('$');
    choose('Tea', 'Calm and unwound', 'Low', 'Floral');
    expect(screen.getByRole('main')).not.toHaveTextContent('$');
  });

  it('goes back from the still-blending line to the last question', () => {
    renderQuiz();
    choose(...TEA_NONE_FLORAL_RITUAL);
    press(backButton());
    expect(stepHeading()).toHaveTextContent(STYLE_QUESTION);
    expect(answerButton('A slow ritual')).toHaveAttribute('aria-current', 'true');
  });
});

describe('Quiz: the signup on the result', () => {
  // The signup sends the quiz answers, the picks (the first as the top match) and source
  // 'quiz'. The server turns the drink answer into the interest.
  const posted = () => postsTo('/api/subscribe')[0];

  async function signUp() {
    fireEvent.change(main().getByLabelText('Email address'), {
      target: { value: 'sam@example.com' },
    });
    fireEvent.click(main().getByRole('button', { name: 'Join the list' }));
    // Let the form finish, so its state update lands inside the test.
    await screen.findByText(/You're on the list/);
  }

  it('says "Get your matches by email" on the still-blending panel', () => {
    renderQuiz();
    choose(...TEA_NONE_FLORAL_RITUAL);
    const signup = main().getByRole('region', { name: SIGNUP_HEADING });
    expect(within(signup).getByLabelText('Email address')).toBeInTheDocument();
  });

  it.each([
    ['Tea', 'tea'],
    ['Coffee', 'coffee'],
    ['Either one', 'either'],
  ])('sends the answers for %s, with source quiz, when the store is closed', async (label, drink) => {
    renderQuiz();
    choose(label, 'Calm and unwound', 'Low', 'Floral', 'Bright and citrusy', 'A slow ritual');
    await signUp();
    expect(postsTo('/api/subscribe')).toHaveLength(1);
    expect(posted()).toEqual({
      email: 'sam@example.com',
      answers: { drink, mood: 'calm', caffeine: 'low', flavor: 'floral', aroma: 'citrus', style: 'ritual' },
      source: 'quiz',
    });
  });

  it('sends the picks on screen, best first, with the first as the top match', async () => {
    shop.open = true;
    shop.products = LINEUP;
    renderQuiz();
    choose(...TEA_NONE_FLORAL_RITUAL);
    expect(names()).toEqual(['Chamomile Meadow', 'Mint Calm']);
    await signUp();
    expect(posted()).toEqual({
      email: 'sam@example.com',
      answers: { drink: 'tea', mood: 'calm', caffeine: 'none', flavor: 'floral', aroma: 'either', style: 'ritual' },
      topMatch: 'chamomile-meadow',
      matches: ['chamomile-meadow', 'mint-calm'],
      source: 'quiz',
    });
  });

  it('sends all three picks in the order they are shown', async () => {
    shop.open = true;
    shop.products = LINEUP;
    renderQuiz();
    choose('Either one', 'Calm and unwound', 'Caffeine-free', 'Sweet and spiced', 'Sweet', 'Either way is fine');
    expect(names()).toEqual(['Evening Decaf', 'Chamomile Meadow', 'Mint Calm']);
    await signUp();
    expect(posted()).toMatchObject({
      topMatch: 'evening-decaf',
      matches: ['evening-decaf', 'chamomile-meadow', 'mint-calm'],
    });
  });

  it('sends no top match and no matches when the store is open but nothing fits', async () => {
    shop.open = true;
    shop.products = [];
    renderQuiz();
    choose('Coffee', 'Calm and unwound', 'High', 'Earthy', 'Toasty and smoky', 'A slow ritual');
    await signUp();
    expect(posted()).not.toHaveProperty('topMatch');
    expect(posted()).not.toHaveProperty('matches');
    expect(posted().answers).toMatchObject({ drink: 'coffee', flavor: 'earthy', aroma: 'toasty' });
  });

  it('sends the mood answer', async () => {
    renderQuiz();
    choose('Coffee', 'Focused and productive', 'High', 'Earthy', 'Toasty and smoky', 'A slow ritual');
    await signUp();
    expect(posted().answers).toMatchObject({ drink: 'coffee', mood: 'focused' });
  });

  it('follows the answer that was changed, not the first one given', async () => {
    renderQuiz();
    choose('Tea', 'Calm and unwound', 'Low', 'Floral', 'Surprise me', 'A slow ritual');
    for (let step = 0; step < QUESTIONS.length; step += 1) press(backButton());
    choose('Coffee', 'Calm and unwound', 'Low', 'Floral', 'Surprise me', 'A slow ritual');
    await signUp();
    expect(posted().answers.drink).toBe('coffee');
  });
});

// Answers the lineup cannot fully serve are noted anonymously, as product ideas.
describe('Quiz: notes on answers with too few matches', () => {
  const notes = () => postsTo('/api/quiz-notes');

  it('notes the answers and 0 picks when the store is closed', () => {
    renderQuiz();
    choose(...TEA_NONE_FLORAL_RITUAL);
    expect(notes()).toEqual([
      { drink: 'tea', mood: 'calm', caffeine: 'none', flavor: 'floral', aroma: 'either', style: 'ritual', picks: 0 },
    ]);
  });

  it('notes 0 picks, with the flavor and the aroma, when the store is open and nothing fits', () => {
    shop.open = true;
    shop.products = [];
    renderQuiz();
    choose('Coffee', 'Calm and unwound', 'High', 'Earthy', 'Toasty and smoky', 'A slow ritual');
    expect(notes()).toEqual([
      { drink: 'coffee', mood: 'calm', caffeine: 'high', flavor: 'earthy', aroma: 'toasty', style: 'ritual', picks: 0 },
    ]);
  });

  it('notes the mood that went unmet', () => {
    renderQuiz();
    choose('Tea', 'Light and refreshed', 'Caffeine-free', 'Fruity', 'Surprise me', 'Either way is fine');
    expect(notes()).toEqual([expect.objectContaining({ drink: 'tea', mood: 'refreshed', picks: 0 })]);
  });

  it('notes fewer picks than the quiz shows', () => {
    shop.open = true;
    shop.products = LINEUP;
    renderQuiz();
    choose(...TEA_NONE_FLORAL_RITUAL); // two picks
    expect(notes()).toEqual([
      { drink: 'tea', mood: 'calm', caffeine: 'none', flavor: 'floral', aroma: 'either', style: 'ritual', picks: 2 },
    ]);
  });

  it('notes nothing when the quiz has all three picks', () => {
    shop.open = true;
    shop.products = LINEUP;
    renderQuiz();
    choose('Either one', 'Calm and unwound', 'Caffeine-free', 'Floral', 'Surprise me', 'A slow ritual');
    expect(names()).toHaveLength(3);
    expect(notes()).toEqual([]);
  });

  it('notes nothing before the last question is answered', () => {
    renderQuiz();
    choose('Tea', 'Calm and unwound', 'Low', 'Floral', 'Bright and citrusy');
    expect(notes()).toEqual([]);
  });

  it('sends exactly one note per finished quiz, and only the answers and picks', () => {
    renderQuiz();
    choose(...TEA_NONE_FLORAL_RITUAL);
    expect(notes()).toHaveLength(1);
    const [, init] = fetchMock.mock.calls.find(([url]) => url === '/api/quiz-notes');
    expect(init.method).toBe('POST');
    expect(init.keepalive).toBe(true);
    expect(Object.keys(JSON.parse(init.body)).sort()).toEqual(
      ['aroma', 'caffeine', 'drink', 'flavor', 'mood', 'picks', 'style'],
    );
  });

  it('sends a new note when the quiz is finished again with a changed answer', () => {
    renderQuiz();
    choose(...TEA_NONE_FLORAL_RITUAL);
    press(backButton());
    choose('Quick and easy');
    expect(notes().map((note) => note.style)).toEqual(['ritual', 'quick']);
  });

  it('shows the shopper nothing when the note fails', async () => {
    fetchMock.mockImplementation(async (url) => {
      if (url === '/api/quiz-notes') throw new TypeError('Failed to fetch');
      return { ok: true, status: 200, json: async () => ({ ok: true }) };
    });
    renderQuiz();
    choose(...TEA_NONE_FLORAL_RITUAL);
    // Let the rejected request settle.
    await Promise.resolve();
    await Promise.resolve();
    expect(stepHeading()).toHaveTextContent(BLENDING);
    expect(main().queryByText(/went wrong/i)).not.toBeInTheDocument();
    expect(main().getByRole('status')).toBeEmptyDOMElement();
  });

  it('shows the shopper nothing when the note is refused', async () => {
    fetchMock.mockImplementation(async (url) =>
      url === '/api/quiz-notes'
        ? { ok: false, status: 500, json: async () => ({ error: 'Something went wrong.' }) }
        : { ok: true, status: 200, json: async () => ({ ok: true }) },
    );
    renderQuiz();
    choose(...TEA_NONE_FLORAL_RITUAL);
    await Promise.resolve();
    expect(main().queryByText(/went wrong/i)).not.toBeInTheDocument();
  });
});
