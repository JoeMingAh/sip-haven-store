import { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from 'react';
import {
  addLine,
  itemCount,
  removeLine,
  restoreLines,
  sameLines,
  setLineQty,
  subtotalCents,
} from './cartLines.js';
import { CART_STORAGE_KEY, readStoredLines, writeStoredLines } from './cartStorage.js';

// What the shopper is told when a saved cart held something the lineup no longer sells.
export const STALE_NOTICE = 'Some items in your cart are no longer available and were removed.';

const CartContext = createContext(null);

// The cart and its drawer. Loading drops saved lines that can no longer be bought
// (see restoreLines) and sets the notice that says so.
function createState() {
  const { lines, droppedStale } = restoreLines(readStoredLines());
  return { lines, notice: droppedStale ? STALE_NOTICE : '', isOpen: false };
}

function withLines(state, lines) {
  return lines === state.lines ? state : { ...state, lines };
}

function reducer(state, action) {
  switch (action.type) {
    case 'add':
      return withLines(state, addLine(state.lines, action.slug, action.variantId, action.qty));
    case 'setQty':
      return withLines(state, setLineQty(state.lines, action.slug, action.variantId, action.qty));
    case 'remove':
      return withLines(state, removeLine(state.lines, action.slug, action.variantId));
    case 'clear':
      return { ...state, lines: [], notice: '' };
    case 'replace': {
      // Another tab changed the saved cart. It is checked like a cart loaded at the
      // start; the drawer and the notice are left as they are.
      const { lines } = restoreLines(action.stored);
      return sameLines(lines, state.lines) ? state : { ...state, lines };
    }
    case 'open':
      return state.isOpen ? state : { ...state, isOpen: true };
    case 'close':
      // The notice has been on show while the drawer was open; it is not repeated.
      return state.isOpen ? { ...state, isOpen: false, notice: '' } : state;
    default:
      return state;
  }
}

/**
 * Holds the cart for the whole app: its lines, a saved copy in localStorage, and
 * whether the cart drawer is open. Put it above everything that uses useCart.
 */
export function CartProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, createState);
  const { lines, notice, isOpen } = state;

  // Save every change. This also writes the cleaned cart right after loading, so a
  // stale line, or text that was not a cart, does not come back next visit.
  useEffect(() => {
    writeStoredLines(lines);
  }, [lines]);

  // A second tab of the shop shares the saved cart. When it changes the cart, follow it:
  // otherwise the next change made here would save this tab's old cart over theirs, and
  // a cart emptied after an order in one tab would come back from the other. The browser
  // sends this only to the other tabs, never to the one that saved.
  useEffect(() => {
    function handleStorage(event) {
      // The key is null when all of storage was cleared.
      if (event.key === null || event.key === CART_STORAGE_KEY) {
        dispatch({ type: 'replace', stored: readStoredLines() });
      }
    }
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const add = useCallback(
    (slug, variantId, qty = 1) => dispatch({ type: 'add', slug, variantId, qty }),
    [],
  );
  const setQty = useCallback(
    (slug, variantId, qty) => dispatch({ type: 'setQty', slug, variantId, qty }),
    [],
  );
  const remove = useCallback((slug, variantId) => dispatch({ type: 'remove', slug, variantId }), []);
  const clear = useCallback(() => dispatch({ type: 'clear' }), []);
  const open = useCallback(() => dispatch({ type: 'open' }), []);
  const close = useCallback(() => dispatch({ type: 'close' }), []);

  const value = useMemo(
    () => ({
      lines,
      count: itemCount(lines),
      subtotalCents: subtotalCents(lines),
      notice,
      isOpen,
      add,
      setQty,
      remove,
      clear,
      open,
      close,
    }),
    [lines, notice, isOpen, add, setQty, remove, clear, open, close],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

/**
 * The cart:
 *   lines          [{ slug, variantId, qty }], one per slug and variant
 *   count          units in the cart
 *   subtotalCents  price of the lines, from the lineup
 *   notice         set when loading dropped lines that are no longer sold
 *   isOpen         whether the cart drawer is open
 *   add(slug, variantId, qty = 1), setQty(slug, variantId, qty), remove(slug, variantId)
 *   clear()        empties the cart (after an order, say)
 *   open(), close()
 */
// A hook has to sit next to its provider; fast refresh only cares about components.
// eslint-disable-next-line react-refresh/only-export-components
export function useCart() {
  const cart = useContext(CartContext);
  if (cart === null) throw new Error('useCart must be used inside a <CartProvider>.');
  return cart;
}
