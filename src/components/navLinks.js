// The site's navigation links, in one place so the header and footer agree.
// Every `to` here is a route in src/router.jsx.
import { GUIDES } from '../data/guides.js';

const TEA = { to: '/tea', label: 'Tea' };
const COFFEE = { to: '/coffee', label: 'Coffee' };
const QUIZ = { to: '/quiz', label: 'Quiz' };
const LEARN = { to: '/learn', label: 'Learn' };
const OUR_STORY = { to: '/our-story', label: 'Our Story' };
const CONTACT = { to: '/contact', label: 'Contact' };
const SHIPPING_RETURNS = { to: '/shipping-returns', label: 'Shipping & Returns' };
const PRIVACY = { to: '/privacy', label: 'Privacy' };

// Learn only gets a link once there is a guide to read. GUIDES is checked each
// time the links are built, not at import.
const learnLinks = () => (GUIDES.length > 0 ? [LEARN] : []);

export function headerLinks() {
  return [TEA, COFFEE, QUIZ, ...learnLinks(), OUR_STORY];
}

export function footerLinks() {
  return {
    shop: [TEA, COFFEE, QUIZ, ...learnLinks()],
    about: [OUR_STORY, CONTACT, SHIPPING_RETURNS, PRIVACY],
  };
}
