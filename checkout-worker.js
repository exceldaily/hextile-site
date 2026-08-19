/**
 * Hextile cart checkout — Cloudflare Worker
 *
 * Receives the cart from index.html as { items: [{ price, quantity }], successUrl, cancelUrl }
 * and creates a Stripe Checkout Session for the whole cart, returning { url }.
 *
 * Deploy (from the repo root, keeps the same URL the site already calls):
 *   npx wrangler login
 *   npx wrangler deploy
 *   npx wrangler secret put STRIPE_SECRET_KEY   (paste your sk_live_... key when prompted)
 *
 * The Stripe secret key lives ONLY in the Worker's encrypted secret store —
 * never in this repo and never in the website code.
 */

const ALLOWED_ORIGINS = [
  'https://hextile.studio',
  'https://www.hextile.studio',
  'https://exceldaily.github.io',
];

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };
}

export default {
  async fetch(request, env) {
    const headers = corsHeaders(request);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers });
    }
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
    }
    if (!env.STRIPE_SECRET_KEY) {
      return new Response(JSON.stringify({ error: 'Worker is missing the STRIPE_SECRET_KEY secret' }), { status: 500, headers });
    }

    try {
      const { items, successUrl, cancelUrl } = await request.json();
      if (!Array.isArray(items) || items.length === 0) {
        throw new Error('Cart is empty');
      }

      const params = new URLSearchParams();
      params.set('mode', 'payment');
      params.set('success_url', successUrl || 'https://hextile.studio/?order=success');
      params.set('cancel_url', cancelUrl || 'https://hextile.studio/');
      params.set('shipping_address_collection[allowed_countries][0]', 'GB');
      params.set('shipping_address_collection[allowed_countries][1]', 'AU');
      params.set('shipping_address_collection[allowed_countries][2]', 'IE');

      items.forEach(function (item, i) {
        if (!item.price || typeof item.price !== 'string' || item.price.indexOf('price_') !== 0) {
          throw new Error('Invalid price id in cart');
        }
        const qty = Math.max(1, Math.min(99, parseInt(item.quantity, 10) || 1));
        params.set('line_items[' + i + '][price]', item.price);
        params.set('line_items[' + i + '][quantity]', String(qty));
      });

      const resp = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + env.STRIPE_SECRET_KEY,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });
      const data = await resp.json();

      if (data.error) {
        return new Response(JSON.stringify({ error: data.error.message }), { status: 400, headers });
      }
      return new Response(JSON.stringify({ url: data.url }), { status: 200, headers });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message || 'Bad request' }), { status: 400, headers });
    }
  },
};
