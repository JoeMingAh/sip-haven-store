// Placeholder art, drawn for Sip Haven from plain shapes in the site palette (see
// placeholders.test.js). It stands in until there are real product photos: a leaf
// sprig for tea, a pair of beans for coffee, a steaming cup for anything else.
import leafSprig from './leaf-sprig.svg';
import cupWithSteam from './cup-with-steam.svg';
import teapot from './teapot.svg';
import coffeeBean from './coffee-bean.svg';

export { leafSprig, cupWithSteam, teapot, coffeeBean };

/** The placeholder picture for a product that has no photo of its own yet. */
export function placeholderFor(product) {
  if (product?.category === 'tea') return leafSprig;
  if (product?.category === 'coffee') return coffeeBean;
  return cupWithSteam;
}
