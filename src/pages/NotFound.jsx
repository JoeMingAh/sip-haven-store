import { Link } from 'react-router-dom';

// Shown for any address that matches no page. A page can also render it itself
// when what it was asked for does not exist, such as a product slug that is not in
// the lineup, so the links give a lost shopper somewhere useful to go.
export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center">
      <h1 className="text-balance font-serif text-3xl font-semibold text-sage-deep md:text-4xl">
        We couldn't find that page
      </h1>
      <p className="mt-4 text-lg leading-relaxed">
        The link may be out of date, or the address may have a typo. Maybe one of these is what
        you were after.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          to="/tea"
          className="inline-flex min-h-11 items-center rounded-full bg-sage-tint px-6 text-sm font-semibold text-ink hover:bg-wood"
        >
          Browse tea
        </Link>
        <Link
          to="/coffee"
          className="inline-flex min-h-11 items-center rounded-full bg-wood px-6 text-sm font-semibold text-ink hover:bg-sage-tint"
        >
          Browse coffee
        </Link>
      </div>
      <p className="mt-6">
        <Link
          to="/"
          className="text-sm font-semibold text-sage-deep underline underline-offset-4 hover:no-underline"
        >
          Back to home
        </Link>
      </p>
    </div>
  );
}
