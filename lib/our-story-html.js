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
  OUR_STORY_LINKS,
  OUR_STORY_PARAGRAPHS,
  OUR_STORY_PRERENDER_ID,
  OUR_STORY_QUESTIONS_HEADING,
  OUR_STORY_SUBHEAD,
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

const tagged = (tag, className, text) =>
  `<${tag} class="${className}">${escapeHtml(text)}</${tag}>`;

/** The story markup: same words and classes as src/pages/OurStory.jsx. The leaf is
 * decorative, so it stays on the React page and is not repeated here. */
export function ourStoryArticleHtml() {
  const paragraphs = OUR_STORY_PARAGRAPHS.map((paragraph) => tagged('p', STORY_CLASS.body, paragraph)).join('');
  const links = OUR_STORY_LINKS.map(
    (link) =>
      `<a href="${link.href}" class="${link.filled ? STORY_CLASS.filled : STORY_CLASS.outline}">${escapeHtml(link.label)}</a>`,
  ).join('');
  const chevron =
    `<svg aria-hidden="true" viewBox="0 0 20 20" class="${STORY_CLASS.chevron}">` +
    `<path d="M5 7.5 10 12.5 15 7.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>` +
    `</svg>`;
  const faqs = OUR_STORY_FAQS.map(
    (faq) =>
      `<details class="${STORY_CLASS.faqItem}">` +
      `<summary class="${STORY_CLASS.summary}">${tagged('h3', STORY_CLASS.question, faq.question)}${chevron}</summary>` +
      tagged('p', STORY_CLASS.answer, faq.answer) +
      `</details>`,
  ).join('');

  return (
    `<div class="${STORY_CLASS.page}">` +
    tagged('h1', STORY_CLASS.title, OUR_STORY_TITLE) +
    tagged('p', STORY_CLASS.subhead, OUR_STORY_SUBHEAD) +
    paragraphs +
    `<div class="${STORY_CLASS.actions}">${links}</div>` +
    `<section class="${STORY_CLASS.questions}">` +
    tagged('h2', STORY_CLASS.questionsHeading, OUR_STORY_QUESTIONS_HEADING) +
    `<div class="${STORY_CLASS.faqList}">${faqs}</div>` +
    `</section>` +
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
