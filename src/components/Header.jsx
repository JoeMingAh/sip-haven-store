import { Link, NavLink } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';
import { isStoreOpen } from '../../lib/store-config.js';
import { useCart } from '../cart/CartContext.jsx';
import { headerLinks } from './navLinks.js';

const linkClass = ({ isActive }) =>
  `inline-flex min-h-11 items-center border-b-2 text-[15px] font-semibold ${
    isActive
      ? 'border-sage-deep text-sage-deep'
      : 'border-transparent text-ink hover:text-sage-deep'
  }`;

// Opens the cart drawer (CartDrawer, in Layout) and shows how many items are in the
// cart. A closed store shows no count, whatever an old visit left in the cart.
function CartButton() {
  const { count, open } = useCart();
  const items = isStoreOpen() ? count : 0;

  return (
    <button
      type="button"
      onClick={() => open()}
      aria-haspopup="dialog"
      aria-label={items > 0 ? `Cart, ${items} ${items === 1 ? 'item' : 'items'}` : 'Cart'}
      className="col-start-2 row-start-1 inline-flex min-h-11 items-center gap-2 justify-self-end rounded-full bg-sage-tint px-4 text-sm font-semibold text-sage-deep hover:bg-wood md:col-start-3"
    >
      <ShoppingBag aria-hidden="true" size={18} />
      Cart
      {items > 0 && (
        <span
          aria-hidden="true"
          className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-sage-deep px-1.5 text-xs font-bold text-cream"
        >
          {items}
        </span>
      )}
    </button>
  );
}

// Small screens: the wordmark and Cart share the first row and the links wrap onto
// a second row. From md up everything sits on one row.
export default function Header() {
  return (
    <header className="border-b border-wood bg-cream">
      <div className="mx-auto grid max-w-6xl grid-cols-[1fr_auto] items-center gap-x-4 px-4 py-2 md:grid-cols-[auto_1fr_auto] md:gap-x-10 md:py-3">
        <Link
          to="/"
          className="col-start-1 row-start-1 justify-self-start font-serif text-2xl font-semibold tracking-tight text-sage-deep"
        >
          Sip Haven
        </Link>

        <nav
          aria-label="Main"
          className="col-span-2 row-start-2 md:col-span-1 md:col-start-2 md:row-start-1"
        >
          <ul className="flex flex-wrap items-center justify-center gap-x-6 md:gap-x-8">
            {headerLinks().map(({ to, label }) => (
              <li key={to}>
                <NavLink to={to} className={linkClass}>
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <CartButton />
      </div>
    </header>
  );
}
