import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  FAQ_JSON_LD_ID,
  ORGANIZATION_JSON_LD_ID,
  OUR_STORY_CTA,
  OUR_STORY_EYEBROW,
  OUR_STORY_FAQS,
  OUR_STORY_HEADLINE,
  OUR_STORY_INTRO,
  OUR_STORY_QUESTIONS_HEADING,
  OUR_STORY_QUOTE,
  OUR_STORY_SECTIONS,
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
 * /our-story. Approved copy (src/data/ourStory.js), set in a quiet sequence:
 * a short opening, a pull quote, three labeled sections, a quiz panel, then
 * the questions. The build writes the same words into our-story.html.
 */
export default function OurStory() {
  const [quietCorner, ...rest] = OUR_STORY_SECTIONS;

  return (
    <div className={STORY_CLASS.page}>
      <StoryJsonLd />

      <div className={STORY_CLASS.hero}>
        <p className={STORY_CLASS.eyebrow}>{OUR_STORY_EYEBROW}</p>
        <h1 className={STORY_CLASS.headline}>{OUR_STORY_HEADLINE}</h1>
        <p className={STORY_CLASS.intro}>{OUR_STORY_INTRO}</p>
      </div>

      <blockquote className={STORY_CLASS.quote}>
        <p>{OUR_STORY_QUOTE}</p>
      </blockquote>

      <section className={STORY_CLASS.section}>
        <div className={STORY_CLASS.measure}>
          <h2 className={STORY_CLASS.label}>{quietCorner.label}</h2>
          <p className={STORY_CLASS.body}>{quietCorner.text}</p>
        </div>
        <div className={STORY_CLASS.moments}>
          {quietCorner.moments.map((line, index) => (
            <p key={line} className={index === 0 ? STORY_CLASS.momentFirst : STORY_CLASS.momentSecond}>
              {line}
            </p>
          ))}
        </div>
      </section>

      {rest.map((section) => (
        <section key={section.label} className={`${STORY_CLASS.section} ${STORY_CLASS.measure}`}>
          <h2 className={STORY_CLASS.label}>{section.label}</h2>
          <p className={STORY_CLASS.body}>{section.text}</p>
        </section>
      ))}

      <section className={STORY_CLASS.cta}>
        <h2 className={STORY_CLASS.ctaPrompt}>{OUR_STORY_CTA.prompt}</h2>
        <Link to="/quiz" className={STORY_CLASS.ctaLink}>
          {OUR_STORY_CTA.link}
        </Link>
      </section>

      <section className={`${STORY_CLASS.section} ${STORY_CLASS.measure}`}>
        <h2 className={STORY_CLASS.label}>{OUR_STORY_QUESTIONS_HEADING}</h2>
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
