import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { applyPageMeta, pageMetaFor } from '../pageMeta.js';

// Sets the page's title, description and canonical link each time the address changes
// (see src/pageMeta.js). Renders nothing.
export default function PageMeta() {
  const { pathname } = useLocation();
  useEffect(() => applyPageMeta(pageMetaFor(pathname)), [pathname]);
  return null;
}
