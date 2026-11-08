// A sage-tint or wood panel. It stays inset (max-w-3xl, or the prose column when
// that is narrower) so the cream ground still shows around it. A full-width slab
// pushed short pages well past a third secondary.
// `*-desktop` keeps the phone page on cream. A full-width phone panel plus the
// footer wood block was more than a third of a short screen.
const TONE = {
  tint: 'bg-sage-tint',
  wood: 'bg-wood',
  'tint-desktop': 'bg-transparent md:bg-sage-tint',
  'wood-desktop': 'bg-transparent md:bg-wood',
};

export default function Bleed({ tone = 'tint', className = '', children }) {
  return (
    <div className={`mx-auto max-w-3xl rounded-3xl ${TONE[tone]} ${className}`}>
      <div className="mx-auto max-w-prose px-5 py-8 md:px-8 md:py-10">{children}</div>
    </div>
  );
}
