import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import VariantPicker from './VariantPicker.jsx';
import { variant } from '../test/fixtures.js';

// Coffee: two formats, each in two sizes, with the same sizes in both.
const COFFEE = [
  variant({ id: 'whole-bean-12oz', format: 'whole-bean', size_label: '12 oz', cups: 40 }),
  variant({ id: 'whole-bean-2lb', format: 'whole-bean', size_label: '2 lb', cups: 100 }),
  variant({ id: 'ground-12oz', format: 'ground', size_label: '12 oz', cups: 40 }),
  variant({ id: 'ground-2lb', format: 'ground', size_label: '2 lb', cups: 100 }),
];

// Tea: formats whose sizes differ.
const TEA = [
  variant({ id: 'loose-leaf-2oz', format: 'loose-leaf', size_label: '2 oz', cups: 25 }),
  variant({ id: 'loose-leaf-4oz', format: 'loose-leaf', size_label: '4 oz', cups: 50 }),
  variant({ id: 'tea-bags-15', format: 'tea-bags', size_label: '15 bags', cups: 15 }),
];

function renderPicker({ variants = COFFEE, value = variants[0]?.id, onChange = vi.fn() } = {}) {
  render(<VariantPicker variants={variants} value={value} onChange={onChange} />);
  return onChange;
}

const formatGroup = () => screen.getByRole('group', { name: 'Format' });
const sizeGroup = () => screen.getByRole('group', { name: 'Size' });
const radiosIn = (group) => within(group).getAllByRole('radio');
const labelsIn = (group) => radiosIn(group).map((radio) => radio.closest('label').textContent);

