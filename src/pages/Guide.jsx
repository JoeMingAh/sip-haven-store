import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { GUIDES } from '../data/guides.js';
import NotFound from './NotFound.jsx';

/**
 * /learn/:slug. One brewing guide from src/data/guides.js, rendered simply: the
 * title, the summary, then each paragraph of the body as plain text (no markdown and
 * no HTML, so a guide can never put markup on the page). A slug that is not among the
 * guides, which is every slug while the list is empty, is the not-found page.
 *
 * The slug must match exactly, so a guide has one address. GUIDES is read while
 * rendering, not copied at import.
 */
export default function Guide() {
  const { slug } = useParams();
  const guide = GUIDES.find((candidate) => candidate.slug === slug);
  if (!guide) return <NotFound />;

  // A guide with no body is just a title and a summary.
  const paragraphs = guide.body ?? [];

  return (
    <article className="mx-auto max-w-prose px-4 py-10 md:py-14">
      {/* DRAFT COPY: needs Joseph's approval */}
      <Link
        to="/learn"
        className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-sage-deep underline underline-offset-4 hover:no-underline"
      >
        <ArrowLeft aria-hidden="true" size={16} />
        All guides
      </Link>
      <h1 className="mt-4 text-balance font-serif text-4xl font-semibold leading-tight text-sage-deep md:text-5xl">
        {guide.title}
      </h1>
      {guide.summary && (
        <p className="mt-4 text-pretty text-xl leading-relaxed">{guide.summary}</p>
      )}

      <div className="mt-8 space-y-5">
        {paragraphs.map((paragraph, index) => (
          <p key={`${index}-${paragraph}`} className="text-pretty text-lg leading-relaxed">
            {paragraph}
          </p>
        ))}
      </div>
    </article>
  );
}
