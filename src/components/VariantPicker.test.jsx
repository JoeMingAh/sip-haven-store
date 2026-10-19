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
