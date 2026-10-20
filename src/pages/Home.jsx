import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { isStoreOpen } from '../../lib/store-config.js';
import { getProducts } from '../../lib/catalog.js';
import { GUIDES } from '../data/guides.js';
import ComingSoon from '../components/ComingSoon.jsx';
import ProductCard from '../components/ProductCard.jsx';
import { leafSprig, teapot, coffeeBean } from '../assets/placeholders/index.js';

// DRAFT COPY: the wording on this page needs Joseph's approval.

// The two ways in. Each subtitle names the formats the shop is set up to sell.
const PATHS = [
  {
    to: '/tea',
    title: "I'm a tea person",
    // nowrap keeps "K-Cups" from breaking after the hyphen on a narrow phone.
    formats: (
      <>
        Loose leaf, tea bags and <span className="whitespace-nowrap">K-Cups</span>
      </>
    ),
    art: teapot,
    tile: 'bg-sage-tint',
  },
  {
    to: '/coffee',
    title: "I'm a coffee person",
    formats: 'Whole bean and ground',
    art: coffeeBean,
    tile: 'bg-wood',
  },
];

// Shared looks. Filled buttons use sage-deep behind cream text, which is the pairing
// that passes WCAG AA (see tailwind.config.js); plain sage stays for accents.
const SECTION = 'mx-auto mt-16 px-4 md:mt-24';
const HEADING = 'text-balance font-serif text-3xl font-semibold text-sage-deep md:text-4xl';
const FILLED_BUTTON =
  'inline-flex min-h-12 items-center gap-2 rounded-full bg-sage-deep px-7 text-base font-semibold text-cream hover:bg-ink';
const OUTLINE_BUTTON =
  'inline-flex min-h-12 items-center gap-2 rounded-full border-2 border-sage-deep px-7 text-base font-semibold text-sage-deep hover:bg-sage-tint';

function PathCard({ to, title, formats, art, tile }) {
  return (
    <Link
      to={to}
      className={`group flex items-center gap-4 rounded-3xl p-5 transition hover:shadow-md motion-safe:hover:-translate-y-0.5 ${tile}`}
    >
      <img src={art} alt="" className="h-16 w-16 shrink-0 rounded-full bg-cream p-2" />
      <span className="min-w-0 flex-1">
        <span className="block font-serif text-xl font-semibold text-sage-deep">{title}</span>
        <span className="mt-1 block text-sm leading-snug text-ink">{formats}</span>
      </span>
      <ArrowRight
        aria-hidden="true"
        size={22}
        className="shrink-0 text-sage-deep transition-transform motion-safe:group-hover:translate-x-1"
      />
    </Link>
  );
}

function Hero() {
  return (
    <section className="relative">
      {/* Sprigs frame the hero once there is room, and stay inside the page edges so
          nothing can scroll sideways. On a phone one small sprig sits above the heading. */}
      <img
        src={leafSprig}
        alt=""
        className="pointer-events-none absolute left-4 top-8 hidden h-44 w-44 opacity-30 md:block lg:left-12 lg:h-64 lg:w-64"
      />
      <img
        src={leafSprig}
        alt=""
        className="pointer-events-none absolute right-4 top-8 hidden h-44 w-44 -scale-x-100 opacity-30 md:block lg:right-12 lg:h-64 lg:w-64"
      />

      <div className="relative mx-auto max-w-3xl px-4 pb-2 pt-12 text-center md:pt-20">
        <img src={leafSprig} alt="" className="mx-auto h-16 w-16 md:hidden" />
        <h1 className="mt-4 text-balance font-serif text-4xl font-semibold leading-tight text-sage-deep md:mt-0 md:text-6xl">
          A little haven in every cup.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-pretty text-lg leading-relaxed">
          Tea and coffee for slow mornings and long talks. Where would you like to start?
        </p>
        <div className="mt-8 grid gap-4 text-left sm:grid-cols-2">
          {PATHS.map((path) => (
            <PathCard key={path.to} {...path} />
          ))}
        </div>
      </div>
    </section>
  );
}

function Featured({ products }) {
  return (
    <section aria-labelledby="home-picks" className={`${SECTION} max-w-6xl`}>
      <h2 id="home-picks" className={`${HEADING} text-center`}>
        Our picks
      </h2>
      <ul className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6 lg:grid-cols-4">
        {products.map((product) => (
          <li key={product.slug}>
            <ProductCard product={product} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function QuizTeaser() {
  return (
    <section aria-labelledby="home-quiz" className={`${SECTION} max-w-4xl`}>
      <div className="rounded-3xl bg-wood px-6 py-10 text-center md:px-12 md:py-14">
        <h2 id="home-quiz" className={HEADING}>
          Not sure where to begin?
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-pretty text-lg leading-relaxed">
          Answer a few quick questions and we'll point you toward a tea or coffee you might love.
        </p>
        <Link to="/quiz" className={`${FILLED_BUTTON} mt-6`}>
          Take the quiz
          <ArrowRight aria-hidden="true" size={18} />
        </Link>
      </div>
    </section>
  );
}

function StoryTeaser() {
  return (
    <section
      aria-labelledby="home-story"
      className={`${SECTION} grid max-w-5xl items-center gap-8 md:grid-cols-[auto_1fr] md:gap-14`}
    >
      <div className="mx-auto flex h-44 w-44 items-center justify-center rounded-full bg-sage-tint md:h-56 md:w-56">
        <img src={leafSprig} alt="" className="h-3/4 w-3/4" />
      </div>
      <div className="text-center md:text-left">
        <h2 id="home-story" className={HEADING}>
          A place to slow down
        </h2>
        <p className="mt-3 max-w-xl text-pretty text-lg leading-relaxed">
          Sip Haven is built around a simple idea: a good cup is a small way to pause. We're putting
          together tea and coffee for quiet mornings, long talks and everything in between.
        </p>
        <Link to="/our-story" className={`${OUTLINE_BUTTON} mt-6`}>
          Read our story
        </Link>
      </div>
    </section>
  );
}

function GuidesTeaser() {
  return (
    <section aria-labelledby="home-guides" className={`${SECTION} max-w-4xl`}>
      <div className="rounded-3xl bg-sage-tint px-6 py-10 text-center md:px-12 md:py-12">
        <h2 id="home-guides" className={HEADING}>
          Brewing guides
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-pretty text-lg leading-relaxed">
          Simple how-tos for a better cup at home.
        </p>
        <Link to="/learn" className={`${OUTLINE_BUTTON} mt-6`}>
          Read the guides
        </Link>
      </div>
    </section>
  );
}

// The home page. Under the hero sits either the featured products or, while the
// shop cannot sell yet, the coming-soon panel. The footer carries the last signup.
export default function Home() {
  const open = isStoreOpen();
  const products = open ? getProducts() : [];
  const featured = products.filter((product) => product.featured);

  // Closed, or open with an empty lineup: invite a signup rather than show an empty
  // grid. Open with a lineup but nothing featured: nothing to feature, so no section.
  const showComingSoon = !open || products.length === 0;

  return (
    <>
      <Hero />
      {showComingSoon ? (
        <div className={SECTION}>
          <ComingSoon />
        </div>
      ) : (
        featured.length > 0 && <Featured products={featured} />
      )}
      <QuizTeaser />
      <StoryTeaser />
      {GUIDES.length > 0 && <GuidesTeaser />}
    </>
  );
}
