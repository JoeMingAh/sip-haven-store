import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { leafSprig } from '../assets/placeholders/index.js';
import {
  FAQ_JSON_LD_ID,
  ORGANIZATION_JSON_LD_ID,
  OUR_STORY_FAQS,
  OUR_STORY_LEAD,
  OUR_STORY_PARAGRAPHS,
  OUR_STORY_QUESTIONS_HEADING,
  OUR_STORY_QUIZ,
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
 * /our-story. Approved copy (src/data/ourStory.js). The build also writes these
 * words into our-story.html for crawlers that do not run JavaScript.
 */
export default function OurStory() {
  return (
    <div className={STORY_CLASS.page}>
      <StoryJsonLd />
      <img src={leafSprig} alt="" className={STORY_CLASS.image} />
      <h1 className={STORY_CLASS.title}>{OUR_STORY_TITLE}</h1>
      <p className={STORY_CLASS.lead}>{OUR_STORY_LEAD}</p>
      {OUR_STORY_PARAGRAPHS.map((paragraph) => (
        <p key={paragraph} className={STORY_CLASS.body}>
          {paragraph}
        </p>
      ))}
      <p className={STORY_CLASS.body}>
        {OUR_STORY_QUIZ.before}
        <Link to="/quiz" className={STORY_CLASS.link}>
          {OUR_STORY_QUIZ.link}
        </Link>
        {OUR_STORY_QUIZ.after}
      </p>
      <h2 className={STORY_CLASS.section}>{OUR_STORY_QUESTIONS_HEADING}</h2>
      {OUR_STORY_FAQS.map((faq) => (
        <section key={faq.question}>
          <h3 className={STORY_CLASS.question}>{faq.question}</h3>
          <p className={STORY_CLASS.body}>{faq.answer}</p>
        </section>
      ))}
    </div>
  );
}
