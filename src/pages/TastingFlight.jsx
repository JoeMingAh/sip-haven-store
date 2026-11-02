import { useId } from 'react';
import { useNavigate } from 'react-router-dom';
import { isStoreOpen } from '../../lib/store-config.js';
import { TASTING_FLIGHT_SLUG, TASTING_FLIGHT_VARIANT_ID } from '../../lib/offers.js';
import { isPurchasable } from '../cart/cartLines.js';
import { useCart } from '../cart/CartContext.jsx';
import { hero, lineup, topBar, valueModule } from '../content/tastingFlight.js';

// The look: architectural and quiet. Hairline rules instead of boxes and badges, wide
// margins, and high-contrast ink serif headings on cream. No photos and nothing loaded
// from elsewhere. All the words come from src/content/tastingFlight.js.

const RULE = 'border-ink/15';
const EYEBROW = 'text-xs font-semibold uppercase tracking-[0.2em] text-sage-deep';
const SECTION = `mx-auto max-w-6xl border-t ${RULE} px-4 py-16 md:px-8 md:py-24`;
const H2 = 'max-w-3xl text-balance font-serif text-3xl font-semibold leading-tight text-ink md:text-5xl';

// Cream text on ink (10.8:1), and on sage-deep when hovered (6.3:1); off, it is ink on wood.
const ORDER_BUTTON =
  'inline-flex min-h-14 w-full items-center justify-center rounded-full bg-ink px-8 text-base font-semibold text-cream hover:bg-sage-deep disabled:cursor-not-allowed disabled:bg-wood disabled:text-ink';

function TopBar() {
  return (
    <p className={`border-b ${RULE} px-4 py-3 text-center text-xs uppercase tracking-[0.18em] text-ink`}>
      {topBar.items.map((item, index) => (
        <span key={item}>
          {index > 0 && (
            <span aria-hidden="true" className="px-2 text-sage">
              •
            </span>
          )}
          <span className="inline-block">{item}</span>
        </span>
      ))}
    </p>
  );
}

// The order button. It puts one Tasting Flight in the shop's own cart (src/cart) and
// opens the cart at /cart. The cart line is { slug, variantId, qty } like every other;
// the $42 price, free shipping and the RESERVE15 credit code live with the offer in
// lib/offers.js, and /api/checkout prices it from there. No card details are taken
// here: payment is Stripe Checkout, which needs the live Stripe keys, the Flight's
// Stripe price and a RESERVE15 promotion code in Stripe (see lib/offers.js). Until the
// store is open and the price exists, the button is off.
function OrderButton() {
  const { add } = useCart();
  const navigate = useNavigate();
  const available = isStoreOpen() && isPurchasable(TASTING_FLIGHT_SLUG, TASTING_FLIGHT_VARIANT_ID);
  const noteId = useId();

  function handleOrder() {
    add(TASTING_FLIGHT_SLUG, TASTING_FLIGHT_VARIANT_ID, 1);
    navigate('/cart');
  }

  return (
    <div className="mt-10">
      <button
        type="button"
        onClick={handleOrder}
        disabled={!available}
        aria-describedby={noteId}
        className={ORDER_BUTTON}
      >
        {hero.cta}
      </button>
      <p id={noteId} className="mt-4 text-center text-sm text-ink">
        {hero.note}
        {!available && <span className="mt-1 block font-semibold">Not available yet</span>}
      </p>
    </div>
  );
}

function Hero() {
  return (
    <section className="mx-auto grid max-w-6xl gap-12 px-4 py-16 md:grid-cols-12 md:gap-16 md:px-8 md:py-24">
      <div className="md:col-span-7">
        <p className={EYEBROW}>{hero.eyebrow}</p>
        <h1 className="mt-6 text-balance font-serif text-4xl font-semibold leading-[1.05] text-ink sm:text-5xl md:text-6xl">
          {hero.headline}
        </h1>
        <p className="mt-8 max-w-xl text-pretty text-lg leading-relaxed text-ink">{hero.subheadline}</p>
      </div>

      <div className="md:col-span-5">
        <h2 className={EYEBROW}>{hero.specsTitle}</h2>
        <dl className={`mt-4 border-t ${RULE}`}>
          {hero.specs.map((spec) => (
            <div key={spec.title} className={`border-b ${RULE} py-5`}>
              <dt className="font-serif text-xl font-semibold text-ink">{spec.title}</dt>
              <dd className="mt-1 text-base leading-relaxed text-ink">{spec.detail}</dd>
            </div>
          ))}
        </dl>
        <OrderButton />
      </div>
    </section>
  );
}

