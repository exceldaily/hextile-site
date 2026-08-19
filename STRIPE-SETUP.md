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
