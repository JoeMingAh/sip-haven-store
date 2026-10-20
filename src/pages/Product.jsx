import { Fragment, useState } from 'react';
import { useParams } from 'react-router-dom';
import { isStoreOpen } from '../../lib/store-config.js';
import { getProduct, getProducts, purchasableVariants } from '../../lib/catalog.js';
import { CAFFEINE_LABELS } from '../../lib/filter.js';
import { relatedProducts } from '../../lib/related.js';
import { useCart } from '../cart/CartContext.jsx';
import ComingSoon from '../components/ComingSoon.jsx';
import ProductCard from '../components/ProductCard.jsx';
import VariantPicker from '../components/VariantPicker.jsx';
import { placeholderFor } from '../assets/placeholders/index.js';
import { formatPrice } from '../format.js';
import NotFound from './NotFound.jsx';

// DRAFT COPY: the wording on this page needs Joseph's approval.

// The tile behind the picture, so tea and coffee look a little different (as on the
// product cards).
const TILE = { tea: 'bg-sage-tint', coffee: 'bg-wood' };

const SECTION_HEADING = 'font-serif text-xl font-semibold text-sage-deep';

// Filled buttons use sage-deep behind cream text, which is the pairing that passes
// WCAG AA (see tailwind.config.js).
const ADD_BUTTON =
  'inline-flex min-h-12 w-full items-center justify-center rounded-full bg-sage-deep px-8 text-base font-semibold text-cream hover:bg-ink sm:w-auto';
const UNAVAILABLE_BUTTON =
  'inline-flex min-h-12 w-full cursor-not-allowed items-center justify-center rounded-full bg-wood px-8 text-base font-semibold text-ink sm:w-auto';