describe('VariantPicker: what it offers', () => {
  it('has a Format group and a Size group of radio buttons', () => {
    renderPicker();
    expect(radiosIn(formatGroup())).toHaveLength(2);
    expect(radiosIn(sizeGroup())).toHaveLength(2);
  });

  it('lists each format once, named the way shoppers read it', () => {
    renderPicker({ variants: [...TEA, variant({ id: 'k-cup-12', format: 'k-cup', size_label: '12 pods' })] });
    expect(labelsIn(formatGroup())).toEqual(['Loose leaf', 'Tea bags', 'K-Cup']);
  });

  it('keeps the formats in the order the lineup gives them', () => {
    renderPicker({ variants: COFFEE, value: 'ground-12oz' });
    expect(labelsIn(formatGroup())).toEqual(['Whole bean', 'Ground']);
  });

  it('lists only the sizes of the selected format', () => {
    const { rerender } = render(<VariantPicker variants={TEA} value="loose-leaf-4oz" onChange={() => {}} />);
    expect(labelsIn(sizeGroup())).toEqual(['2 oz about 25 cups', '4 oz about 50 cups']);

    rerender(<VariantPicker variants={TEA} value="tea-bags-15" onChange={() => {}} />);
    expect(labelsIn(sizeGroup())).toEqual(['15 bags about 15 cups']);
  });

  it('checks the selected format and size', () => {
    renderPicker({ variants: COFFEE, value: 'ground-2lb' });
    expect(within(formatGroup()).getByRole('radio', { name: 'Ground' })).toBeChecked();
    expect(within(formatGroup()).getByRole('radio', { name: 'Whole bean' })).not.toBeChecked();
    expect(within(sizeGroup()).getByRole('radio', { name: /2 lb/ })).toBeChecked();
    expect(within(sizeGroup()).getByRole('radio', { name: /12 oz/ })).not.toBeChecked();
  });

  it('draws nothing when there are no variants', () => {
    const { container } = render(<VariantPicker variants={[]} value="" onChange={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('VariantPicker: cups', () => {
  it('shows cups as "about N cups"', () => {
    renderPicker({ variants: TEA, value: 'loose-leaf-2oz' });
    expect(within(sizeGroup()).getByText('about 25 cups')).toBeInTheDocument();
    expect(within(sizeGroup()).getByText('about 50 cups')).toBeInTheDocument();
  });

  it('says "about 1 cup" for a single cup', () => {
    renderPicker({ variants: [variant({ id: 'sample', size_label: 'Sample', cups: 1 })], value: 'sample' });
    expect(screen.getByText('about 1 cup')).toBeInTheDocument();
  });

  it('says nothing about cups for a variant that does not list them', () => {
    renderPicker({ variants: [variant({ id: 'plain', size_label: '2 oz', cups: undefined })], value: 'plain' });
    expect(within(sizeGroup()).getByRole('radio', { name: '2 oz' })).toBeInTheDocument();
    expect(screen.queryByText(/cups?\b/)).not.toBeInTheDocument();
  });
});

// The selected chip is a dark fill with cream text, which is a color change. It also
// carries a tick, so the choice does not rest on color alone. The radios are hidden, so
// the tick is the one sign of selection that is not the fill.
describe('VariantPicker: the selected chip', () => {
  // Lucide draws the tick as an svg whose class names it.
  const ticksIn = (group) => [...group.querySelectorAll('svg.lucide-check')];
  // The text of every chip in the group that has a tick.
  const tickedChips = (group) =>
    ticksIn(group).map((tick) => tick.closest('label').textContent);
  // The chip a radio draws: the span that follows it.
  const chipOf = (radio) => radio.nextElementSibling;

  it('puts one tick, hidden from assistive technology, on the selected format and on the selected size', () => {
    renderPicker({ variants: COFFEE, value: 'ground-2lb' });
    for (const group of [formatGroup(), sizeGroup()]) {
      const ticks = ticksIn(group);
      expect(ticks).toHaveLength(1);
      expect(ticks[0]).toHaveAttribute('aria-hidden', 'true');
      // The radio in the same label as the tick is the checked one.
      expect(within(ticks[0].closest('label')).getByRole('radio')).toBeChecked();
    }
    expect(tickedChips(formatGroup())).toEqual(['Ground']);
    expect(tickedChips(sizeGroup())).toEqual(['2 lb about 100 cups']);
  });

  it('puts a tick on a chip if and only if it is selected', () => {
    renderPicker({ variants: COFFEE, value: 'ground-2lb' });
    const radios = [...radiosIn(formatGroup()), ...radiosIn(sizeGroup())];
    // Two chips are selected (a format and a size) and two are not.
    expect(radios.filter((radio) => radio.checked)).toHaveLength(2);
    expect(radios.filter((radio) => !radio.checked)).toHaveLength(2);
    for (const radio of radios) {
      const hasTick = radio.closest('label').querySelector('svg') !== null;
      expect(hasTick).toBe(radio.checked);
    }
  });

  it('moves the tick when the selection moves', () => {
    const { rerender } = render(
      <VariantPicker variants={COFFEE} value="whole-bean-12oz" onChange={() => {}} />,
    );
    expect(tickedChips(formatGroup())).toEqual(['Whole bean']);
    expect(tickedChips(sizeGroup())).toEqual(['12 oz about 40 cups']);

    rerender(<VariantPicker variants={COFFEE} value="ground-2lb" onChange={() => {}} />);
    expect(tickedChips(formatGroup())).toEqual(['Ground']);
    expect(tickedChips(sizeGroup())).toEqual(['2 lb about 100 cups']);
  });

  it('shows a tick for the only format and the only size, too', () => {
    renderPicker({ variants: [TEA[2]], value: 'tea-bags-15' });
    expect(tickedChips(formatGroup())).toEqual(['Tea bags']);
    expect(tickedChips(sizeGroup())).toEqual(['15 bags about 15 cups']);
  });

  it('ticks the first variant when the page has not chosen one', () => {
    renderPicker({ variants: COFFEE, value: 'no-such-variant' });
    expect(tickedChips(formatGroup())).toEqual(['Whole bean']);
    expect(tickedChips(sizeGroup())).toEqual(['12 oz about 40 cups']);
  });

  it('keeps the tick where the page says, not where a click landed: the page owns the choice', () => {
    renderPicker({ variants: COFFEE, value: 'whole-bean-12oz' });
    fireEvent.click(within(formatGroup()).getByRole('radio', { name: 'Ground' }));
    expect(tickedChips(formatGroup())).toEqual(['Whole bean']);
  });

  // The tick sits in the chip's left padding, so the words must start to its right: the
  // selected chip is padded wider on the left than the others, and only that one.
  it('makes room for the tick: only the selected chip has the extra left padding', () => {
    renderPicker({ variants: COFFEE, value: 'ground-2lb' });
    for (const group of [formatGroup(), sizeGroup()]) {
      for (const radio of radiosIn(group)) {
        const chip = chipOf(radio);
        if (radio.checked) {
          expect(chip).toHaveClass('pl-9');
          expect(chip).not.toHaveClass('pl-4');
        } else {
          expect(chip).toHaveClass('pl-4');
          expect(chip).not.toHaveClass('pl-9');
        }
      }
    }
  });
});

describe('VariantPicker: choosing', () => {
  it('sends the chosen variantId when a size is picked', () => {
    const onChange = renderPicker({ variants: COFFEE, value: 'ground-12oz' });
    fireEvent.click(within(sizeGroup()).getByRole('radio', { name: /2 lb/ }));
    expect(onChange).toHaveBeenCalledTimes(1);
    // The ground 2 lb, not the whole bean one: the chosen grind is kept.
    expect(onChange).toHaveBeenCalledWith('ground-2lb');
  });

  it('sends the variantId of the chosen format', () => {
    const onChange = renderPicker({ variants: COFFEE, value: 'whole-bean-12oz' });
    fireEvent.click(within(formatGroup()).getByRole('radio', { name: 'Ground' }));
    expect(onChange).toHaveBeenCalledWith('ground-12oz');
  });

  it('keeps the same size when the new format has it', () => {
    const onChange = renderPicker({ variants: COFFEE, value: 'whole-bean-2lb' });
    fireEvent.click(within(formatGroup()).getByRole('radio', { name: 'Ground' }));
    expect(onChange).toHaveBeenCalledWith('ground-2lb');
  });

  it('moves to the first size of the new format when it lacks that size', () => {
    const onChange = renderPicker({ variants: TEA, value: 'loose-leaf-4oz' });
    fireEvent.click(within(formatGroup()).getByRole('radio', { name: 'Tea bags' }));
    expect(onChange).toHaveBeenCalledWith('tea-bags-15');
  });

  it('does not change anything by itself: the page owns the choice', () => {
    renderPicker({ variants: COFFEE, value: 'whole-bean-12oz' });
    fireEvent.click(within(formatGroup()).getByRole('radio', { name: 'Ground' }));
    // The value prop did not change, so the same radio is still checked.
    expect(within(formatGroup()).getByRole('radio', { name: 'Whole bean' })).toBeChecked();
  });

  it('uses the name Format and Size for each group, so two pickers on a page do not share radios', () => {
    render(
      <>
        <VariantPicker variants={COFFEE} value="ground-12oz" onChange={() => {}} />
        <VariantPicker variants={COFFEE} value="whole-bean-2lb" onChange={() => {}} />
      </>,
    );
    const [first, second] = screen.getAllByRole('group', { name: 'Format' });
    const nameOf = (group) => radiosIn(group)[0].getAttribute('name');
    expect(nameOf(first)).not.toBe(nameOf(second));
    // Each picker checked its own format.
    expect(within(first).getByRole('radio', { name: 'Ground' })).toBeChecked();
    expect(within(second).getByRole('radio', { name: 'Whole bean' })).toBeChecked();
  });
});
