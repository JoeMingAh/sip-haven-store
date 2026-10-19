import Layout from './components/Layout.jsx';
import NotFound from './pages/NotFound.jsx';

// A page that is not built yet shows its name as a heading. Building a page means
// swapping its stub() for the real component here.
const stub = (name) => (
  <h1 className="mx-auto max-w-6xl px-4 py-16 font-serif text-3xl font-semibold text-sage-deep">
    {name}
  </h1>
);

// Every route sits inside Layout (shipping strip, header, footer). main.jsx turns
// this list into the browser router, and the tests build memory routers from it.
export const routes = [
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: stub('Home') },
      { path: 'tea', element: stub('Tea') },
      { path: 'coffee', element: stub('Coffee') },
      { path: 'products/:slug', element: stub('Product') },
      { path: 'quiz', element: stub('Quiz') },
      { path: 'learn', element: stub('Learn') },
      { path: 'learn/:slug', element: stub('Guide') },
      { path: 'our-story', element: stub('Our Story') },
      { path: 'contact', element: stub('Contact') },
      { path: 'shipping-returns', element: stub('Shipping & Returns') },
      { path: 'privacy', element: stub('Privacy') },
      { path: 'success', element: stub('Success') },
      { path: 'cart', element: stub('Cart') },
      { path: '*', element: <NotFound /> },
    ],
  },
];
