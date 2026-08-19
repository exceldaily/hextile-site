/**
 * Hextile — Stripe Payment Link checker / fixer.
 * Run on your own machine with Node 18+ from the repo folder.
 *
 * CHECK which of the site's 24 payment links are active (no key needed):
 *   node stripe-links-tool.js
 *
 * FIX (reactivate) every deactivated link automatically:
 *   1. Stripe Dashboard -> Developers -> API keys -> "Create restricted key"
 *      with permission "Payment Links: Write" (nothing else needed).
 *   2. STRIPE_KEY=rk_live_... node stripe-links-tool.js --fix
 *
 * The key is only read from the environment — never saved anywhere.
 */

const LINKS = {
  'Soundsbay Honeycomb 12 Pack GBP': 'https://buy.stripe.com/14A28s9JR27516wcjh2sM0g',
  'Soundsbay Honeycomb 12 Pack AUD': 'https://buy.stripe.com/cNi9AU09h7rpg1q8312sM0h',
  'Soundsbay Honeycomb 18 Pack GBP': 'https://buy.stripe.com/6oU6oI3ltbHF16wgzx2sM0i',
  'Soundsbay Honeycomb 18 Pack AUD': 'https://buy.stripe.com/4gMbJ28FNdPNaH6cjh2sM0j',
  'TONOR Hexagon 12 Pack GBP': 'https://buy.stripe.com/4gMeVe6xF6nlbLa1ED2sM0o',
  'TONOR Hexagon 12 Pack AUD': 'https://buy.stripe.com/8x2bJ2f4bfXV3eEab92sM0l',
  'TONOR Hexagon 18 Pack GBP': 'https://buy.stripe.com/eVq14o6xFeTRcPebfd2sM0m',
  'TONOR Hexagon 18 Pack AUD': 'https://buy.stripe.com/bJecN6g8f4fd9D25UT2sM0n',
  'TONOR Hexagon 36 Pack GBP': 'https://buy.stripe.com/8x200k2hpfXV9D2gzx2sM0p',
  'TONOR Hexagon 36 Pack AUD': 'https://buy.stripe.com/28EfZibRZ9zxdTicjh2sM0q',
  'TONOR Hexagon 48 Pack GBP': 'https://buy.stripe.com/aFa8wQ1dlaDBcPefvt2sM0r',
  'TONOR Hexagon 48 Pack AUD': 'https://buy.stripe.com/eVq00kbRZ4fdbLa4QP2sM0s',
  'TONOR Wood Panels 2 Pack GBP': 'https://buy.stripe.com/4gM3cw1dlh1Zg1q2IH2sM0t',
  'TONOR Wood Panels 2 Pack AUD': 'https://buy.stripe.com/dRmfZi4px1312aA0Az2sM0u',
  'TONOR Wood Panels 4 Pack GBP': 'https://buy.stripe.com/bJe5kE09haDBbLa5UT2sM0v',
  'TONOR Wood Panels 4 Pack AUD': 'https://buy.stripe.com/5kQ3cw6xF275bLa5UT2sM0w',
  'TONOR Square 12 Pack GBP': 'https://buy.stripe.com/dRmaEY9JR1317uUbfd2sM0x',
  'TONOR Square 12 Pack AUD': 'https://buy.stripe.com/bJe14o9JRh1Z02s6YX2sM0y',
  'TONOR Square 18 Pack GBP': 'https://buy.stripe.com/8x25kE5tB4fdaH6ab92sM0z',
  'TONOR Square 18 Pack AUD': 'https://buy.stripe.com/4gM9AU09h275cPe4QP2sM0A',
  'TONOR Square 36 Pack GBP': 'https://buy.stripe.com/bJe7sM09hfXV9D25UT2sM0B',
  'TONOR Square 36 Pack AUD': 'https://buy.stripe.com/8x2bJ2f4bh1Z16werp2sM0C',
  'TONOR Square 48 Pack GBP': 'https://buy.stripe.com/00wfZi7BJ4fd2aAab92sM0D',
  'TONOR Square 48 Pack AUD': 'https://buy.stripe.com/eVq00k09heTR2aA9752sM0E',
  'FIXCHORD Tape 1cm GBP': 'https://buy.stripe.com/6oUeVecW3dPN5mMbfd2sM0F',
  'FIXCHORD Tape 1cm AUD': 'https://buy.stripe.com/14A9AUf4b13116w4QP2sM0G',
  'FIXCHORD Tape 1.5cm GBP': 'https://buy.stripe.com/cNi28saNVcLJeXmdnl2sM0H',
  'FIXCHORD Tape 1.5cm AUD': 'https://buy.stripe.com/9B6cN6aNVh1Z4iIbfd2sM0I',
  'FIXCHORD Tape 2cm GBP': 'https://buy.stripe.com/14A28scW3h1Z9D2gzx2sM0J',
  'FIXCHORD Tape 2cm AUD': 'https://buy.stripe.com/5kQfZig8f6nl8yYdnl2sM0K',
  'FIXCHORD Tape 2.5cm GBP': 'https://buy.stripe.com/4gMfZicW3cLJ5mM4QP2sM0L',
  'FIXCHORD Tape 2.5cm AUD': 'https://buy.stripe.com/bJe4gA3lt9zx8yY4QP2sM0M',
};

