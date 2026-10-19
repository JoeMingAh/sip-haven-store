import { CartProvider } from './cart/CartContext.jsx';
import Layout from './components/Layout.jsx';
import Cart from './pages/Cart.jsx';
import Home from './pages/Home.jsx';
import NotFound from './pages/NotFound.jsx';
import Product from './pages/Product.jsx';
import Quiz from './pages/Quiz.jsx';
import Shop from './pages/Shop.jsx';

// A page that is not built yet shows its name as a heading. Building a page means
// swapping its stub() for the real component here.
const stub = (name) => (
  <h1 className="mx-auto max-w-6xl px-4 py-16 font-serif text-3xl font-semibold text-sage-deep">
    {name}
  </h1>
);

// Every route sits inside Layout (shipping strip, header, footer), and Layout sits
// inside the CartProvider, so the Header's Cart button, the product pages and the
// cart drawer all share one cart. main.jsx turns this list into the browser router,
// and the tests build memory routers from it.
export const routes = [
  {
    path: '/',
    element: (
      <CartProvider>
        <Layout />
      </CartProvider>
    ),
    children: [
      { index: true, element: <Home /> },
      { path: 'tea', element: <Shop category="tea" /> },
      { path: 'coffee', element: <Shop category="coffee" /> },
      { path: 'products/:slug', element: <Product /> },
      { path: 'quiz', element: <Quiz /> },
      { path: 'learn', element: stub('Learn') },
      { path: 'learn/:slug', element: stub('Guide') },
      { path: 'our-story', element: stub('Our Story') },
      { path: 'contact', element: stub('Contact') },
      { path: 'shipping-returns', element: stub('Shipping & Returns') },
      { path: 'privacy', element: stub('Privacy') },
      { path: 'success', element: stub('Success') },
      // Stripe sends a shopper who backs out of Checkout here: the home page with the
      // cart drawer open over it.
      { path: 'cart', element: <Cart /> },
      { path: '*', element: <NotFound /> },
    ],
  },
];
