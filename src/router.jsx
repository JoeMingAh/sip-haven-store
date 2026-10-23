import { CartProvider } from './cart/CartContext.jsx';
import Layout from './components/Layout.jsx';
import { lazyPage } from './lazyPage.js';

// Each page is its own chunk, fetched when it is first shown, so a visit to one page
// does not download the others. The build's HTML for a page preloads its chunk (see
// PAGE_MODULES in vite.config.js), so the first page does not wait for the main bundle
// before fetching it.
const Cart = lazyPage(() => import('./pages/Cart.jsx'));
const Contact = lazyPage(() => import('./pages/Contact.jsx'));
const Guide = lazyPage(() => import('./pages/Guide.jsx'));
const Home = lazyPage(() => import('./pages/Home.jsx'));
const Learn = lazyPage(() => import('./pages/Learn.jsx'));
const NotFound = lazyPage(() => import('./pages/NotFound.jsx'));
const OurStory = lazyPage(() => import('./pages/OurStory.jsx'));
const Privacy = lazyPage(() => import('./pages/Privacy.jsx'));
const Product = lazyPage(() => import('./pages/Product.jsx'));
const Quiz = lazyPage(() => import('./pages/Quiz.jsx'));
const ShippingReturns = lazyPage(() => import('./pages/ShippingReturns.jsx'));
const Shop = lazyPage(() => import('./pages/Shop.jsx'));
const Success = lazyPage(() => import('./pages/Success.jsx'));

// Every route sits inside Layout (shipping strip, header, footer), and Layout sits
// inside the CartProvider, so the Header's Cart button, the product pages and the
// cart drawer all share one cart. main.jsx turns this list into the browser router,
// and the tests build memory routers from it.
//
// A new page also needs a rewrite in vercel.json: to its own HTML file if it has an
// entry in src/data/pageMeta.js (/tea -> /tea.html), otherwise to /app.html. Only the
// routes listed there load the app with a 200; any other address gets Vercel's 404.html
// (the app again, showing NotFound) with a real 404 status. src/routing.test.js checks
// the lists agree.
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
