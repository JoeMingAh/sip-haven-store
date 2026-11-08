// Primary actions only: Shop, subscribe, quiz, add to cart, checkout.
// Cream on terracotta is 5.0:1 (see tailwind.config.js). Hover goes to ink,
// which keeps the cream label readable.
export const CTA_BUTTON =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-terracotta px-7 py-3 text-base font-semibold text-cream hover:bg-ink disabled:cursor-wait disabled:opacity-70';

// Full-width subscribe bar. Its height is set from the page so this one control
// is about a tenth of the page. Footer owns that sizing.
export const CTA_BAR =
  'flex min-h-24 w-full items-center justify-center gap-2 bg-terracotta px-6 py-8 text-center text-lg font-semibold text-cream hover:bg-ink';

// Secondary actions. Ink outline, no fill.
export const GHOST_BUTTON =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-full border-2 border-ink bg-transparent px-7 text-base font-semibold text-ink hover:bg-cream';
