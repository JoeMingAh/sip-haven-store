import { useEffect, useId, useRef, useState } from 'react';
import { ArrowLeft, Check, RotateCcw } from 'lucide-react';
import { isStoreOpen } from '../../lib/store-config.js';
import { getProducts } from '../../lib/catalog.js';
import { MAX_RECOMMENDATIONS, QUIZ_QUESTIONS, recommend } from '../../lib/quiz.js';
import ProductCard from '../components/ProductCard.jsx';
import SignupForm from '../components/SignupForm.jsx';
import { cupWithSteam } from '../assets/placeholders/index.js';
import { sendQuizNote } from '../quizNote.js';

// DRAFT COPY: the wording on this page needs Joseph's approval. The questions and
// their answers are in lib/quiz.js, with their own note.

const TOTAL = QUIZ_QUESTIONS.length;

// Heading looks. Text colors pair with their backgrounds for WCAG AA (see
// tailwind.config.js): sage-deep on cream and on sage-tint, ink on cream.
const STEP_HEADING = 'text-balance font-serif text-2xl font-semibold leading-snug text-sage-deep md:text-3xl';
const TEXT_BUTTON =
  'inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-sage-deep underline underline-offset-4 hover:no-underline';

/**
 * The h2 of a step: a question, or the result. The quiz mounts a fresh step each time
 * it moves (each question is keyed by its number in Quiz, and the result is a
 * different component), so when `grabFocus` is true the heading takes focus as it
 * appears. A keyboard or screen reader user lands on the new question instead of on
 * the button they just pressed, which is no longer there. tabIndex -1 lets script
 * focus it without adding it to the tab order, and no outline is drawn because
 * nothing on it can be pressed.
 */
function StepHeading({ id, grabFocus, className, children }) {
  const heading = useRef(null);

  useEffect(() => {
    if (grabFocus) heading.current?.focus();
  }, [grabFocus]);

  return (
    <h2 id={id} ref={heading} tabIndex={-1} className={`${className} focus:outline-none`}>
      {children}
    </h2>
  );
}

// One dot per question: the ones behind you are filled, this one is a longer filled
// pill, and the ones ahead are hollow. It is only decoration (the question number is
// in the heading, as text), so assistive technology skips it. The hollow ones sit on
// the sage-tint panel, where plain sage is only 3.1:1, so their ring is sage-deep.
function Dots({ step }) {
  return (
    <div aria-hidden="true" className="flex items-center justify-center gap-2">
      {QUIZ_QUESTIONS.map((question, index) => {
        let look = 'w-2.5 border-2 border-sage-deep';
        if (index < step) look = 'w-2.5 bg-sage-deep';
        if (index === step) look = 'w-7 bg-sage-deep';
        return <span key={question.id} className={`h-2.5 rounded-full ${look}`} />;
      })}
    </div>
  );
}

// One answer. It is a real button; pressing it records the answer and moves on. The
// answer already given (when the shopper has come back to this question) is marked
// with aria-current, a fill and a tick, so it does not rest on color alone. The
// others are outlined in sage-deep, since they sit on the sage-tint panel, where plain
// sage is only 3.1:1.
function Answer({ answer, chosen, onChoose }) {
  function handleClick(event) {
    // A double click would land its second click on the next question's button, which
    // has just taken this one's place, and answer it by accident.
    if (event.detail > 1) return;
    onChoose(answer.id);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-current={chosen ? 'true' : undefined}
      className={`flex min-h-14 w-full items-center gap-3 rounded-2xl border-2 px-5 py-3 text-left transition-colors motion-reduce:transition-none ${
        chosen
          ? 'border-sage-deep bg-sage-deep text-cream'
          : 'border-sage-deep bg-cream text-ink hover:bg-wood'
      }`}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-semibold leading-snug">{answer.label}</span>
        {answer.hint && (
          <>
            {/* A real space, so the name a screen reader gets reads "Low Just a gentle lift". */}{' '}
            <span className="mt-0.5 block text-sm leading-snug">{answer.hint}</span>
          </>
        )}
      </span>
      {chosen && <Check aria-hidden="true" size={22} className="shrink-0" />}
    </button>
  );
}

// A question, in its panel: the dots, the heading and its answers. The visually hidden
// "Question N of 5" is inside the heading, which is what takes focus, so it is read out
// with the question each time the quiz moves on.
function Question({ question, step, chosenId, grabFocus, onChoose }) {
  const headingId = useId();

  return (
    <div className="mx-auto max-w-xl rounded-3xl bg-sage-tint px-5 py-8 sm:px-8">
      <Dots step={step} />
      <StepHeading id={headingId} grabFocus={grabFocus} className={`mt-5 text-center ${STEP_HEADING}`}>
        <span className="sr-only">
          Question {step + 1} of {TOTAL}
        </span>{' '}
        {question.prompt}
      </StepHeading>
      <div role="group" aria-labelledby={headingId} className="mt-6 grid gap-3">
        {question.answers.map((answer) => (
          <Answer
            key={answer.id}
            answer={answer}
            chosen={answer.id === chosenId}
            onChoose={onChoose}
          />
        ))}
      </div>
    </div>
  );
}

// The signup on the result. It sends the quiz answers, the slugs of the picks on screen
// (best first, when there are any) with the first as the top match, and source 'quiz',
// so the email list knows what this shopper likes and which products suit them.
function QuizSignup({ answers, matches = [] }) {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className="mx-auto max-w-md text-left">
      <h3 id={headingId} className="font-serif text-xl font-semibold text-sage-deep">
        Get your matches by email
      </h3>
      <div className="mt-3">
        <SignupForm answers={answers} topMatch={matches[0]} matches={matches} source="quiz" />
      </div>
    </section>
  );
}

