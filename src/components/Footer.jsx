import { Link, useLocation } from 'react-router-dom';
import { footerLinks } from './navLinks.js';
import SignupForm from './SignupForm.jsx';

const YEAR = new Date().getFullYear();

// The shop pages whose drink the footer signup can pass on as the shopper's interest.
const INTEREST_BY_PATH = { '/tea': 'tea', '/coffee': 'coffee' };

function FooterColumn({ title, links }) {
  return (
    <div>
      <h2 className="font-serif text-lg font-semibold text-sage-deep">{title}</h2>
      <ul className="mt-3">
        {links.map(({ to, label }) => (
          <li key={to}>
            <Link
              to={to}
              className="inline-block min-w-11 py-1.5 text-sm text-ink underline-offset-4 hover:text-sage-deep hover:underline"
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Footer() {
  const { shop, about } = footerLinks();
  const { pathname } = useLocation();

  return (
    <footer className="mt-20 border-t border-wood bg-sage-tint text-ink">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-[3fr_2fr]">
        <div>
          <p className="font-serif text-2xl font-semibold text-sage-deep">Sip Haven</p>
          <p className="mt-3 max-w-xs text-sm leading-relaxed">
            Tea and coffee for slow mornings and long talks.
          </p>

          <div className="mt-8 max-w-md">
            <h2 className="font-serif text-lg font-semibold text-sage-deep">Stay in the loop</h2>
            <p className="mb-4 mt-1 text-pretty text-sm leading-relaxed">
              Leave your email and we'll let you know when something new is brewing.
            </p>
            <SignupForm interest={INTEREST_BY_PATH[pathname]} />
          </div>
        </div>

        <nav aria-label="Footer" className="grid grid-cols-2 gap-8">
          <FooterColumn title="Shop" links={shop} />
          <FooterColumn title="About" links={about} />
        </nav>
      </div>

      <p className="border-t border-wood px-4 py-4 text-center text-xs">
        &copy; {YEAR} Sip Haven
      </p>
    </footer>
  );
}
