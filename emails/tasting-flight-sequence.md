# Tasting Flight: 21-day Reserve email sequence

Five emails, sent after a Tasting Flight order. Copy is Joe's locked copy (docs/tasting-flight-spec.md), word for word; the same text lives in src/content/tastingFlight.js (`emails`).

Platform-neutral: send from whichever email platform carries the sequence (order email goes out via Resend today). Placeholders use `{{ name }}` and must be filled in by that platform:

- `{{ order_number }}`: the order number (Email 1 subject).
- `{{ reserve_credit_url }}`: where the CTA button links (Emails 3 to 5). A shop page where RESERVE15 can be redeemed.

A bracketed line in a body, such as `[Use Your $15 Reserve Credit →]`, marks where the CTA button goes.

Unconfirmed pre-launch specs in this copy (see `claims` in src/content/tastingFlight.js): the cultivars and elevations, hand-rolled leaves from family gardens, the $15 credit card in the box, the $88 Connoisseur’s Reserve Bundle and its double-walled glass vessel, and direct sourcing with family farms and roasters and a tasting room in Nantou (Email 4).

---

## Email 1: Day 0 (Order Confirmation)

- **Day:** 0
- **Subject:** Your Tasting Flight is on the bench. (Order #{{ order_number }})
- **Preview:** Plus one rule before you boil the kettle.
- **CTA:** none (no button in this email)

**Body:**

You’re in. We’re pulling your Taiwanese Tasting Flight from the reserve shelf and packing it for the road. You’ll get a tracking link the moment it leaves our hands.

Before your box lands, there is one rule worth knowing: don’t throw the leaves out after your first mug.

Most people are used to grocery-store tea bags that give up their flavor in forty-five seconds and turn astringent. The four tins heading your way are intact, high-elevation Taiwanese cultivars. They are tightly rolled by hand to lock in volatile aromatics.

Your first steep wakes the leaf up. Your second steep is where the body and mouthfeel actually live. Your third steep is the quiet finish.

Inside the box, you’ll find The Sommelier’s Steep Journal with exact temperatures and times for all four origins, along with a $15 Reserve Credit good toward whichever full-size tin claims a permanent spot on your desk.

Until the box lands,
Sip Haven Co.
Made for slow mornings and long talks.

---

## Email 2: Day 3 (Delivery Day / The First Pour)

- **Day:** 3
- **Subject:** Before you pour boiling water on that leaf.
- **Preview:** Two minutes off the boil changes everything in the cup.
- **CTA:** none (no button in this email)

**Body:**

Your Tasting Flight should be on your porch or your desk by now.

When you crack the box, you’ll see four matte tins, The Sommelier’s Steep Journal, and your $15 Reserve Credit tucked inside the lid.

If you aren't sure which seal to break first, start with Alishan High-Mountain Oolong for a clean morning lift, or Jin Xuan TTES #12 if you want that natural, velvety cream mouthfeel in the afternoon.

One small adjustment that makes all the difference:
Unless you’re steeping the Sun Moon Lake Ruby #18 black tea, don’t pour a rolling 212°F boil straight onto the leaves. High-elevation oolongs grow slowly in cool mountain mist—boiling water scorches their top notes before the leaf can unfurl.

- No thermometer? Bring your kettle to a boil, click it off, and leave the lid open for two minutes. The water will drop right into the 190°F–195°F pocket.
- The 60 / 75 / 90 Rhythm: Steep for 60 seconds on your first pour. Leave the damp leaves in your steeper, and come back an hour later for a 75-second second pour—that’s where the rolled leaf opens completely and the texture turns silky.

Keep the Steep Journal on your desk this week and mark down which harvest wins your afternoon. Your $15 Reserve Credit (CODE: RESERVE15) stays active for the next 18 days whenever you're ready to claim a full-size tin.

Enjoy the quiet,
Sip Haven Co.
An Unhurried Sanctuary.

---

## Email 3: Day 7 (The Origin Check-In & Reserve Invitation)

- **Day:** 7
- **Subject:** Seven days in. Which tin claimed your desk?
- **Preview:** High-mountain mist, toasted cream, or wild cinnamon bark.
- **CTA:** [Use Your $15 Reserve Credit →]({{ reserve_credit_url }})

**Body:**

You’ve had the Tasting Flight on your counter for a week now—long enough to see what happens when a hand-rolled leaf opens up on its second and third pour.

As you work through the Sommelier’s Steep Journal, you’ll notice the four harvests divide into three distinct profiles:
- The High-Elevation Purists (Alishan & Shanlinxi): Crisp mountain mist, spring bamboo sweetness, and bright, unhurried clarity for morning work.
- The Texture Seekers (Jin Xuan TTES #12): Naturally pours with the weight and toasted-cream mouthfeel of a quiet afternoon latte.
- The Black Tea Converts (Sun Moon Lake Ruby #18): Dark honey, wild mountain cinnamon, and wintergreen warmth without bitterness.

Remember that your $15 Reserve Credit (CODE: RESERVE15) is sitting inside your tasting box lid. You can apply it directly toward The Connoisseur’s Reserve Bundle—two full-size Reserve Tins of your favorite cultivars (90+ infusions total) paired with our double-walled glass steeping vessel. With your $15 credit applied, the full $88 set comes down to $73 with complimentary shipping.

[Use Your $15 Reserve Credit →]

Or simply reply to this email and tell us which of the four origins took the top spot in your journal—we read every note.

Unhurried,
Sip Haven Co.
Made for slow mornings and long talks.

---

## Email 4: Day 14 (The Provenance & Supply Chain Story)

- **Day:** 14
- **Subject:** Why high-mountain tea rarely leaves the island intact.
- **Preview:** Multiple brokers, months in transit, and a better way.
- **CTA:** [Claim Your Full-Size Reserve Tins ($15 Off) →]({{ reserve_credit_url }})

**Body:**

By the time most specialty tea reaches a retail shelf in the States, it has often changed hands across multiple brokers and spent months sitting in transit and storage. Brokers buy small harvests, blend them together to mask lower elevations, and crush the leaves so they pack tighter into standardized boxes.

We built Sip Haven to cut the noise out of the supply chain.

Because we handle our own sourcing directly with Taiwanese family farms and roasters, our leaves go from the drying bamboo trays at elevation into airtight, light-blocking vessels—so the Alishan, Shanlinxi, Jin Xuan, or Ruby #18 in your cup tastes the way it did in the tasting room in Nantou.

If your Tasting Flight tins are starting to run low, your $15 Reserve Credit (CODE: RESERVE15) is valid for 7 more days toward any single full-size tin (45+ infusions) or The Connoisseur’s Reserve Bundle ($73 after credit, regularly $88, complimentary shipping included).

[Claim Your Full-Size Reserve Tins ($15 Off) →]

Here’s to knowing where your leaf comes from,
Sip Haven Co.
An Unhurried Sanctuary.

---

## Email 5: Day 19 (The 48-Hour Credit Close)

- **Day:** 19
- **Subject:** The bottom of the tin (and 48 hours left on your credit).
- **Preview:** Your $15 Reserve Credit wraps up on Day 21.
- **CTA:** [Apply Your $15 Credit Before It Closes →]({{ reserve_credit_url }})

**Body:**

If you’ve been steeping two or three cups a day since your Tasting Flight landed, you are right around the bottom of your fourth tin. We time your $15 Reserve Credit (CODE: RESERVE15) to match that exact 21-day rhythm.

A quiet heads-up: your $15 credit closes in 48 hours.

We don’t run perpetual discount codes or endless flash sales. Before the window closes in two days, you can put your $15 toward:
- The Connoisseur’s Reserve Bundle ($73 with credit, regularly $88): Two full-size Reserve Tins (90+ infusions total) + our double-walled glass steeping vessel + complimentary shipping.
- Any Single Full-Size Reserve Tin ($15 off): Restock Alishan, Shanlinxi, Jin Xuan TTES #12, or Sun Moon Lake Ruby #18.

[Apply Your $15 Credit Before It Closes →]

Whatever stays in your mug from here on out—keep steeping it three times.

Sip Haven Co.
Made for slow mornings and long talks.