// What the shopper sees when the shop has nothing to show them yet: the store is
// closed, or nothing in the lineup fits. No products and no prices, only a way to be
// told when there is a match.
function StillBlending({ answers, grabFocus }) {
  return (
    <div className="mx-auto max-w-xl rounded-3xl bg-sage-tint px-6 py-10 text-center sm:px-10">
      <img src={cupWithSteam} alt="" className="mx-auto h-20 w-20" />
      <StepHeading grabFocus={grabFocus} className={`mt-4 ${STEP_HEADING}`}>
        We're still blending your perfect match
      </StepHeading>
      <p className="mx-auto mt-3 max-w-md text-pretty text-lg leading-relaxed">
        Leave your email and we'll tell you as soon as we have a cup that suits you.
      </p>
      <div className="mt-6">
        <QuizSignup answers={answers} />
      </div>
    </div>
  );
}

// The picks, as the same cards the shop uses. Three across from md up; two across on
// a phone, where a third or a lone card sits centered under them. The signup follows.
function Picks({ products, answers, grabFocus }) {
  return (
    <div>
      <StepHeading grabFocus={grabFocus} className={`text-center ${STEP_HEADING}`}>
        Here's what we'd pour for you
      </StepHeading>
      <p className="mx-auto mt-3 max-w-md text-center text-lg leading-relaxed">
        Your closest matches come first.
      </p>
      <ul className="mt-8 flex flex-wrap justify-center gap-4 md:gap-6">
        {products.map((product) => (
          <li key={product.slug} className="w-[calc(50%-0.5rem)] md:w-[calc(33.333%-1rem)]">
            <ProductCard product={product} />
          </li>
        ))}
      </ul>
      <div className="mx-auto mt-10 max-w-xl rounded-3xl bg-sage-tint px-6 py-8 sm:px-10">
        <QuizSignup answers={answers} matches={products.map((product) => product.slug)} />
      </div>
    </div>
  );
}

// While the store is closed nothing is looked up at all, so no product can reach the
// page. ProductCard also draws nothing when the store is closed; this keeps the
// heading and the list from appearing around empty cards.
//
// When the lineup cannot fill all MAX_RECOMMENDATIONS picks (which is always, while the
// store is closed), the answers are noted anonymously as an idea for a future product
// (see src/quizNote.js). Once per result: the result is mounted fresh each time the
// last question is answered, and the ref keeps a second effect run from sending twice.
function Result({ answers, grabFocus }) {
  const picks = isStoreOpen() ? recommend(answers, getProducts()) : [];
  const noted = useRef(false);

  useEffect(() => {
    if (noted.current || picks.length >= MAX_RECOMMENDATIONS) return;
    noted.current = true;
    sendQuizNote(answers, picks.length);
  }, [answers, picks.length]);

  return picks.length > 0 ? (
    <Picks products={picks} answers={answers} grabFocus={grabFocus} />
  ) : (
    <StillBlending answers={answers} grabFocus={grabFocus} />
  );
}

/**
 * The find-your-cup quiz: one question at a time, then up to three products from
 * the lineup (see lib/quiz.js), or a still-blending panel when there is nothing to
 * show. Either way the result ends with "Get your matches by email", a signup that
 * sends the answers along.
 *
 * It always has its own h1. `step` counts up from the first question; once it passes
 * the last, the page shows the result. Back goes one step toward the first question
 * and keeps every answer given, so changing one only means pressing a different
 * button; Start over forgets them all. The answers are not kept in the page address,
 * so the browser's own Back button leaves the quiz.
 *
 * Focus: every move, except the page opening, puts focus on the heading of the step
 * it arrives at (see StepHeading).
 */
export default function Quiz() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({}); // { question id: answer id }
  // False until the first answer is given, so the page opening does not pull focus
  // away from the top of the page. Back and Start over only exist after that.
  const [moved, setMoved] = useState(false);

  const finished = step >= TOTAL;
  const question = QUIZ_QUESTIONS[step];

  function choose(answerId) {
    setAnswers({ ...answers, [question.id]: answerId });
    setStep(step + 1);
    setMoved(true);
  }

  function back() {
    setStep(step - 1);
  }

  function startOver() {
    setAnswers({});
    setStep(0);
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 md:py-14">
      {/* A div, not a header: Layout has the page's one banner. */}
      <div className="text-center">
        <h1 className="text-balance font-serif text-4xl font-semibold leading-tight text-sage-deep md:text-5xl">
          Find your cup
        </h1>
        {!finished && (
          <p className="mx-auto mt-3 max-w-xl text-pretty text-lg leading-relaxed">
            A few quick questions, then we'll suggest cups to try.
          </p>
        )}
      </div>

      <div className="mt-8 md:mt-10">
        {finished ? (
          <Result answers={answers} grabFocus={moved} />
        ) : (
          <Question
            key={step}
            question={question}
            step={step}
            chosenId={answers[question.id]}
            grabFocus={moved}
            onChoose={choose}
          />
        )}
      </div>

      {step > 0 && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-8">
          <button type="button" onClick={back} className={TEXT_BUTTON}>
            <ArrowLeft aria-hidden="true" size={18} />
            Back
          </button>
          <button type="button" onClick={startOver} className={TEXT_BUTTON}>
            <RotateCcw aria-hidden="true" size={16} />
            Start over
          </button>
        </div>
      )}
    </div>
  );
}
