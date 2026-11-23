# Find your cup

The quiz asks six questions, one at a time, then shows either up to three products or a still-blending panel. On the closed store the shopper always gets the still-blending panel, and the browser posts the answers to `/api/quiz-notes`.

## Sub-features

- `quiz-open` reaches the first question from the home page.
- `quiz-answer` records each answer and advances. The chosen answer keeps `aria-current="true"` when the shopper goes back.
- `quiz-still-blending` shows `We're still blending your perfect match` and the email signup, with no prices.
- `quiz-back` returns one question and keeps the answers.
- `quiz-start-over` clears the answers and returns to question 1.
- `quiz-picks` would show `Here's what we'd pour for you` and product cards. The committed lineup cannot do that.

## How to get to it (user POV)

- On the home page, choose `Take the quiz`.
- Choose `Quiz` in the header.
- Open `/quiz` directly.

## Driving it with the Sip Haven harness

Preconditions:

- `doctor.sh` prints `store=closed`.
- The browser is a fresh harness profile (no leftover quiz step).
- Do not type an email address and do not choose `Join the list`.

- **Open.** From the home page, choose `Take the quiz`. Run `node .cursor/skills/verify-sip-haven/harness.mjs goto /` and `node .cursor/skills/verify-sip-haven/harness.mjs click --role link --name "Take the quiz" --exact --wait-heading "Tea or coffee today?"`. The h1 is `Find your cup` and the h2 is `Question 1 of 6 Tea or coffee today?`. `Back` is absent.
- **Record the question.** Run `node .cursor/skills/verify-sip-haven/harness.mjs expect --role heading --name "Find your cup" --exact`, `node .cursor/skills/verify-sip-haven/harness.mjs expect --role button --name "Back" --exact --absent`, `node .cursor/skills/verify-sip-haven/harness.mjs screenshot --path quiz/01-question.png`, and `node .cursor/skills/verify-sip-haven/harness.mjs snapshot --path quiz/01-question.aria.txt`. The snapshot shows buttons `Tea`, `Coffee`, and `Either one Show me both`.
- **Answer.** Choose `Tea`, `Calm and unwound`, `Caffeine-free Nothing to keep me up`, `Floral Blossoms and soft fragrance`, `Surprise me No preference`, then `A slow ritual Loose leaf, Whole bean`. Run:
  - `node .cursor/skills/verify-sip-haven/harness.mjs click --role button --name "Tea" --exact --wait-heading "How do you want to feel?"`
  - `node .cursor/skills/verify-sip-haven/harness.mjs click --role button --name "Calm and unwound" --exact --wait-heading "How much caffeine would you like?"`
  - `node .cursor/skills/verify-sip-haven/harness.mjs click --role button --name "Caffeine-free Nothing to keep me up" --exact --wait-heading "Which flavors sound best?"`
  - `node .cursor/skills/verify-sip-haven/harness.mjs click --role button --name "Floral Blossoms and soft fragrance" --exact --wait-heading "Which aroma pulls you in?"`
  - `node .cursor/skills/verify-sip-haven/harness.mjs click --role button --name "Surprise me No preference" --exact --wait-heading "How do you like to make your cup?"`
  - `node .cursor/skills/verify-sip-haven/harness.mjs click --role button --name "A slow ritual Loose leaf, Whole bean" --exact --wait-heading "We're still blending your perfect match"`
- **Still blending.** The h2 is `We're still blending your perfect match`. The region `Get your matches by email` is visible. Main contains no `$`. Run `node .cursor/skills/verify-sip-haven/harness.mjs expect --role heading --name "We're still blending your perfect match" --exact`, `node .cursor/skills/verify-sip-haven/harness.mjs expect --role region --name "Get your matches by email" --exact`, `node .cursor/skills/verify-sip-haven/harness.mjs expect-main --absent --text "$"`, `node .cursor/skills/verify-sip-haven/harness.mjs screenshot --path quiz/02-result.png --full-page`, and `node .cursor/skills/verify-sip-haven/harness.mjs snapshot --path quiz/02-result.aria.txt`.
- **Note request.** The page has posted the answers. Run `node .cursor/skills/verify-sip-haven/harness.mjs expect-api --url /api/quiz-notes --method POST --status 404` and `node .cursor/skills/verify-sip-haven/harness.mjs api-log --path quiz/api-responses.jsonl`. The log line is a POST to `/api/quiz-notes` with status `404` and an empty body. That is the request, and it is not a stored note.
- **Back.** Choose `Back`. Run `node .cursor/skills/verify-sip-haven/harness.mjs click --role button --name "Back" --exact --wait-heading "How do you like to make your cup?"` and `node .cursor/skills/verify-sip-haven/harness.mjs expect-current --role button --name "A slow ritual Loose leaf, Whole bean" --exact`. Question 6 is showing and that answer is still current.
- **Start over.** Choose `Start over`. Run `node .cursor/skills/verify-sip-haven/harness.mjs click --role button --name "Start over" --exact --wait-heading "Tea or coffee today?"` and `node .cursor/skills/verify-sip-haven/harness.mjs expect --role button --name "Back" --exact --absent`. Question 1 is showing and the earlier answers are gone.
- **Picks.** Stop here when the heading is the still-blending panel. `quiz-picks` needs an open store and purchasable products. Report that precondition. Do not treat the still-blending panel as a passed pick list.

## Gotchas

- A second click on an answer is ignored (`event.detail > 1`), so a double-click does not answer the next question. The harness uses one click.
- The header `Tea` link and the answer `Tea` button are different roles. Use `--role button` for the answer.
- Hint text is part of the accessible name, after one space: `Caffeine-free Nothing to keep me up`, not `Caffeine-free`. `--exact` avoids matching `Floral` on the wrong step.
- Answers are not stored in the address. The browser Back button leaves `/quiz`. Use the on-page `Back` button.
- `Back` and `Start over` are rendered only after the first answer (`step > 0`). They are gone on question 1, including after `Start over`. Press `Start over` from a later question.
- `Join the list` is on the result and again in the footer. `click` will see two and fail. Do not submit the form.
- The `404` on `/api/quiz-notes` is what Vite returns because `api/quiz-notes.js` is not mounted. The shopper does not see an error. Do not call the production Blob store to make the POST succeed.
- `Here's what we'd pour for you` does not appear while `STORE_OPEN` is unset or the lineup has no purchasable products. `src/data/lineup.json` has no products. That is a failed `quiz-picks` precondition, not a reason to change the still-blending check.
