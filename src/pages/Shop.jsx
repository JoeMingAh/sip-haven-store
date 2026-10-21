import { useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { isStoreOpen } from '../../lib/store-config.js';
import { getProducts } from '../../lib/catalog.js';
import { filterOptions, filterProducts, readFilters, writeFilters } from '../../lib/filter.js';
import ComingSoon from '../components/ComingSoon.jsx';
import Filters from '../components/Filters.jsx';
import ProductCard from '../components/ProductCard.jsx';

// DRAFT COPY: the wording on this page needs Joseph's approval.

// What each shop page is called, and what its products are called in the count line.
const PAGES = {
  tea: { title: 'Tea', one: 'tea', many: 'teas' },
  coffee: { title: 'Coffee', one: 'coffee', many: 'coffees' },
};

// Filled buttons use sage-deep behind cream text, which is the pairing that passes
// WCAG AA (see tailwind.config.js).
const FILLED_BUTTON =
  'inline-flex min-h-12 items-center rounded-full bg-sage-deep px-7 text-base font-semibold text-cream hover:bg-ink';

const NO_FILTERS = { flavors: [], caffeine: [], formats: [] };

// The filters and the grid of products. The filters live in the page address (see
// lib/filter.js), so a filtered page can be shared and a reload keeps it.
function ProductBrowser({ category, products }) {
  const page = PAGES[category];
  const [searchParams, setSearchParams] = useSearchParams();
  const resultsHeading = useRef(null);

  const options = filterOptions(products);
  const selected = readFilters(searchParams, options);
  const shown = filterProducts(products, selected);
  const tickedCount = selected.flavors.length + selected.caffeine.length + selected.formats.length;

  const noun = products.length === 1 ? page.one : page.many;
  const countText =
    tickedCount > 0
      ? `Showing ${shown.length} of ${products.length} ${noun}`
      : `${products.length} ${noun}`;

  // Every change replaces the history entry, so Back leaves the page instead of
  // undoing one tick at a time. It keeps the scroll position (a new address would
  // otherwise scroll to the top) and updates the page within the same click, so a
  // box that was just ticked does not flick back while the router catches up.
  function update(next) {
    setSearchParams(writeFilters(searchParams, next), {
      replace: true,
      preventScrollReset: true,
      flushSync: true,
    });
  }

  function toggle(group, value, checked) {
    const chosen = new Set(selected[group]);
    if (checked) chosen.add(value);
    else chosen.delete(value);
    // In the order the boxes are listed, so one choice always makes one address.
    const inListOrder = options[group].map((option) => option.value).filter((v) => chosen.has(v));
    update({ ...selected, [group]: inListOrder });
  }

  function clear() {
    update(NO_FILTERS);
    // The button that was pressed goes away with the filters, so take focus to the
    // start of the list instead of letting it drop to the top of the page.
    resultsHeading.current?.focus();
  }

  return (
    <div className="mt-8 md:mt-10 md:grid md:grid-cols-[15rem_minmax(0,1fr)] md:items-start md:gap-10">
      <Filters options={options} selected={selected} onToggle={toggle} />

      <div className="mt-6 min-w-0 md:mt-0">
        {/* Gives the product names (h3) a heading above them, and somewhere to put focus. */}
        <h2 ref={resultsHeading} tabIndex={-1} className="sr-only focus:outline-none">
          Products
        </h2>

        <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-4">
          <p role="status" aria-live="polite" className="text-sm font-semibold text-ink">
            {countText}
          </p>
          {tickedCount > 0 && shown.length > 0 && (
            <button
              type="button"
              onClick={clear}
              className="inline-flex min-h-11 items-center text-sm font-semibold text-sage-deep underline underline-offset-4 hover:no-underline"
            >
              Clear filters
            </button>
          )}
        </div>

        {shown.length > 0 ? (
          <ul className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-3 lg:gap-6">
            {shown.map((product) => (
              <li key={product.slug}>
                <ProductCard product={product} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-4 rounded-3xl bg-sage-tint px-6 py-10 text-center">
            <p className="text-balance font-serif text-xl font-semibold text-sage-deep">
              Nothing matches those filters yet.
            </p>
            <button type="button" onClick={clear} className={`${FILLED_BUTTON} mt-5`}>
              Clear filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * The tea page and the coffee page: one component, told which by `category` ('tea'
 * or 'coffee', the two the router passes).
 *
 * It always has its own h1, because the coming-soon panel is an h2. While the store
 * is closed, or there is nothing to sell in this category, the page shows that panel
 * and no products, prices or filters. Otherwise it shows the filters and a grid of
 * product cards.
 */
export default function Shop({ category }) {
  const page = PAGES[category];
  const products = isStoreOpen() ? getProducts(category) : [];
  const comingSoon = products.length === 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 md:py-14">
      {/* A div, not a header: Layout has the page's one banner, and Testing Library
          counts every header as a banner. */}
      <div className="text-center">
        <h1 className="text-balance font-serif text-4xl font-semibold leading-tight text-sage-deep md:text-5xl">
          {page.title}
        </h1>
        {!comingSoon && (
          <p className="mx-auto mt-3 max-w-xl text-pretty text-lg leading-relaxed">
            Pick a flavor, a caffeine level or a format and we'll narrow things down.
          </p>
        )}
      </div>

      {comingSoon ? (
        <div className="mt-8 md:mt-10">
          <ComingSoon interest={category} />
        </div>
      ) : (
        <ProductBrowser key={category} category={category} products={products} />
      )}
    </div>
  );
}
