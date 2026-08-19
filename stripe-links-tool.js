/**
 * Hextile — Stripe Payment Link repair, driven by the Stripe API.
 *
 *   STRIPE_KEY=sk_live_... node stripe-links-tool.js          # report only
 *   STRIPE_KEY=sk_live_... node stripe-links-tool.js --fix    # repair + rewrite index.html
 *
 * For every link the site uses, ask Stripe whether it is active. Inactive
 * links are first reactivated (active=true); if Stripe refuses, a brand new
 * payment link is created from the same price id and swapped into the site.
 */

const fs = require('fs');
const HTML = __dirname + '/index.html';
const KEY = process.env.STRIPE_KEY;
const FIX = process.argv.includes('--fix');
const NAMES = { p1: 'Soundsbay Honeycomb', p2: 'TONOR Hexagon', p3: 'TONOR Wood Panels', p4: 'TONOR Square', p5: 'FIXCHORD Tape' };

if (!KEY) { console.error('STRIPE_KEY is required'); process.exit(1); }

function grab(html, name) {
  const m = html.match(new RegExp('const ' + name + ' = \\{[\\s\\S]*?\\n\\};'));
  if (!m) throw new Error('cannot find ' + name);
  return eval('(' + m[0].replace('const ' + name + ' = ', '').replace(/;$/, '') + ')');
}

async function api(path, method, params) {
  const res = await fetch('https://api.stripe.com/v1' + path, {
    method: method || 'GET',
    headers: { Authorization: 'Bearer ' + KEY, ...(method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
    body: method === 'POST' ? new URLSearchParams(params).toString() : undefined,
  });
  return res.json();
}

(async () => {
  let html = fs.readFileSync(HTML, 'utf8');
  const links = grab(html, 'STRIPE_LINKS');
  const prices = grab(html, 'PRICE_IDS');

  // Pull every payment link in the account, indexed by URL.
  const byUrl = {};
  let after, pages = 0;
  do {
    const page = await api('/payment_links?limit=100' + (after ? '&starting_after=' + after : ''));
    if (page.error) { console.error('Stripe API error: ' + page.error.message); process.exit(1); }
    page.data.forEach(pl => { byUrl[pl.url] = pl; });
    after = page.has_more ? page.data[page.data.length - 1].id : null;
    pages++;
  } while (after && pages < 20);
  console.log('Payment links in account: ' + Object.keys(byUrl).length + '\n');

  const problems = [];
  for (const pid of Object.keys(links))
    for (const variant of Object.keys(links[pid]))
      for (const cur of Object.keys(links[pid][variant])) {
        const url = links[pid][variant][cur];
        const label = NAMES[pid] + ' ' + variant + ' ' + cur;
        const pl = byUrl[url];
        if (!pl) { console.log('  MISSING  ' + label); problems.push({ pid, variant, cur, url, label, pl: null }); }
        else if (!pl.active) { console.log('  INACTIVE ' + label); problems.push({ pid, variant, cur, url, label, pl }); }
        else console.log('  OK       ' + label);
      }

  console.log('\n' + problems.length + ' link(s) need repair.');
  if (!problems.length || !FIX) {
    if (problems.length) console.log('Re-run with --fix to repair.');
    return;
  }

  let changed = 0;
  for (const p of problems) {
    if (p.pl) {
      const upd = await api('/payment_links/' + p.pl.id, 'POST', { active: 'true' });
      if (!upd.error && upd.active) { console.log('  REACTIVATED ' + p.label); continue; }
      console.log('  reactivate refused for ' + p.label + (upd.error ? ' (' + upd.error.message + ')' : '') + ' — creating a new link');
    }
    const priceId = prices[p.pid] && prices[p.pid][p.variant] && prices[p.pid][p.variant][p.cur];
    if (!priceId) { console.log('  NO PRICE ID for ' + p.label + ' — skipped'); continue; }
    const created = await api('/payment_links', 'POST', {
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      'line_items[0][adjustable_quantity][enabled]': 'true',
      'line_items[0][adjustable_quantity][minimum]': '1',
      'line_items[0][adjustable_quantity][maximum]': '20',
      'shipping_address_collection[allowed_countries][0]': 'GB',
      'shipping_address_collection[allowed_countries][1]': 'AU',
      'shipping_address_collection[allowed_countries][2]': 'IE',
    });
    if (created.error) { console.log('  FAILED to create for ' + p.label + ': ' + created.error.message); continue; }
    html = html.split(p.url).join(created.url);
    changed++;
    console.log('  NEW LINK ' + p.label + ' -> ' + created.url);
  }
  if (changed) { fs.writeFileSync(HTML, html); console.log('\nindex.html updated with ' + changed + ' new link(s).'); }
  else console.log('\nNo URL changes needed (all repaired in place).');
})().catch(e => { console.error(e); process.exit(1); });
