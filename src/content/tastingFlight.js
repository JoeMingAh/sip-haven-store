// The copy for /tasting-flight (src/pages/TastingFlight.jsx) and the 21-day Reserve
// email sequence (also written out in emails/tasting-flight-sequence.md). Every string
// here is Joe's locked copy from docs/tasting-flight-spec.md, word for word, curly
// quotes and dashes included; src/content/tastingFlight.test.js checks each one is
// still in that file. Change the spec first, then this.
//
// UNCONFIRMED PRE-LAUNCH SPECS: several statements in this copy describe the product,
// the sourcing or the box before they have been confirmed. They are listed in `claims`
// below and must be checked before launch. The copy itself is left as approved.

/** Statements in this copy that are pre-launch specs and not yet confirmed. */
export const claims = [
  {
    id: 'four-cultivars-elevations',
    claim: 'Four single-origin cultivars at the stated regions and elevations (Alishan 1,300m, Jin Xuan 1,000m, Shanlinxi 1,600m, Ruby #18 750m).',
    where: ['hero', 'lineup', 'emails'],
  },
  {
    id: 'hand-rolled-family-gardens',
    claim: 'Whole, hand-rolled leaves sourced from high-elevation Taiwanese family gardens.',
    where: ['hero', 'valueModule', 'emails'],
  },
  {
    id: 'forty-five-cups',
    claim: '48 cups per Tasting Flight ($0.88 per infusion), 12 infusions per sample tin.',
    where: ['hero', 'valueModule'],
    note:
      'Four sample tins at 12 infusions each is 48 cups, and $42 / 48 = $0.875, shown as $0.88. Confirm the sample tin size and yield.',
  },
  {
    id: 'physical-credit-card',
    claim: 'A physical $15 Reserve Credit Card (CODE: RESERVE15) is enclosed in the box, valid 21 days.',
    where: ['hero', 'lineup', 'emails'],
    note: 'RESERVE15 must also exist as a promotion code in Stripe.',
  },
  {
    id: 'connoisseurs-reserve-bundle',
    claim: "An $88 Connoisseur's Reserve Bundle ($73 after credit) of two full-size tins plus a double-walled glass steeping vessel.",
    where: ['lineup', 'emails'],
    note: 'The bundle is not in the lineup or in Stripe yet.',
  },
  {
    id: 'direct-sourcing-nantou',
    claim: 'Sourcing handled directly with Taiwanese family farms and roasters, and a tasting room in Nantou.',
    where: ['emails (Email 4)'],
  },
];

export const topBar = {
  items: ['THE TAIWANESE RESERVE COLLECTION', 'Harvested at Elevation', 'Complimentary Shipping'],
};

export const hero = {
  eyebrow: 'FOUR SINGLE-ORIGIN CULTIVARS • WHOLE-LEAF • BUILT FOR THREE INFUSIONS',
  headline: 'An Unhurried Sanctuary in Four Tins.',
  subheadline:
    'Most tea on the shelf is built for shelves—crushed into dust, engineered for margin, and dressed up in adjectives. Sip Haven is the opposite. We source whole, hand-rolled leaves straight from high-elevation Taiwanese family gardens. Built to be steeped three times across a slow morning or a long afternoon at your desk.',
  specsTitle: 'Flight Architecture Specs',
  specs: [
    {
      title: 'Four Origin Tins',
      detail: 'Alishan, Shanlinxi, Jin Xuan TTES #12, and Sun Moon Lake Ruby #18',
    },
    {
      title: '48 Cups of Ritual',
      detail: '12 infusions per sample tin via traditional three-steep progression',
    },
    {
      title: 'The Sommelier’s Steep Journal',
      detail: 'Water temperatures, second-by-second steep times, and terroir notes',
    },
    {
      title: '$15 Reserve Credit Enclosed',
      detail: 'Applied toward your first full-size tin or Reserve Bundle within 21 days',
    },
  ],
  cta: 'Order the Tasting Flight — $42',
  note: 'Packed to order in airtight matte tins. Shipping is on us.',
};

export const valueModule = {
  header: 'Judge a Leaf by What Happens on the Second Steep.',
  body: "We don't judge tea by raw gram weight on a scale. We judge it by how many times the leaf welcomes hot water back into the cup. Commodity fannings surrender everything in sixty seconds and turn bitter. High-mountain whole leaf is dense with essential oils sourced from cool mist and slow growth—unfurling across three distinct infusions from a single 3-gram measure.",
  table: {
    columns: ['The Measure', 'Crushed Shelf Tea', 'Sip Haven Whole-Leaf Reserve'],
    rows: [
      ['Leaf Structure', 'Broken fannings & dust', 'Intact, hand-rolled two leaves and a bud'],
      ['Infusions per Serving', '1 steep before bitterness sets in', '3 distinct infusions per 3g portion'],
      ['Yield per Tasting Flight', '12–15 flat cups', '48 layered cups ($0.88 per infusion)'],
    ],
  },
  arcTitle: 'Three-Infusion Arc',
  arc: [
    {
      name: 'First Infusion',
      time: '60s',
      text: 'High-mountain aromatics and bright floral lift.',
    },
    {
      name: 'Second Infusion',
      time: '75s',
      text: 'The rolled leaf fully opens—round, buttery mouthfeel and deep sweetness.',
    },
    {
      name: 'Third Infusion',
      time: '90s',
      text: 'Clean mineral finish built for the long haul.',
    },
  ],
};

