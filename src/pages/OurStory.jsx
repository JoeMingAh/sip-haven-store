import { Link } from 'react-router-dom';
import { leafSprig } from '../assets/placeholders/index.js';

// Filled buttons use sage-deep behind cream text, which is the pairing that passes
// WCAG AA (see tailwind.config.js); plain sage stays for accents.
const FILLED_BUTTON =
  'inline-flex min-h-12 items-center rounded-full bg-sage-deep px-7 text-base font-semibold text-cream hover:bg-ink';
const OUTLINE_BUTTON =
  'inline-flex min-h-12 items-center rounded-full border-2 border-sage-deep px-7 text-base font-semibold text-sage-deep hover:bg-sage-tint';

const BODY = 'mt-5 text-pretty text-lg leading-relaxed';

/**
 * /our-story. A short welcome: Sip Haven as a place to slow down with tea and coffee.
 *
 * It states no history, numbers or sources, because none have been given to us: not
 * when Sip Haven began, where anything is sourced, any prize or press, who started it
 * or how many people buy from it. Add any of those only when Joseph supplies them.
 */
export default function OurStory() {
  return (
    <div className="mx-auto max-w-prose px-4 py-10 md:py-14">
      {/* DRAFT COPY: needs Joseph's approval */}
      <img src={leafSprig} alt="" className="h-16 w-16" />
      <h1 className="mt-4 text-balance font-serif text-4xl font-semibold leading-tight text-sage-deep md:text-5xl">
        Our story
      </h1>
      <p className="mt-4 text-pretty font-serif text-2xl leading-snug">
        Sip Haven is a place to slow down.
      </p>

      <p className={BODY}>
        A good cup is a small way to pause. It gives you a reason to sit down, take a breath and
        let the day catch up with you. That is what we want Sip Haven to feel like: a quiet corner
        where the kettle is always on.
      </p>
      <p className={BODY}>
        We love tea and coffee for the same reason. Both turn an ordinary moment into a little
        ritual, whether that is a pot of loose-leaf tea on a Sunday afternoon or a mug of coffee
        before the house wakes up.
      </p>
      <p className={BODY}>
        We're building a collection of teas and coffees for slow mornings, long talks and
        everything in between. Pull up a chair and take a look around.
      </p>
      <p className={BODY}>
        Not sure where to start? Try the quiz and we'll point you toward a cup you might like.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
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
    </div>
  );
}
