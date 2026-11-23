# Our story

Our story is a single page of approved copy: a title, a subheading, four paragraphs, three links, and three questions. Opening a question shows its answer on the page. Nothing is saved.

## Sub-features

- `story-read` shows the title, the subheading, and the story paragraphs.
- `story-links` offers `Take the quiz`, `Browse tea`, and `Browse coffee`.
- `story-faq` opens one question and shows its answer. The other questions stay collapsed.

## How to get to it (user POV)

- Choose `Our Story` in the header.
- On the home page, choose `Read our story`.
- Choose `Our Story` in the footer.
- Open `/our-story` directly.

## Driving it with the Sip Haven harness

Preconditions:

- `doctor.sh` prints `ok`. The story does not depend on the lineup.

- **Open from home.** Run `node .cursor/skills/verify-sip-haven/harness.mjs goto /` and `node .cursor/skills/verify-sip-haven/harness.mjs click --role link --name "Read our story" --exact --wait-heading "Our story"`. The address is `/our-story`.
- **Read.** The h1 is `Our story`. The subheading is `Sip Haven is a place to slow down and remember.` Run `node .cursor/skills/verify-sip-haven/harness.mjs expect --role heading --name "Our story" --exact` and `node .cursor/skills/verify-sip-haven/harness.mjs expect-text --text "Sip Haven is a place to slow down and remember." --exact`.
- **Links.** Run `node .cursor/skills/verify-sip-haven/harness.mjs expect --role link --name "Take the quiz" --exact`, `node .cursor/skills/verify-sip-haven/harness.mjs expect --role link --name "Browse tea" --exact`, and `node .cursor/skills/verify-sip-haven/harness.mjs expect --role link --name "Browse coffee" --exact`.
- **Open a question.** Choose the heading `What is Sip Haven?`. Run `node .cursor/skills/verify-sip-haven/harness.mjs click --role heading --name "What is Sip Haven?" --exact` and `node .cursor/skills/verify-sip-haven/harness.mjs expect-text --text "Sip Haven is an online tea and coffee store. We make tea and coffee for slow mornings, long talks and quiet moments to look back on." --exact`. The other two questions do not show their answers until chosen.
- **Proof.** Run `node .cursor/skills/verify-sip-haven/harness.mjs screenshot --path our-story/faq.png --full-page` and `node .cursor/skills/verify-sip-haven/harness.mjs snapshot --path our-story/faq.aria.txt`. The snapshot's first question group contains both the heading and the answer paragraph. The other two groups contain only their headings.

## Gotchas

- The questions are headings inside groups, not buttons. `click --role button --name "What is Sip Haven?"` finds nothing. Click the heading.
- A second click on the same heading collapses the answer. The proof needs the answer text visible, so click once.
- Header and footer both have an `Our Story` link. `Read our story` on the home page is a single link. Prefer that entry so the click matches one element.
- The words come from `src/data/ourStory.js`. Assert those sentences, not a paraphrase.