export const lineup = {
  header: 'Four Cultivars. Four Elevations. Zero Shortcut Flavoring.',
  subhead:
    "While our daily pods and roasts are built for effortless rhythm when you're moving fast, the Tasting Flight is built for the hours when you slow down.",
  cultivars: [
    {
      name: 'Alishan High-Mountain Oolong',
      origin: 'Chiayi County, 1,300m',
      cultivar: 'Qing Xin',
      liquor: 'Pale golden-green',
      inTheCup: 'Wild mountain orchid, sweet bamboo shoot, and a remarkably thick, velvety finish.',
    },
    {
      name: 'Jin Xuan “Golden Daylily”',
      origin: 'Nantou County, 1,000m',
      cultivar: 'TTES #12',
      liquor: 'Bright honey-gold',
      inTheCup:
        'Naturally occurring sweet cream and toasted grain notes—derived purely from cultivar and roasting craft, never sprayed flavoring.',
    },
    {
      name: 'Shanlinxi Cloud-Mist Oolong',
      origin: 'Nantou County, 1,600m',
      cultivar: 'Qing Xin',
      liquor: 'Crisp champagne',
      inTheCup:
        'Cool cedar forest, crisp Asian pear, and a lingering mineral sweetness that peaks on the second pour.',
    },
    {
      name: 'Sun Moon Lake Ruby #18',
      origin: 'Yuchi Township, 750m',
      cultivar: 'TTES #18 (Wild Taiwan Mountain Tea × Burmese Assam)',
      liquor: 'Deep copper-amber',
      inTheCup: 'Wild cinnamon bark, subtle wintergreen cooling, and dark malt.',
    },
  ],
  insideTheLid:
    'Includes The Sommelier’s Steep Journal and your physical $15 Reserve Credit Card (CODE: RESERVE15)—valid for 21 days toward the full-size $88 Connoisseur’s Reserve Bundle ($73 after credit).',
};

