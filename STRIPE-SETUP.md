# Hextile — Stripe checkout setup

The store sells through Stripe in two ways:

1. **"Order Now" buttons** (one per product/pack/currency) go straight to
   **Stripe Payment Links** (`buy.stripe.com/...`). These are managed in the
   Stripe Dashboard under **Payment Links** — no server needed. If a button
   shows a "link deactivated" page, reactivate the link in the dashboard (or
   create a new one and update `STRIPE_LINKS` in `index.html`).

2. **The cart's Checkout button** sends the whole cart to a **Cloudflare
   Worker** (`checkout-worker.js` in this repo), which creates a multi-item
   Stripe Checkout Session using the price IDs in `PRICE_IDS` in
   `index.html`. The site expects the worker at:

   `https://spring-firefly-f9c7.exceldaily7.workers.dev`

## Redeploying the worker (≈5 minutes)

From this repo's root, with Node installed:

```bash
npx wrangler login                       # opens browser, log in to Cloudflare
npx wrangler deploy                      # deploys checkout-worker.js (name in wrangler.toml keeps the same URL)
npx wrangler secret put STRIPE_SECRET_KEY   # paste your sk_live_... key when prompted
```

Get the secret key from Stripe Dashboard → Developers → API keys. It is
stored encrypted in the Worker only — never commit it to this repo.

## Testing

```bash
curl -X POST https://spring-firefly-f9c7.exceldaily7.workers.dev \
  -H "Content-Type: application/json" \
  -d '{"items":[{"price":"price_1TYh8HJcTL0QukOFppTrMgyb","quantity":1}]}'
```

A working worker returns `{"url":"https://checkout.stripe.com/..."}`.

## Fallback behavior

If the worker is unreachable, the site's Checkout button falls back to the
product's direct Payment Link when the cart holds a single product, so
single-item purchases keep working even with the worker down. Multi-item
carts need the worker.

## Stripe inventory used by the site

All of these live in the Stripe account whose public name is **Nook & Nibble** (per the live checkout page). Make sure the dashboard is on that account and in **live mode** — then any ID below can be pasted into the dashboard search bar to jump to it.