// The main picture, and a row of small ones to switch between when there are several.
// The one showing has a sage-deep border and full strength; the others are dimmed, so
// which is chosen is not told by the border's color alone. Both follow aria-pressed.
// With no photos yet it shows the placeholder art, which is decoration.
function Gallery({ product }) {
  const photos = product.images ?? [];
  const [index, setIndex] = useState(0);
  const photo = photos[index];
  const tile = TILE[product.category] ?? TILE.tea;

  return (
    <div>
      <div className={`aspect-square overflow-hidden rounded-3xl ${tile}`}>
        {photo ? (
          <img
            src={photo}
            alt={index === 0 ? product.name : `${product.name}, photo ${index + 1}`}
            className="h-full w-full object-cover"
          />
        ) : (
          <img src={placeholderFor(product)} alt="" className="h-full w-full object-contain p-12" />
        )}
      </div>

      {photos.length > 1 && (
        <ul className="mt-3 flex flex-wrap gap-3">
          {photos.map((src, position) => (
            <li key={`${position}-${src}`}>
              <button
                type="button"
                aria-label={`Show photo ${position + 1} of ${photos.length}`}
                aria-pressed={position === index}
                onClick={() => setIndex(position)}
                className={`block h-16 w-16 overflow-hidden rounded-2xl border-2 border-transparent opacity-70 aria-pressed:border-sage-deep aria-pressed:opacity-100 ${tile}`}
              >
                <img src={src} alt="" className="h-full w-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// A titled block under the buying controls.
function DetailSection({ title, children }) {
  return (
    <section className="border-t border-wood py-6">
      <h2 className={SECTION_HEADING}>{title}</h2>
      <div className="mt-3 text-lg leading-relaxed">{children}</div>
    </section>
  );
}

// water_temp, amount and steep_time, as the lineup gives them. A coffee is brewed,
// not steeped.
function brewRows(product) {
  const guide = product.brew_guide;
  if (!guide) return [];
  return [
    ['Water temperature', guide.water_temp],
    ['Amount', guide.amount],
    [product.category === 'coffee' ? 'Brew time' : 'Steep time', guide.steep_time],
  ].filter(([, value]) => value);
}

// A text field of the lineup, trimmed: '' when the product has none, or only spaces.
const textOf = (value) => (typeof value === 'string' ? value.trim() : '');

// The story as paragraphs. A spreadsheet cell holds line breaks, not blank-line
// paragraphs, so every line with something on it is a paragraph.
function storyParagraphs(product) {
  return textOf(product.story)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

// One product, top to bottom: gallery, tea type, name, description, story and origin
// (each only when the lineup has it), format and size, price, Add to cart, then flavor
// notes, caffeine, brew guide, ingredients and a few more to look at.
function ProductDetails({ product }) {
  const { add, open } = useCart();
  const variants = purchasableVariants(product);
  const [variantId, setVariantId] = useState(variants[0]?.id);
  // Only a variant with a stripe_price_id is ever offered, so only one can be added.
  const variant = variants.find((candidate) => candidate.id === variantId) ?? variants[0];

  const notes = product.flavor_notes ?? [];
  const caffeine = Object.hasOwn(CAFFEINE_LABELS, product.caffeine)
    ? CAFFEINE_LABELS[product.caffeine]
    : product.caffeine;
  const brew = brewRows(product);
  const teaType = textOf(product.tea_type);
  const story = storyParagraphs(product);
  const origin = textOf(product.origin);
  const related = relatedProducts(product, getProducts(product.category));

  function handleAdd() {
    add(product.slug, variant.id, 1);
    open();
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:py-12">
      <div className="grid gap-8 md:grid-cols-2 md:gap-12">
        <Gallery product={product} />

        <div>
          {teaType && (
            <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-sage-deep">
              <span className="sr-only">Tea type: </span>
              {teaType}
            </p>
          )}
          <h1 className="text-balance font-serif text-3xl font-semibold leading-tight text-sage-deep md:text-4xl">
            {product.name}
          </h1>
          {product.short_description && (
            <p className="mt-3 text-pretty text-lg leading-relaxed">{product.short_description}</p>
          )}
          {story.length > 0 && (
            <div className="mt-4 space-y-3 text-pretty leading-relaxed">
              {story.map((paragraph, position) => (
                <p key={`${position}-${paragraph}`}>{paragraph}</p>
              ))}
            </div>
          )}
          {origin && <p className="mt-4 text-sm">Origin: {origin}</p>}

          {variant ? (
            <div className="mt-6 space-y-6">
              <VariantPicker variants={variants} value={variant.id} onChange={setVariantId} />
              <p aria-live="polite" className="font-serif text-3xl font-semibold text-sage-deep">
                <span className="sr-only">Price </span>
                {formatPrice(variant.price_cents)}
              </p>
              <button type="button" onClick={handleAdd} className={ADD_BUTTON}>
                Add to cart
              </button>
            </div>
          ) : (
            <div className="mt-6">
              <button type="button" disabled className={UNAVAILABLE_BUTTON}>
                Not available yet
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto mt-10 max-w-3xl">
        {notes.length > 0 && (
          <DetailSection title="Flavor notes">
            <ul className="flex flex-wrap gap-2">
              {notes.map((note, position) => (
                <li
                  key={`${position}-${note}`}
                  className="rounded-full bg-sage-tint px-3 py-1 text-sm font-semibold text-sage-deep"
                >
                  {note}
                </li>
              ))}
            </ul>
          </DetailSection>
        )}

        {caffeine && (
          <DetailSection title="Caffeine">
            <p>{caffeine}</p>
          </DetailSection>
        )}

        {brew.length > 0 && (
          <DetailSection title="Brew guide">
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1">
              {brew.map(([label, value]) => (
                <Fragment key={label}>
                  <dt className="font-semibold">{label}</dt>
                  <dd>{value}</dd>
                </Fragment>
              ))}
            </dl>
          </DetailSection>
        )}

        {product.ingredients && (
          <DetailSection title="Ingredients">
            <p>{product.ingredients}</p>
          </DetailSection>
        )}
      </div>

      {related.length > 0 && (
        <section className="mt-14 md:mt-20">
          <h2 className="text-center font-serif text-3xl font-semibold text-sage-deep">
            You might also like
          </h2>
          <ul className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6">
            {related.map((item) => (
              <li key={item.slug}>
                <ProductCard product={item} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

// What /products/:slug shows while the store is closed or has nothing to sell yet,
// whichever slug it is, so a closed shop gives away nothing about its lineup. The page
// keeps its own h1, because the coming-soon panel is an h2.
function ComingSoonProduct() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 md:py-14">
      <h1 className="text-balance text-center font-serif text-4xl font-semibold leading-tight text-sage-deep md:text-5xl">
        Coming soon
      </h1>
      <div className="mt-8 md:mt-10">
        <ComingSoon />
      </div>
    </div>
  );
}

/**
 * /products/:slug. While the store is closed, or open with an empty lineup, it is the
 * coming-soon panel under its own h1, for any slug, with no name, price or way to buy.
 * Otherwise an unknown slug is the friendly not-found page (which has its own h1), and
 * a known one is the product, with Add to cart only for a variant that can be bought.
 *
 * The details are keyed by slug, so going from one product to the next, as the
 * "You might also like" links do, starts with a fresh picker and gallery.
 */
export default function Product() {
  const { slug } = useParams();

  if (!isStoreOpen() || getProducts().length === 0) return <ComingSoonProduct />;

  const product = getProduct(slug);
  if (!product) return <NotFound />;

  return <ProductDetails key={product.slug} product={product} />;
}
