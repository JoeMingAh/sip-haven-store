import { useEffect } from 'react';
import { useCart } from '../cart/CartContext.jsx';
import Home from './Home.jsx';

/**
 * /cart. The cart is a drawer, not a page, but api/checkout.js sends a shopper who
 * backs out of Stripe Checkout to /cart (its cancel_url), and that address has to show
 * them their cart. So this is the home page with the cart drawer opened over it.
 *
 * It opens the drawer once, when the page is reached. Closing it leaves the shopper on
 * the home page, which is a fine place to carry on shopping from.
 */
export default function Cart() {
  const { open } = useCart();

  useEffect(() => {
    open();
  }, [open]);

  return <Home />;
}
