# Lineup guide

How to fill in `lineup-template.csv`, the sheet that holds the shop's teas and coffees. Open it in Excel or Google Sheets, replace the two example products with your own, and save it as a CSV.

## How the sheet works

- Keep the first row (the column names) exactly as it is.
- Each row is one size or format of a product, like the 2 oz tin or the box of 20 tea bags.
- Rows that share a `slug` are one product. Fill in the product's details (name, description and so on) on its first row. On its other rows fill in only `slug`, `format`, `size_label`, `cups` and `price`.
- A list goes in one cell with a | between the items, like `floral|honey|fresh grass`.
- Prices are in dollars, like `12.50`.
- The two example products only show how it looks. Delete them or replace them. If a row whose slug starts with `example-` is still there, `npm run load-lineup` stops and sends nothing to Stripe.
- Save the file as CSV UTF-8 (in Excel: Save As, then pick "CSV UTF-8") so apostrophes and accents come through.

## The columns

In the order they appear in the sheet. "First row" means the product's first row only.

| Column | Rows | Needed? | What goes in it | Example |
| --- | --- | --- | --- | --- |
| `slug` | every row | yes | The product's short web name: lowercase letters, numbers and dashes only. It becomes the address `/products/jasmine-dream`. Each product needs its own, and every row of one product uses the same one. | `jasmine-dream` |
| `name` | first row | yes | The product's name. | `Jasmine Dream` |
| `category` | first row | yes | `tea` or `coffee`. | `tea` |
| `tea_type` | first row | no | The kind of tea. Shown as a small label above the name on the product page. Leave it blank for coffee. | `green` |
| `short_description` | first row | yes | One or two sentences. Shown on the product cards and under the name. | `A floral green tea scented with jasmine blossoms.` |
| `story` | first row | no | A longer story. Shown under the short description. Start a new line inside the cell (Alt+Enter in Excel) for each paragraph. | `Picked by hand in spring.` |
| `flavor_notes` | first row | no | What it tastes like, as a list. Shown on the product page. Each different note also becomes a box in the Flavor filter on the Tea and Coffee pages, so spell a note the same way every time (capital letters do not matter). This is the filter's column. The quiz reads `tags` instead. | `jasmine` |
| `caffeine` | first row | yes | `none`, `low`, `medium` or `high`. Shown on the product page and used by the Caffeine filter and by the quiz. | `low` |
| `ingredients` | first row | no | The ingredients, as plain text. | `Green tea, jasmine blossoms` |
| `origin` | first row | no | Where it comes from. Shown as a small "Origin: ..." line under the description. | `Example Valley` |
| `water_temp` | first row | no | Brew guide: how hot the water should be. Fill in all three brew guide columns (`water_temp`, `amount` and `steep_time`) or none of them. | `175 F` |
| `amount` | first row | no | Brew guide: how much to use. | `1 tsp per cup` |
| `steep_time` | first row | no | Brew guide: how long to steep. A coffee shows it as "Brew time". | `2-3 minutes` |
| `tags` | first row | no | Words the quiz uses to find the product, as a list. See "Tags for the quiz" below. The "You might also like" row on a product page also suggests products of the same category that share a tag. | `floral` |
| `aromas` | first row | no | What the product smells like, as a list. The quiz's aroma question finds products by these words. See "Aromas for the quiz" below. | `jasmine` |
| `moods` | first row | no | How the product makes you feel, as a list. The quiz's mood question finds products by these words. See "Moods for the quiz" below. | `calm` |
| `featured` | first row | no | `yes` to show the product on the home page. `no` or blank otherwise. | `yes` |
| `images` | first row | no | Photo file names or web addresses, as a list. The first is the main photo. Leave it blank until the photos are in: the shop shows a drawing for a product with no photo. | `/images/jasmine-1.jpg` |
| `format` | every row | yes | How this row is sold. Tea: `loose-leaf`, `tea-bags` or `k-cup`. Coffee: `whole-bean` or `ground`. | `loose-leaf` |
| `size_label` | every row | yes | The size as shoppers read it. A product cannot list the same format and size twice. | `2 oz tin` |
| `cups` | every row | no | About how many cups this size makes, as a whole number. Shown as "about 25 cups". | `25` |
| `price` | every row | yes | The price in dollars, with at most two decimals and no thousands comma. A leading $ is fine. | `12.50` |

## Tags for the quiz

