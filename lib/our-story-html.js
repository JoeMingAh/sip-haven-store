// The /our-story words written into our-story.html at build time. Titles and
// descriptions stay in lib/page-html.js. This only adds the story, for a crawler
// that does not run JavaScript, and the JSON-LD that describes it.
//
// A short script removes the article as the HTML is parsed. Visitors who run
// JavaScript then see the React page, which uses the same words, instead of the
// article and the page together. The script does not run for a crawler that only
// reads the file, so the story stays in that file.
import {
  FAQ_JSON_LD_ID,
  ORGANIZATION_JSON_LD_ID,
  OUR_STORY_FAQS,
  OUR_STORY_LEAD,
  OUR_STORY_PARAGRAPHS,
  OUR_STORY_PRERENDER_ID,
  OUR_STORY_QUESTIONS_HEADING,
  OUR_STORY_QUIZ,
  OUR_STORY_TITLE,
  STORY_CLASS,
  ourStoryStructuredData,
} from '../src/data/ourStory.js';

const escapeHtml = (text) =>
  String(text).replace(/[&<>]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[char]);

function jsonScript(id, data) {
  // "<" would close the script tag early. The copy has none; this keeps it that way.
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return `<script type="application/ld+json" id="${id}">${json}</script>`;
}

/** The story markup: same words and classes as src/pages/OurStory.jsx, without the picture. */
export function ourStoryArticleHtml() {
  const paragraphs = OUR_STORY_PARAGRAPHS.map(
    (text) => `<p class="${STORY_CLASS.body}">${escapeHtml(text)}</p>`,
  ).join('');
  const faqs = OUR_STORY_FAQS.map(
    (faq) =>
      `<h3 class="${STORY_CLASS.question}">${escapeHtml(faq.question)}</h3>` +
      `<p class="${STORY_CLASS.body}">${escapeHtml(faq.answer)}</p>`,
  ).join('');
  return (
    `<div class="${STORY_CLASS.page}">` +
    `<h1 class="${STORY_CLASS.title}">${escapeHtml(OUR_STORY_TITLE)}</h1>` +
    `<p class="${STORY_CLASS.lead}">${escapeHtml(OUR_STORY_LEAD)}</p>` +
    paragraphs +
    `<p class="${STORY_CLASS.body}">${escapeHtml(OUR_STORY_QUIZ.before)}` +
    `<a href="/quiz" class="${STORY_CLASS.link}">${escapeHtml(OUR_STORY_QUIZ.link)}</a>` +
    `${escapeHtml(OUR_STORY_QUIZ.after)}</p>` +
    `<h2 class="${STORY_CLASS.section}">${escapeHtml(OUR_STORY_QUESTIONS_HEADING)}</h2>` +
    faqs +
    `</div>`
  );
}

const REMOVAL_SCRIPT = `<script>document.getElementById(${JSON.stringify(OUR_STORY_PRERENDER_ID)})?.remove()</script>`;

/**
 * `html` plus the story article and the two JSON-LD scripts. Throws if this is not
 * a full document, so a build cannot ship /our-story without them by mistake.
 */
export function withOurStoryContent(html) {
  if (!html.includes('</head>') || !html.includes('<body>')) {
    throw new Error('our-story.html needs a </head> and a <body> so the story can be added for crawlers.');
  }
  if (html.includes(OUR_STORY_PRERENDER_ID)) return html;

  const { organization, faqPage } = ourStoryStructuredData();
  const head = [
    jsonScript(ORGANIZATION_JSON_LD_ID, organization),
    jsonScript(FAQ_JSON_LD_ID, faqPage),
  ].join('\n    ');
  const article = `<article id="${OUR_STORY_PRERENDER_ID}">${ourStoryArticleHtml()}</article>`;

  return html
    .replace('</head>', `  ${head}\n  </head>`)
    .replace('<body>', `<body>\n    ${article}\n    ${REMOVAL_SCRIPT}`);
}