// The five emails, Day 0 to Day 19. `body` is the email as written, paragraphs split
// by a blank line and list items starting "- ". Where the body has a bracketed line
// such as "[Use Your $15 Reserve Credit →]", that is the button: `cta` gives its label
// and a placeholder link for whichever email platform sends the sequence.
// {{ order_number }} in Email 1 is filled in by that platform too.
export const emails = [
  {
    day: 0,
    name: 'Order Confirmation',
    subject: 'Your Tasting Flight is on the bench. (Order #{{ order_number }})',
    preview: 'Plus one rule before you boil the kettle.',
    body: `You’re in. We’re pulling your Taiwanese Tasting Flight from the reserve shelf and packing it for the road. You’ll get a tracking link the moment it leaves our hands.

Before your box lands, there is one rule worth knowing: don’t throw the leaves out after your first mug.

Most people are used to grocery-store tea bags that give up their flavor in forty-five seconds and turn astringent. The four tins heading your way are intact, high-elevation Taiwanese cultivars. They are tightly rolled by hand to lock in volatile aromatics.

Your first steep wakes the leaf up. Your second steep is where the body and mouthfeel actually live. Your third steep is the quiet finish.

Inside the box, you’ll find The Sommelier’s Steep Journal with exact temperatures and times for all four origins, along with a $15 Reserve Credit good toward whichever full-size tin claims a permanent spot on your desk.

Until the box lands,
Sip Haven Co.
Made for slow mornings and long talks.`,
    cta: null,
  },
  {
    day: 3,
    name: 'Delivery Day / The First Pour',
    subject: 'Before you pour boiling water on that leaf.',
    preview: 'Two minutes off the boil changes everything in the cup.',
    body: `Your Tasting Flight should be on your porch or your desk by now.

When you crack the box, you’ll see four matte tins, The Sommelier’s Steep Journal, and your $15 Reserve Credit tucked inside the lid.

If you aren't sure which seal to break first, start with Alishan High-Mountain Oolong for a clean morning lift, or Jin Xuan TTES #12 if you want that natural, velvety cream mouthfeel in the afternoon.

One small adjustment that makes all the difference:
Unless you’re steeping the Sun Moon Lake Ruby #18 black tea, don’t pour a rolling 212°F boil straight onto the leaves. High-elevation oolongs grow slowly in cool mountain mist—boiling water scorches their top notes before the leaf can unfurl.

- No thermometer? Bring your kettle to a boil, click it off, and leave the lid open for two minutes. The water will drop right into the 190°F–195°F pocket.
- The 60 / 75 / 90 Rhythm: Steep for 60 seconds on your first pour. Leave the damp leaves in your steeper, and come back an hour later for a 75-second second pour—that’s where the rolled leaf opens completely and the texture turns silky.

Keep the Steep Journal on your desk this week and mark down which harvest wins your afternoon. Your $15 Reserve Credit (CODE: RESERVE15) stays active for the next 18 days whenever you're ready to claim a full-size tin.

Enjoy the quiet,
Sip Haven Co.
An Unhurried Sanctuary.`,
    cta: null,
  },
  {
    day: 7,
    name: 'The Origin Check-In & Reserve Invitation',
    subject: 'Seven days in. Which tin claimed your desk?',
    preview: 'High-mountain mist, toasted cream, or wild cinnamon bark.',
    body: `You’ve had the Tasting Flight on your counter for a week now—long enough to see what happens when a hand-rolled leaf opens up on its second and third pour.

As you work through the Sommelier’s Steep Journal, you’ll notice the four harvests divide into three distinct profiles:
- The High-Elevation Purists (Alishan & Shanlinxi): Crisp mountain mist, spring bamboo sweetness, and bright, unhurried clarity for morning work.
- The Texture Seekers (Jin Xuan TTES #12): Naturally pours with the weight and toasted-cream mouthfeel of a quiet afternoon latte.
- The Black Tea Converts (Sun Moon Lake Ruby #18): Dark honey, wild mountain cinnamon, and wintergreen warmth without bitterness.

Remember that your $15 Reserve Credit (CODE: RESERVE15) is sitting inside your tasting box lid. You can apply it directly toward The Connoisseur’s Reserve Bundle—two full-size Reserve Tins of your favorite cultivars (90+ infusions total) paired with our double-walled glass steeping vessel. With your $15 credit applied, the full $88 set comes down to $73 with complimentary shipping.

[Use Your $15 Reserve Credit →]

Or simply reply to this email and tell us which of the four origins took the top spot in your journal—we read every note.

Unhurried,
Sip Haven Co.
Made for slow mornings and long talks.`,
    cta: { label: 'Use Your $15 Reserve Credit →', url: '{{ reserve_credit_url }}' },
  },
  {
    day: 14,
    name: 'The Provenance & Supply Chain Story',
    subject: 'Why high-mountain tea rarely leaves the island intact.',
    preview: 'Multiple brokers, months in transit, and a better way.',
    body: `By the time most specialty tea reaches a retail shelf in the States, it has often changed hands across multiple brokers and spent months sitting in transit and storage. Brokers buy small harvests, blend them together to mask lower elevations, and crush the leaves so they pack tighter into standardized boxes.

We built Sip Haven to cut the noise out of the supply chain.

Because we handle our own sourcing directly with Taiwanese family farms and roasters, our leaves go from the drying bamboo trays at elevation into airtight, light-blocking vessels—so the Alishan, Shanlinxi, Jin Xuan, or Ruby #18 in your cup tastes the way it did in the tasting room in Nantou.

If your Tasting Flight tins are starting to run low, your $15 Reserve Credit (CODE: RESERVE15) is valid for 7 more days toward any single full-size tin (45+ infusions) or The Connoisseur’s Reserve Bundle ($73 after credit, regularly $88, complimentary shipping included).

[Claim Your Full-Size Reserve Tins ($15 Off) →]

Here’s to knowing where your leaf comes from,
Sip Haven Co.
An Unhurried Sanctuary.`,
    cta: { label: 'Claim Your Full-Size Reserve Tins ($15 Off) →', url: '{{ reserve_credit_url }}' },
  },
  {
    day: 19,
    name: 'The 48-Hour Credit Close',
    subject: 'The bottom of the tin (and 48 hours left on your credit).',
    preview: 'Your $15 Reserve Credit wraps up on Day 21.',
    body: `If you’ve been steeping two or three cups a day since your Tasting Flight landed, you are right around the bottom of your fourth tin. We time your $15 Reserve Credit (CODE: RESERVE15) to match that exact 21-day rhythm.

A quiet heads-up: your $15 credit closes in 48 hours.

We don’t run perpetual discount codes or endless flash sales. Before the window closes in two days, you can put your $15 toward:
- The Connoisseur’s Reserve Bundle ($73 with credit, regularly $88): Two full-size Reserve Tins (90+ infusions total) + our double-walled glass steeping vessel + complimentary shipping.
- Any Single Full-Size Reserve Tin ($15 off): Restock Alishan, Shanlinxi, Jin Xuan TTES #12, or Sun Moon Lake Ruby #18.

[Apply Your $15 Credit Before It Closes →]

Whatever stays in your mug from here on out—keep steeping it three times.

Sip Haven Co.
Made for slow mornings and long talks.`,
    cta: { label: 'Apply Your $15 Credit Before It Closes →', url: '{{ reserve_credit_url }}' },
  },
];