The quiz asks "Which flavors sound best?" and finds products by the words in their `tags` column. A product only turns up for a flavor answer if its tags include one of the words below. Spell them exactly as shown; capital letters do not matter.

| Quiz answer | Tags it looks for |
| --- | --- |
| Floral | `floral` |
| Fruity | `fruity` (or `fruit`) |
| Earthy | `earthy` |
| Sweet and spiced | `sweet`, `spiced` (or `spicy`) |

For example, a tea with `floral|sweet` in its `tags` suits both the Floral answer and the Sweet and spiced answer. Other words in `tags`, like `everyday` or `gift`, are fine too. The quiz ignores them, and "You might also like" uses them.

## Aromas for the quiz

Right after flavor, the quiz asks "Which aroma pulls you in?" and finds products by the words in their `aromas` column. A product only turns up for an aroma answer if its aromas include one of the words below. Spell them exactly as shown; capital letters do not matter. "Surprise me" looks for no aroma.

| Quiz answer | Aromas it looks for |
| --- | --- |
| Floral | `jasmine`, `rose`, `lavender`, `orchid` |
| Toasty and smoky | `smoky`, `roasted`, `nutty`, `cocoa` |
| Bright and citrusy | `citrus`, `lemon`, `bergamot`, `berry` |
| Sweet | `vanilla`, `caramel`, `honey`, `malty` |
| Fresh and herbal | `grassy`, `mint`, `herbal`, `ocean` |

For example, an Earl Grey with `bergamot|malty` in its `aromas` suits both Bright and citrusy and Sweet. Fill this column in for every product: one with no aroma from the list above can still come up for its other answers, but never because of its aroma. `npm run load-lineup` lists any product that has none.

## Moods for the quiz

Right after "Tea or coffee today?", the quiz asks "How do you want to feel?" and finds products by the words in their `moods` column. Tag each product with every mood it suits. Spell them exactly as shown; capital letters do not matter.

| Quiz answer | Mood it looks for |
| --- | --- |
| Calm and unwound | `calm` |
| Focused and productive | `focused` |
| Energized and ready | `energized` |
| Cozy and comforted | `cozy` |
| Light and refreshed | `refreshed` |

For example, a chamomile with `calm|cozy` in its `moods` suits both Calm and unwound and Cozy and comforted. The column may be left blank: the product still loads and can still come up for its other answers, but never because of its mood. `npm run load-lineup` lists any product that has none.

## How the quiz ranks

The quiz also reads three other columns: `category` (tea or coffee), `caffeine` (it has to match the answer exactly, and it counts for the most, except that "Caffeine-free" is a rule, not just points: it only ever picks products whose `caffeine` is `none`, however well they fit the other answers, even for a shopper who wants to feel energized) and `format` ("Quick and easy" looks for `k-cup`, `tea-bags` and `ground`, and "A slow ritual" looks for `loose-leaf` and `whole-bean`). It only picks products that can be bought, which means their prices have been sent to Stripe. A product with no matching tag can still come up because of its caffeine, aroma, mood or format, but never because of its flavor.

The answers count in this order: caffeine first, then flavor (`tags`), then aroma (`aromas`), then mood (`moods`), then format. A match higher up always beats any number of matches below it, so between two products that fit the caffeine and flavor equally, the one with the chosen aroma comes first, and between two that also tie on aroma, the one with the chosen mood. Mood is there to break ties: it never outweighs the caffeine, flavor or aroma answers.

## After you fill it in

Send the finished CSV, and the photos, back. To load it into the shop:

1. `npm run lineup:csv -- path/to/lineup.csv` checks the sheet, lists every problem in plain English, and writes `src/data/lineup.json` only when everything is fine.
2. `npm run load-lineup` creates the matching products and prices in Stripe. It uses the key in `.env.local` and refuses a live key unless you add `--live`, so use a test key until the shop is ready. A product can only be bought once it has been through this step.

## After the CSV

This part is for Claude, or whoever loads the lineup. It is not for the person filling in the sheet.

1. Run `npm run lineup:csv -- file.csv`, then `npm run load-lineup`, as above. Use a Stripe test key in `.env.local`.
2. Commit `src/data/lineup.json`. Loading wrote the Stripe price ids into it, and the shop and its checkout read that file.
3. Redeploy. The lineup is part of the build, so the live site does not change until it is deployed again.
4. Live prices are a separate step, and only with Joseph's yes: put a live key in `.env.local` and run `npm run load-lineup -- --live`. Without `--live` the command refuses a live key.
