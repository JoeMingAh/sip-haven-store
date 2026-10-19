import { useId } from 'react';
import { Link } from 'react-router-dom';
import { GUIDES } from '../data/guides.js';
import { teapot } from '../assets/placeholders/index.js';

// Filled buttons use sage-deep behind cream text, which is the pairing that passes
// WCAG AA (see tailwind.config.js). On the sage-tint panel the outline buttons fill
// with cream when hovered, since sage-tint would not show against it.
const FILLED_BUTTON =
  'inline-flex min-h-12 items-center rounded-full bg-sage-deep px-7 text-base font-semibold text-cream hover:bg-ink';
const OUTLINE_BUTTON =
  'inline-flex min-h-12 items-center rounded-full border-2 border-sage-deep px-7 text-base font-semibold text-sage-deep hover:bg-cream';

/**
 * /learn. The brewing guides in src/data/guides.js, each a card that opens its page.
 *
 * While there are none (the list ships empty, and the Learn link stays out of the
 * header and footer) the page says guides are on the way instead of showing an empty
 * list. It keeps its own h1 either way, because the panel is an h2 (ruling R22).
 * GUIDES is read while rendering, not copied at import, so adding a guide shows up.
 */
export default function Learn() {
  const panelId = useId();

  return (
    <div className="mx-auto max-w-prose px-4 py-10 md:py-14">
      {/* DRAFT COPY: needs Joseph's approval */}
      <h1 className="text-balance font-serif text-4xl font-semibold leading-tight text-sage-deep md:text-5xl">
        Brewing guides
      </h1>

      {GUIDES.length > 0 ? (
        <>
          <p className="mt-4 text-pretty text-xl leading-relaxed">
            Simple how-tos for a better cup at home.
          </p>
          <ul className="mt-8 space-y-4">
            {GUIDES.map((guide) => (
              <li key={guide.slug}>
                <article className="relative rounded-3xl bg-sage-tint p-6 transition-colors focus-within:shadow-md hover:bg-wood">
                  <h2 className="font-serif text-xl font-semibold leading-snug text-sage-deep">
                    {/* The link's ::after stretches over the whole card, so any tap on it opens the guide. */}
                    <Link
                      to={`/learn/${guide.slug}`}
                      className="after:absolute after:inset-0 hover:underline"
                    >
                      {guide.title}
                    </Link>
                  </h2>
                  {guide.summary && (
                    <p className="mt-2 text-pretty text-base leading-relaxed">{guide.summary}</p>
                  )}
                </article>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <section
          aria-labelledby={panelId}
          className="mt-8 rounded-3xl bg-sage-tint px-6 py-10 text-center sm:px-10"
        >
          <img src={teapot} alt="" className="mx-auto h-24 w-24" />
          <h2
            id={panelId}
            className="mt-4 text-balance font-serif text-3xl font-semibold text-sage-deep"
          >
            Guides are on the way
          </h2>
          <p className="mx-auto mt-3 max-w-md text-pretty text-lg leading-relaxed">
            We're writing simple how-tos for making a better cup at home. This is where they'll
            live.
          </p>
          <p className="mx-auto mt-3 max-w-md text-pretty text-lg leading-relaxed">
            In the meantime, the quiz can help you find a cup to try.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link to="/quiz" className={FILLED_BUTTON}>
              Take the quiz
            </Link>
            <Link to="/tea" className={OUTLINE_BUTTON}>
              Browse tea
            </Link>
            <Link to="/coffee" className={OUTLINE_BUTTON}>
              Browse coffee
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
