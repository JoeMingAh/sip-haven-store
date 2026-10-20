import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';

// DRAFT COPY: the wording here needs Joseph's approval.

// The groups, in the order they appear. A group with no options is left out.
const GROUPS = [
  { key: 'flavors', legend: 'Flavor' },
  { key: 'caffeine', legend: 'Caffeine' },
  { key: 'formats', legend: 'Format' },
];

/**
 * The shop's filter boxes: one fieldset of checkboxes for each group in `options`
 * (from lib/filter.js: { flavors, caffeine, formats }, each a list of { value, label }).
 * `selected` has the same three groups, each a list of ticked values, and
 * `onToggle(group, value, checked)` is called when a box is ticked or unticked.
 *
 * The component keeps no filter state of its own; the page holds it in the address.
 * It only remembers whether the panel is folded open on a small screen. Below md the
 * panel hides behind a Filters button that says how many boxes are ticked; from md up
 * it is always showing and the button is gone.
 */
export default function Filters({ options, selected, onToggle }) {
  const panelId = useId();
  const [open, setOpen] = useState(false);

  const groups = GROUPS.filter(({ key }) => options[key].length > 0);
  const tickedCount = GROUPS.reduce((count, { key }) => count + selected[key].length, 0);

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
        className="inline-flex min-h-11 items-center gap-2 rounded-full bg-sage-tint px-5 text-sm font-semibold text-sage-deep hover:bg-wood md:hidden"
      >
        Filters{tickedCount > 0 ? ` (${tickedCount})` : ''}
        <ChevronDown
          aria-hidden="true"
          size={18}
          className={`transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <div
        id={panelId}
        className={`${open ? 'block' : 'hidden'} mt-3 rounded-3xl bg-sage-tint p-5 md:mt-0 md:block`}
      >
        <h2 className="font-serif text-xl font-semibold text-sage-deep">Filters</h2>

        {groups.map(({ key, legend }) => (
          <fieldset key={key} className="mt-4 min-w-0">
            <legend className="font-semibold text-sage-deep">{legend}</legend>
            {/* Two columns while the panel is full width, one in the narrow side column. */}
            <div className="mt-1 grid grid-cols-2 gap-x-4 md:grid-cols-1">
              {options[key].map(({ value, label }) => (
                <label key={value} className="flex min-h-11 cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selected[key].includes(value)}
                    onChange={(event) => onToggle(key, value, event.target.checked)}
                    className="h-5 w-5 shrink-0 accent-sage-deep"
                  />
                  <span className="min-w-0 first-letter:uppercase">{label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
    </div>
  );
}
