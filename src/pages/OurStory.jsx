import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { leafSprig } from '../assets/placeholders/index.js';
import {
  FAQ_JSON_LD_ID,
  ORGANIZATION_JSON_LD_ID,
  OUR_STORY_FAQS,
  OUR_STORY_LINKS,
  OUR_STORY_PARAGRAPHS,
  OUR_STORY_QUESTIONS_HEADING,
  OUR_STORY_SUBHEAD,
  OUR_STORY_TITLE,
  STORY_CLASS,
  ourStoryStructuredData,
} from '../data/ourStory.js';

// Puts the same JSON-LD the build writes into our-story.html into the head when a
// visitor opens this page without a full load (from another page). Removes it on
// the way out, so the rest of the shop does not carry the story's structured data.
function StoryJsonLd() {
  useEffect(() => {
    const { organization, faqPage } = ourStoryStructuredData();
    const scripts = [
      [ORGANIZATION_JSON_LD_ID, organization],
      [FAQ_JSON_LD_ID, faqPage],
    ].map(([id, data]) => {
      let script = document.getElementById(id);
      if (!script) {
        script = document.createElement('script');
        script.id = id;
        script.type = 'application/ld+json';
        document.head.append(script);
      }
      script.textContent = JSON.stringify(data);
      return script;
    });
    return () => {
      for (const script of scripts) script.remove();
    };
  }, []);
  return null;
}

/**
 * /our-story. The live page's shape: the leaf, "Our story", a serif subheading,
 * the paragraphs, and the three pill links. The questions follow, kept smaller.
 * Copy lives in src/data/ourStory.js. The build writes the same words into
 * our-story.html.
 */
export default function OurStory() {
  return (
    <div className={STORY_CLASS.page}>
      <StoryJsonLd />

      <img src={leafSprig} alt="" className={STORY_CLASS.leaf} />
      <h1 className={STORY_CLASS.title}>{OUR_STORY_TITLE}</h1>
      <p className={STORY_CLASS.subhead}>{OUR_STORY_SUBHEAD}</p>

      {OUR_STORY_PARAGRAPHS.map((paragraph) => (
        <p key={paragraph} className={STORY_CLASS.body}>
          {paragraph}
        </p>
      ))}

      <div className={STORY_CLASS.actions}>
        {OUR_STORY_LINKS.map((link) => (
          <Link key={link.href} to={link.href} className={link.filled ? STORY_CLASS.filled : STORY_CLASS.outline}>
            {link.label}
          </Link>
        ))}
      </div>

      <section className={STORY_CLASS.questions}>
        <h2 className={STORY_CLASS.questionsHeading}>{OUR_STORY_QUESTIONS_HEADING}</h2>
        <div className={STORY_CLASS.faqList}>
          {OUR_STORY_FAQS.map((faq) => (
            <details key={faq.question} className={STORY_CLASS.faqItem}>
              <summary className={STORY_CLASS.summary}>
                <h3 className={STORY_CLASS.question}>{faq.question}</h3>
                <svg aria-hidden="true" viewBox="0 0 20 20" className={STORY_CLASS.chevron}>
                  <path
                    d="M5 7.5 10 12.5 15 7.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </summary>
              <p className={STORY_CLASS.answer}>{faq.answer}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