| Product | Variant | Currency | Price ID (cart) | Payment Link (Order Now) |
|---|---|---|---|---|
| Soundsbay Honeycomb | 12 Pack | GBP | `price_1TYh8HJcTL0QukOFppTrMgyb` | https://buy.stripe.com/14A28s9JR27516wcjh2sM0g |
| Soundsbay Honeycomb | 12 Pack | AUD | `price_1TYh8HJcTL0QukOFjSpNEZts` | https://buy.stripe.com/cNi9AU09h7rpg1q8312sM0h |
| Soundsbay Honeycomb | 18 Pack | GBP | `price_1TYh8qJcTL0QukOFjfoiDOBv` | https://buy.stripe.com/6oU6oI3ltbHF16wgzx2sM0i |
| Soundsbay Honeycomb | 18 Pack | AUD | `price_1TYh8qJcTL0QukOF3Dpyz9bH` | https://buy.stripe.com/4gMbJ28FNdPNaH6cjh2sM0j |
| TONOR Hexagon | 12 Pack | GBP | `price_1TYh9jJcTL0QukOFe80Gp3ng` | https://buy.stripe.com/4gMeVe6xF6nlbLa1ED2sM0o |
| TONOR Hexagon | 12 Pack | AUD | `price_1TYh9jJcTL0QukOFuLl4a50L` | https://buy.stripe.com/8x2bJ2f4bfXV3eEab92sM0l |
| TONOR Hexagon | 18 Pack | GBP | `price_1TYhAcJcTL0QukOFgUxVMlTS` | https://buy.stripe.com/eVq14o6xFeTRcPebfd2sM0m |
| TONOR Hexagon | 18 Pack | AUD | `price_1TYhAcJcTL0QukOFyV9pINqL` | https://buy.stripe.com/bJecN6g8f4fd9D25UT2sM0n |
| TONOR Hexagon | 36 Pack | GBP | `price_1TYhJJJcTL0QukOFTdle67kP` | https://buy.stripe.com/8x200k2hpfXV9D2gzx2sM0p |
| TONOR Hexagon | 36 Pack | AUD | `price_1TYhJkJcTL0QukOFa4W991UT` | https://buy.stripe.com/28EfZibRZ9zxdTicjh2sM0q |
| TONOR Hexagon | 48 Pack | GBP | `price_1TYhKUJcTL0QukOFhxWbGKxW` | https://buy.stripe.com/aFa8wQ1dlaDBcPefvt2sM0r |
| TONOR Hexagon | 48 Pack | AUD | `price_1TYhKUJcTL0QukOFRIcrHqhC` | https://buy.stripe.com/eVq00kbRZ4fdbLa4QP2sM0s |
| TONOR Wood Panels | 2 Pack | GBP | `price_1TYhL9JcTL0QukOFBoTdWWn0` | https://buy.stripe.com/4gM3cw1dlh1Zg1q2IH2sM0t |
| TONOR Wood Panels | 2 Pack | AUD | `price_1TYhL9JcTL0QukOFsEcENR2B` | https://buy.stripe.com/dRmfZi4px1312aA0Az2sM0u |
| TONOR Wood Panels | 4 Pack | GBP | `price_1TYhLlJcTL0QukOFwRNZAS9k` | https://buy.stripe.com/bJe5kE09haDBbLa5UT2sM0v |
| TONOR Wood Panels | 4 Pack | AUD | `price_1TYhLlJcTL0QukOFyujuqdZP` | https://buy.stripe.com/5kQ3cw6xF275bLa5UT2sM0w |
| TONOR Square | 12 Pack | GBP | `price_1TYhMeJcTL0QukOF0iwapbVe` | https://buy.stripe.com/dRmaEY9JR1317uUbfd2sM0x |
| TONOR Square | 12 Pack | AUD | `price_1TYhMeJcTL0QukOFeGMCN8T2` | https://buy.stripe.com/bJe14o9JRh1Z02s6YX2sM0y |
| TONOR Square | 18 Pack | GBP | `price_1TYhONJcTL0QukOF488EgHlw` | https://buy.stripe.com/8x25kE5tB4fdaH6ab92sM0z |
| TONOR Square | 18 Pack | AUD | `price_1TYhONJcTL0QukOFQSIpvcgJ` | https://buy.stripe.com/4gM9AU09h275cPe4QP2sM0A |
| TONOR Square | 36 Pack | GBP | `price_1TYhP7JcTL0QukOFxMadVayN` | https://buy.stripe.com/bJe7sM09hfXV9D25UT2sM0B |
| TONOR Square | 36 Pack | AUD | `price_1TYhP7JcTL0QukOF9Ke4Hjbi` | https://buy.stripe.com/8x2bJ2f4bh1Z16werp2sM0C |
| TONOR Square | 48 Pack | GBP | `price_1TYhPoJcTL0QukOFzzYHTA2G` | https://buy.stripe.com/00wfZi7BJ4fd2aAab92sM0D |
| TONOR Square | 48 Pack | AUD | `price_1TYhPoJcTL0QukOFo7JnnzfB` | https://buy.stripe.com/eVq00k09heTR2aA9752sM0E |
| FIXCHORD Tape | 1cm | GBP | `price_1TYhSYJcTL0QukOFGQkWNUv5` | https://buy.stripe.com/6oUeVecW3dPN5mMbfd2sM0F |
| FIXCHORD Tape | 1cm | AUD | `price_1TYhSXJcTL0QukOFncgJHLHQ` | https://buy.stripe.com/14A9AUf4b13116w4QP2sM0G |
| FIXCHORD Tape | 1.5cm | GBP | `price_1TYhYHJcTL0QukOFagzpEU2O` | https://buy.stripe.com/cNi28saNVcLJeXmdnl2sM0H |
| FIXCHORD Tape | 1.5cm | AUD | `price_1TYhYHJcTL0QukOFSkJTKCa7` | https://buy.stripe.com/9B6cN6aNVh1Z4iIbfd2sM0I |
| FIXCHORD Tape | 2cm | GBP | `price_1TYha8JcTL0QukOFHHfG4JOA` | https://buy.stripe.com/14A28scW3h1Z9D2gzx2sM0J |
| FIXCHORD Tape | 2cm | AUD | `price_1TYhZCJcTL0QukOFZf5Y15pI` | https://buy.stripe.com/5kQfZig8f6nl8yYdnl2sM0K |
| FIXCHORD Tape | 2.5cm | GBP | `price_1TYhZuJcTL0QukOFX7aaDvV1` | https://buy.stripe.com/4gMfZicW3cLJ5mM4QP2sM0L |
| FIXCHORD Tape | 2.5cm | AUD | `price_1TYhZuJcTL0QukOFlvhiZKBd` | https://buy.stripe.com/bJe4gA3lt9zx8yY4QP2sM0M |
