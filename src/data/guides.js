// Brewing guides for /learn and /learn/:slug. The list stays empty until there are
// real guides to read, and while it is empty the Learn link is left out of the
// header and footer (see components/navLinks.js).
//
// A guide is { slug, title, summary, body }:
//   slug     its address, /learn/<slug>: lower case words joined by hyphens, and unique
//   title    the heading of its page, and its name on the Learn page
//   summary  a sentence or two, shown on the Learn page and again under the title
//   body     the guide itself, a list of paragraphs shown in order as plain text
//            (no markdown and no HTML)
//
// For example:
//   {
//     slug: 'steeping-basics',
//     title: 'Steeping basics',
//     summary: 'How hot, how long and how much.',
//     body: ['First paragraph.', 'Second paragraph.'],
//   }
export const GUIDES = [];