// A real table. On a phone it scrolls sideways inside its own frame, so the page
// itself never does; the frame can take focus, so the keyboard can scroll it too.
function ComparisonTable() {
  const captionId = useId();
  const { columns, rows } = valueModule.table;

  return (
    <div
      role="region"
      aria-labelledby={captionId}
      tabIndex={0}
      className={`mt-12 max-w-full overflow-x-auto border-y ${RULE}`}
    >
      <table className="w-full min-w-[36rem] border-collapse text-left">
        <caption id={captionId} className="sr-only">
          {columns.join(', ')}
        </caption>
        <thead>
          <tr className={`border-b ${RULE}`}>
            {columns.map((column) => (
              <th key={column} scope="col" className={`${EYEBROW} w-1/3 px-4 py-4 align-bottom font-semibold`}>
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([measure, shelf, reserve]) => (
            <tr key={measure} className={`border-b ${RULE} last:border-b-0`}>
              <th scope="row" className="px-4 py-5 align-top font-serif text-lg font-semibold text-ink">
                {measure}
              </th>
              <td className="px-4 py-5 align-top text-base leading-relaxed text-ink">{shelf}</td>
              <td className="px-4 py-5 align-top text-base font-semibold leading-relaxed text-ink">{reserve}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ValueModule() {
  return (
    <section className={SECTION}>
      <h2 className={H2}>{valueModule.header}</h2>
      <p className="mt-8 max-w-3xl text-pretty text-lg leading-relaxed text-ink">{valueModule.body}</p>

      <ComparisonTable />

      <h3 className={`${EYEBROW} mt-16`}>{valueModule.arcTitle}</h3>
      <ol className={`mt-4 grid gap-px border-y ${RULE} bg-ink/15 md:grid-cols-3`}>
        {valueModule.arc.map((step) => (
          <li key={step.name} className="bg-cream py-6 md:px-6 md:first:pl-0">
            <p className="font-serif text-xl font-semibold text-ink">
              {step.name} <span className="text-sage-deep">({step.time})</span>
            </p>
            <p className="mt-2 text-base leading-relaxed text-ink">{step.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function CultivarCard({ cultivar }) {
  const details = [
    ['Cultivar', cultivar.cultivar],
    ['Liquor', cultivar.liquor],
    ['In the Cup', cultivar.inTheCup],
  ];
  return (
    <article className={`border-t ${RULE} pt-6`}>
      <h3 className="text-balance font-serif text-2xl font-semibold text-ink">{cultivar.name}</h3>
      <p className="mt-1 text-sm uppercase tracking-[0.15em] text-sage-deep">{cultivar.origin}</p>
      <dl className="mt-5 space-y-3">
        {details.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs font-semibold uppercase tracking-[0.15em] text-ink">{label}</dt>
            <dd className="mt-1 text-base leading-relaxed text-ink">{value}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

function Lineup() {
  return (
    <section className={SECTION}>
      <h2 className={H2}>{lineup.header}</h2>
      <p className="mt-8 max-w-3xl text-pretty text-lg leading-relaxed text-ink">{lineup.subhead}</p>

      <ul className="mt-14 grid gap-12 sm:grid-cols-2 md:gap-16">
        {lineup.cultivars.map((cultivar) => (
          <li key={cultivar.name}>
            <CultivarCard cultivar={cultivar} />
          </li>
        ))}
      </ul>

      <footer className={`mt-16 border-y ${RULE} py-8`}>
        <p className="mx-auto max-w-3xl text-pretty text-center font-serif text-lg leading-relaxed text-ink">
          {lineup.insideTheLid}
        </p>
      </footer>
    </section>
  );
}

/**
 * /tasting-flight: the $42 Taiwanese Tasting Flight. The top bar, then the hero with
 * the flight's specs and the order button, the value section (comparison table and
 * the three-infusion arc), and the four cultivars with the inside-the-lid note.
 */
export default function TastingFlight() {
  return (
    <div className="overflow-x-clip">
      <TopBar />
      <Hero />
      <ValueModule />
      <Lineup />
    </div>
  );
}
