import { CartProvider } from './cart/CartContext.jsx';
import Layout from './components/Layout.jsx';
import Cart from './pages/Cart.jsx';
import Contact from './pages/Contact.jsx';
import Guide from './pages/Guide.jsx';
import Home from './pages/Home.jsx';
import Learn from './pages/Learn.jsx';
import NotFound from './pages/NotFound.jsx';
import OurStory from './pages/OurStory.jsx';
import Privacy from './pages/Privacy.jsx';
import Product from './pages/Product.jsx';
import Quiz from './pages/Quiz.jsx';
import ShippingReturns from './pages/ShippingReturns.jsx';
import Shop from './pages/Shop.jsx';
import Success from './pages/Success.jsx';

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
      { path: 'learn', element: <Learn /> },
      { path: 'learn/:slug', element: <Guide /> },
      { path: 'our-story', element: <OurStory /> },
      { path: 'contact', element: <Contact /> },
      { path: 'shipping-returns', element: <ShippingReturns /> },
      { path: 'privacy', element: <Privacy /> },
      // Stripe sends a shopper here once the payment is done.
      { path: 'success', element: <Success /> },
      // Stripe sends a shopper who backs out of Checkout here: the home page with the
      // cart drawer open over it.
      { path: 'cart', element: <Cart /> },
      { path: '*', element: <NotFound /> },
    ],
  },
];
