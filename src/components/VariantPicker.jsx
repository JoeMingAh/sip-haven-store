import { useId } from 'react';
import { Check } from 'lucide-react';
import { formatLabel } from '../format.js';

// DRAFT COPY: the wording here needs Joseph's approval.

// A radio that looks like a chip. The radio is visually hidden but is still the real
// control (focus, the arrow keys, screen readers); the chip beside it, a `peer`, shows
// which one is checked and carries the focus ring. Checked chips are sage-deep with
// cream text, the pairing that passes WCAG AA (see tailwind.config.js). A fill is a
// difference of color, so the checked chip also carries a tick (see Chip).
//
// The padding on the left is not here, because it depends on whether the chip is
// checked (see Chip).
const CHIP =
  'relative flex min-h-11 flex-col justify-center rounded-2xl border-2 border-sage py-2 pr-4 text-base font-semibold leading-snug text-ink hover:bg-sage-tint peer-checked:border-sage-deep peer-checked:bg-sage-deep peer-checked:text-cream peer-checked:hover:bg-sage-deep peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-sage-deep';

// One chip: the words of a format or a size. The checked one has a tick in the cream of
// its text. The tick is drawn from the same `checked` as the radio, so it is on exactly
// one chip in each group. It sits in the chip's left padding, out of the flow, so the
// checked chip is padded wider on that side to keep the words clear of it.
function Chip({ checked, children }) {
  return (
    <span className={`${CHIP} ${checked ? 'pl-9' : 'pl-4'}`}>
      {checked && (
        <Check aria-hidden="true" size={18} className="absolute left-3 top-1/2 -translate-y-1/2" />
      )}
      {children}
    </span>
  );
}

const cupsText = (cups) => `about ${cups} ${cups === 1 ? 'cup' : 'cups'}`;

const hasCups = (variant) => Number.isInteger(variant.cups) && variant.cups >= 1;

/**
 * Choose a format, then a size. `variants` are the ones that can be bought (the page
 * passes purchasableVariants), `value` is the id of the chosen one, and `onChange`
 * is called with the id of the variant a click lands on. The picker holds no choice
 * of its own; the page keeps the id and hands it to the cart.
 *
 * Picking a format keeps the size when that format comes in it too (12 oz ground
 * after 12 oz whole bean), and otherwise lands on the format's first size. A size
 * shows how many cups it makes, as "about N cups", when the lineup says.
 */
export default function VariantPicker({ variants, value, onChange }) {
  const groupId = useId();
  if (!variants?.length) return null;

  const selected = variants.find((variant) => variant.id === value) ?? variants[0];
  const formats = [...new Set(variants.map((variant) => variant.format))];
  const sizes = variants.filter((variant) => variant.format === selected.format);

  function chooseFormat(format) {
    const next =
      variants.find((v) => v.format === format && v.size_label === selected.size_label) ??
      variants.find((v) => v.format === format);
    onChange(next.id);
  }

  return (
    <div className="space-y-5">
      <fieldset className="min-w-0">
        <legend className="font-semibold text-sage-deep">Format</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {formats.map((format) => {
            const checked = format === selected.format;
            return (
              <label key={format} className="relative cursor-pointer">
                <input
                  type="radio"
                  name={`${groupId}-format`}
                  value={format}
                  checked={checked}
                  onChange={() => chooseFormat(format)}
                  className="peer sr-only"
                />
                <Chip checked={checked}>{formatLabel(format)}</Chip>
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="min-w-0">
        <legend className="font-semibold text-sage-deep">Size</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {sizes.map((variant) => {
            const checked = variant.id === selected.id;
            return (
              <label key={variant.id} className="relative cursor-pointer">
                <input
                  type="radio"
                  name={`${groupId}-size`}
                  value={variant.id}
                  checked={checked}
                  onChange={() => onChange(variant.id)}
                  className="peer sr-only"
                />
                <Chip checked={checked}>
                  <span>{variant.size_label}</span>
                  {hasCups(variant) && (
                    <>
                      {' '}
                      <span className="text-xs font-normal">{cupsText(variant.cups)}</span>
                    </>
                  )}
                </Chip>
              </label>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
}
