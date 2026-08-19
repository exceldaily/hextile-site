/**
 * Hextile — Stripe Payment Link checker / recreator.
 *
 * CHECK (no credentials): loads every payment link in a real browser and
 * records whether Stripe reports it deactivated. This is the only reliable
 * test — a deactivated link still serves its page with HTTP 200.
 *   node stripe-links-tool.js
 *
 * RECREATE (needs STRIPE_KEY): for every dead link, creates a NEW payment
 * link from the same price id, then rewrites index.html with the new URLs.
 *   STRIPE_KEY=rk_live_... node stripe-links-tool.js --recreate
 *
 * The key is read from the environment only and is never written anywhere.
 */

const fs = require('fs');

const HTML = __dirname + '/index.html';

function loadMaps() {
  const html = fs.readFileSync(HTML, 'utf8');
  function grab(name) {
    const m = html.match(new RegExp('const ' + name + ' = \\{[\\s\\S]*?\\n\\};'));
    if (!m) throw new Error('could not find ' + name + ' in index.html');
    return eval('(' + m[0].replace('const ' + name + ' = ', '').replace(/;$/, '') + ')');
  }
  return { links: grab('STRIPE_LINKS'), prices: grab('PRICE_IDS') };
}

const NAMES = { p1: 'Soundsbay Honeycomb', p2: 'TONOR Hexagon', p3: 'TONOR Wood Panels', p4: 'TONOR Square', p5: 'FIXCHORD Tape' };

function flatten(links) {
  const out = [];
  for (const pid of Object.keys(links))
    for (const variant of Object.keys(links[pid]))
      for (const cur of Object.keys(links[pid][variant]))
        out.push({ pid, variant, cur, label: NAMES[pid] + ' ' + variant + ' ' + cur, url: links[pid][variant][cur] });
  return out;
}

async function checkAll(entries) {
  const { chromium } = require('playwright-core');
  const browser = await chromium.launch({ channel: 'chrome' });
  const results = [];
  for (const e of entries) {
    const page = await browser.newPage();
    let deactivated = false;
    page.on('response', r => {
      if (r.url().includes('/payment-links/') && r.status() === 404) deactivated = true;
    });
    try {
      await page.goto(e.url, { waitUntil: 'networkidle', timeout: 45000 });
    } catch (err) { /* ignore load timeouts, the response listener is what matters */ }
    // A live link renders the product name and a Pay button; a dead one shows an error page.
    const bodyText = await page.evaluate(() => document.body.innerText).catch(() => '');
    const looksDead = deactivated || /no longer active|link is inactive/i.test(bodyText);
    results.push({ ...e, dead: looksDead });
    console.log((looksDead ? '  ** DEAD  ' : '  OK       ') + e.label);
    await page.close();
  }
  await browser.close();
  return results;
}

async function stripeApi(path, method, params, key) {
  const res = await fetch('https://api.stripe.com/v1' + path, {
    method: method || 'GET',
    headers: {
      Authorization: 'Bearer ' + key,
      ...(method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    body: method === 'POST' ? new URLSearchParams(params).toString() : undefined,
  });
  return res.json();
}

(async () => {
  const { links, prices } = loadMaps();
  const entries = flatten(links);
  console.log('Checking ' + entries.length + ' payment links in a real browser...\n');
  const results = await checkAll(entries);
  const dead = results.filter(r => r.dead);
  console.log('\n' + (results.length - dead.length) + ' active, ' + dead.length + ' deactivated.');

  if (!dead.length) return;
  console.log('\nDeactivated:');
  dead.forEach(d => console.log('  - ' + d.label + '  ' + d.url));

  if (!process.argv.includes('--recreate')) {
    console.log('\nRun with STRIPE_KEY=rk_live_... --recreate to create fresh links automatically.');
    return;
  }
  const KEY = process.env.STRIPE_KEY;
  if (!KEY) { console.error('\n--recreate needs STRIPE_KEY in the environment.'); process.exit(1); }

  let html = fs.readFileSync(HTML, 'utf8');
  let replaced = 0;
  for (const d of dead) {
    const priceId = prices[d.pid] && prices[d.pid][d.variant] && prices[d.pid][d.variant][d.cur];
    if (!priceId) { console.log('  no price id for ' + d.label + ' — skipped'); continue; }
    const created = await stripeApi('/payment_links', 'POST', {
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      'line_items[0][adjustable_quantity][enabled]': 'true',
      'line_items[0][adjustable_quantity][minimum]': '1',
      'line_items[0][adjustable_quantity][maximum]': '20',
      'shipping_address_collection[allowed_countries][0]': 'GB',
      'shipping_address_collection[allowed_countries][1]': 'AU',
      'shipping_address_collection[allowed_countries][2]': 'IE',
    }, KEY);
    if (created.error) { console.log('  FAILED ' + d.label + ': ' + created.error.message); continue; }
    html = html.split(d.url).join(created.url);
    replaced++;
    console.log('  NEW LINK ' + d.label + ' -> ' + created.url);
  }
  if (replaced) {
    fs.writeFileSync(HTML, html);
    console.log('\nindex.html updated with ' + replaced + ' new link(s).');
  }
})().catch(e => { console.error(e); process.exit(1); });
