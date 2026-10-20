import { Link } from 'react-router-dom';
import { isStoreOpen } from '../../lib/store-config.js';
import { fromPriceCents } from '../../lib/catalog.js';
import { placeholderFor } from '../assets/placeholders/index.js';

// A card shows the first few notes, not all of them.
const MAX_NOTES = 3;

// The tile behind placeholder art, so tea and coffee cards look a little different.
const TILE = { tea: 'bg-sage-tint', coffee: 'bg-wood' };

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

// 1850 -> "$18.50"
const formatPrice = (cents) => usd.format(cents / 100);

/**
 * One product in a grid: picture, name, a few flavor notes and "from $X".
 *
 * It draws nothing while the store is closed, so a stray card can never put a
 * price on a closed store. The price is the lowest among the variants that can
 * be bought (fromPriceCents); when none can be, the card has no price at all.
 * The whole card is one link to the product page, through the name.
 */
export default function ProductCard({ product }) {
  if (!isStoreOpen()) return null;

  const photo = product.images?.[0];
  const notes = (product.flavor_notes ?? []).slice(0, MAX_NOTES);
  const fromCents = fromPriceCents(product);

  return (
    <article className="relative flex h-full flex-col overflow-hidden rounded-3xl border border-wood bg-cream transition-shadow focus-within:shadow-md hover:shadow-md has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-sage-deep">
      <div className={`aspect-square ${TILE[product.category] ?? TILE.tea}`}>
        {photo ? (
          <img src={photo} alt={product.name} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <img
            src={placeholderFor(product)}
            alt=""
            loading="lazy"
            className="h-full w-full object-contain p-6"
          />
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-serif text-lg font-semibold leading-snug text-sage-deep">
          {/* The link's ::after stretches over the whole card, so any tap on it opens the product. */}
          <Link
            to={`/products/${product.slug}`}
            className="after:absolute after:inset-0 hover:underline focus-visible:outline-none"
          >
            {product.name}
          </Link>
        </h3>

        {notes.length > 0 && (
          <ul aria-label="Flavor notes" className="mt-2 flex flex-wrap gap-1.5">
            {notes.map((note, index) => (
              <li
                key={`${index}-${note}`}
                className="rounded-full bg-sage-tint px-2.5 py-0.5 text-xs font-semibold text-sage-deep"
              >
                {note}
              </li>
            ))}
          </ul>
        )}

        {typeof fromCents === 'number' && (
          <p className="mt-auto pt-3 text-sm font-semibold text-ink">from {formatPrice(fromCents)}</p>
        )}
      </div>
    </article>
  );
}