const FIX = process.argv.includes('--fix');
const KEY = process.env.STRIPE_KEY;

// A deactivated payment link still serves its page with HTTP 200 — the only
// reliable signal is Stripe's own merchant API for that link id.
async function probe(name, url) {
  const id = url.split('/').pop();
  try {
    const res = await fetch('https://merchant-ui-api.stripe.com/payment-links/' + id, {
      headers: { 'Accept': 'application/json' },
    });
    const body = await res.text();
    if (/payment_link_deactivated/.test(body)) return { name, url, status: 'INACTIVE' };
    if (res.status === 404) return { name, url, status: 'NOT FOUND' };
    if (res.ok) return { name, url, status: 'active' };
    return { name, url, status: 'HTTP ' + res.status };
  } catch (e) {
    return { name, url, status: 'ERROR ' + e.message };
  }
}

async function stripeApi(path, method, params) {
  const res = await fetch('https://api.stripe.com/v1' + path, {
    method: method || 'GET',
    headers: {
      'Authorization': 'Bearer ' + KEY,
      ...(method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    body: method === 'POST' ? new URLSearchParams(params).toString() : undefined,
  });
  return res.json();
}

(async () => {
  console.log('Checking ' + Object.keys(LINKS).length + ' payment links...\n');
  const results = await Promise.all(Object.entries(LINKS).map(([n, u]) => probe(n, u)));
  const inactive = results.filter(r => r.status !== 'active');
  results.forEach(r => console.log((r.status === 'active' ? '  OK       ' : '  ** DEAD  ') + r.name + (r.status === 'active' ? '' : '  [' + r.status + ']')));
  console.log('\n' + (results.length - inactive.length) + ' active, ' + inactive.length + ' not working.');

  if (!FIX) {
    if (inactive.length) console.log('\nTo reactivate them automatically:\n  STRIPE_KEY=rk_live_... node stripe-links-tool.js --fix\n(or reactivate by hand: Stripe Dashboard -> Payment links -> filter Deactivated -> ... -> Reactivate)');
    return;
  }
  if (!KEY) { console.error('\n--fix needs STRIPE_KEY=rk_live_... in the environment.'); process.exit(1); }

  console.log('\nFetching payment links from your Stripe account...');
  const byUrl = {};
  let after;
  do {
    const page = await stripeApi('/payment_links?limit=100' + (after ? '&starting_after=' + after : ''));
    if (page.error) { console.error('Stripe API error: ' + page.error.message); process.exit(1); }
    page.data.forEach(pl => { byUrl[pl.url] = pl; });
    after = page.has_more ? page.data[page.data.length - 1].id : null;
  } while (after);

  for (const r of inactive) {
    const pl = byUrl[r.url];
    if (!pl) { console.log('  NOT FOUND in this Stripe account (wrong account, or link was deleted): ' + r.name); continue; }
    if (pl.active) { console.log('  already active per API (may be a temporary page error): ' + r.name); continue; }
    const upd = await stripeApi('/payment_links/' + pl.id, 'POST', { active: 'true' });
    console.log(upd.error ? ('  FAILED to reactivate ' + r.name + ': ' + upd.error.message) : ('  REACTIVATED ' + r.name));
  }
  console.log('\nDone. Re-run without --fix to verify.');
})();
