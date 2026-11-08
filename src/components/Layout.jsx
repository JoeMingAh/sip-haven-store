import { Suspense } from 'react';
import { Outlet, ScrollRestoration } from 'react-router-dom';
import PageMeta from './PageMeta.jsx';
import ShippingStrip from './ShippingStrip.jsx';
import Header from './Header.jsx';
import Footer from './Footer.jsx';
import CartDrawer from './CartDrawer.jsx';

// Side rails are the accent that scales with the page. Sage, not sage-deep: nothing
// is written on them. Together they are about 5% of a phone page and 8% of a desktop
// page. The shipping strip, icons and sage-deep buttons make up the rest. A wider
// rail on a phone crowded the accent, because the strip and the full-width buttons
// already take more of a short screen.
const ACCENT_RAIL = 'w-[2.5%] shrink-0 bg-sage md:w-[4%]';

export default function Layout() {
  return (
    <div className="flex min-h-dvh flex-col bg-cream font-sans text-ink">
      <PageMeta />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-cream focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-sage-deep focus:shadow-lg"
      >
        Skip to content
      </a>
      <ShippingStrip />
      <div className="flex flex-1 items-stretch">
        <div aria-hidden="true" className={ACCENT_RAIL} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Header />
          {/* scroll-mt: when Skip to content jumps here, stop below the sticky header (two
              rows on small screens, one from md up) instead of under it. It is set on
              <main> only, not as scroll-padding on <html>: that would also make the
              browser scroll to the top whenever focus lands in the header. */}
          <main id="main" className="flex-1 scroll-mt-28 md:scroll-mt-20">
            {/* Pages load lazily (src/router.jsx). Until the first one arrives, an empty
                screen-tall block holds the footer below the fold, so nothing jumps when the
                page appears. Later navigations keep the old page up while the next loads. */}
            <Suspense fallback={<div className="min-h-dvh" />}>
              <Outlet />
            </Suspense>
          </main>
          <Footer />
        </div>
        <div aria-hidden="true" className={ACCENT_RAIL} />
      </div>
      <CartDrawer />
      <ScrollRestoration />
    </div>
  );
}
