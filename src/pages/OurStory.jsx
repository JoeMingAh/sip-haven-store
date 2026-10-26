import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  FAQ_JSON_LD_ID,
  ORGANIZATION_JSON_LD_ID,
  OUR_STORY_EYEBROW,
  OUR_STORY_FAQS,
  OUR_STORY_HEADLINE,
  OUR_STORY_PARAGRAPHS,
  OUR_STORY_QUESTIONS_HEADING,
  OUR_STORY_QUIZ_LABEL,
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
 * /our-story. One column: the headline, three paragraphs, one button, then the
 * questions. Copy lives in src/data/ourStory.js. The build writes the same words
 * into our-story.html.
 */
export default function OurStory() {
  return (
    <div className={STORY_CLASS.page}>
      <StoryJsonLd />

      <p className={STORY_CLASS.eyebrow}>{OUR_STORY_EYEBROW}</p>
      <h1 className={STORY_CLASS.headline}>{OUR_STORY_HEADLINE}</h1>

      <div className={STORY_CLASS.paragraphs}>
        {OUR_STORY_PARAGRAPHS.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>

      <Link to="/quiz" className={STORY_CLASS.quiz}>
        {OUR_STORY_QUIZ_LABEL}
      </Link>

      <section className={STORY_CLASS.questions}>
        <h2 className={STORY_CLASS.questionsHeading}>{OUR_STORY_QUESTIONS_HEADING}</h2>
        {OUR_STORY_FAQS.map((faq) => (
          <div key={faq.question}>
            <h3 className={STORY_CLASS.question}>{faq.question}</h3>
            <p className={STORY_CLASS.answer}>{faq.answer}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
