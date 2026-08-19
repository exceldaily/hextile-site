/* Drives the LIVE hextile.studio in a real browser and reports exactly what
   happens when the FIXCHORD tape is added to the cart and Checkout is tapped. */
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } }); // phone-sized
  const events = [];
  page.on('dialog', async d => { events.push('DIALOG: ' + d.message()); await d.accept(); });
  page.on('console', m => { if (m.type() === 'error') events.push('CONSOLE ERROR: ' + m.text()); });
  page.on('pageerror', e => events.push('PAGE ERROR: ' + e.message));
  page.on('response', async r => {
    const u = r.url();
    if (u.includes('workers.dev') || u.includes('stripe.com')) {
      let body = '';
      try { body = (await r.text()).slice(0, 300); } catch (e) { body = '(body unreadable: ' + e.message + ')'; }
      events.push('RESPONSE ' + r.status() + ' ' + u + ' :: ' + body.replace(/\n/g, ' '));
    }
  });
  page.on('requestfailed', r => {
    const u = r.url();
    if (u.includes('workers.dev') || u.includes('stripe.com')) events.push('REQUEST FAILED ' + u + ' :: ' + r.failure()?.errorText);
  });

  console.log('Loading live site...');
  await page.goto('https://hextile.studio/', { waitUntil: 'load', timeout: 60000 });

  const versionCheck = await page.evaluate(() => ({
    hasFallback: typeof fallbackCheckout === 'function',
    workerUrl: typeof WORKER_URL !== 'undefined' ? WORKER_URL : '(none)',
    tapeLinkAUD: typeof STRIPE_LINKS !== 'undefined' && STRIPE_LINKS.p5 && STRIPE_LINKS.p5['1cm'] ? STRIPE_LINKS.p5['1cm'].AUD : '(none)',
  }));
  console.log('LIVE SITE VERSION CHECK:', JSON.stringify(versionCheck));

  await page.evaluate(() => setCurrency('AUD'));
  await page.evaluate(() => addCurrentTapeToCart());
  const cartState = await page.evaluate(() => JSON.stringify(cart));
  console.log('CART AFTER ADD:', cartState);

  console.log('Clicking Checkout...');
  await page.click('#cart-checkout-btn');
  await page.waitForTimeout(8000);

  console.log('FINAL URL:', page.url());
  const btnText = await page.evaluate(() => {
    const b = document.getElementById('cart-checkout-btn');
    return b ? b.textContent.trim() : '(page navigated away)';
  }).catch(() => '(page navigated away)');
  console.log('CHECKOUT BUTTON STATE:', btnText);
  console.log('--- EVENTS ---');
  events.forEach(e => console.log(e));
  console.log('--- END ---');
  await browser.close();
})().catch(e => { console.error('SCRIPT ERROR:', e); process.exit(1); });
