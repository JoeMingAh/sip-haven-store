import { useId } from 'react';
import SignupForm from './SignupForm.jsx';
import { cupWithSteam } from '../assets/placeholders/index.js';

// DRAFT COPY: the wording here needs Joseph's approval.
//
// What a shop page shows in place of products while the store is closed or the
// lineup is empty: no prices, nothing to buy, just a way to hear when it opens.
// It is a section with an h2, so a page that shows only this still needs its own h1.
// `interest` ('tea' or 'coffee') goes to the signup when the page knows it.
export default function ComingSoon({ interest }) {
  const headingId = useId();

  return (
    <section
      aria-labelledby={headingId}
      className="mx-auto max-w-2xl rounded-3xl bg-sage-tint px-6 py-10 text-center sm:px-10 md:py-12"
    >
      <img src={cupWithSteam} alt="" className="mx-auto h-24 w-24" />
      <h2
        id={headingId}
        className="mt-4 text-balance font-serif text-3xl font-semibold text-sage-deep md:text-4xl"
      >
        Our first collection is brewing
      </h2>
      <p className="mx-auto mt-3 max-w-md text-pretty text-lg leading-relaxed">
        Leave your email and we'll tell you as soon as it's ready to pour.
      </p>
      <div className="mx-auto mt-6 max-w-md text-left">
        <SignupForm interest={interest} />
      </div>
    </section>
  );
}
