import { Outlet, ScrollRestoration } from 'react-router-dom';
import ShippingStrip from './ShippingStrip.jsx';
import Header from './Header.jsx';
import Footer from './Footer.jsx';

export default function Layout() {
  return (
    <div className="flex min-h-dvh flex-col bg-cream font-sans text-ink">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-cream focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-sage-deep focus:shadow-lg"
      >
        Skip to content
      </a>
      <ShippingStrip />
      <Header />
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <ScrollRestoration />
    </div>
  );
}
