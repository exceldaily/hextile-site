/* Renders the checked-out index.html in real Chrome and saves full-page
   desktop + mobile screenshots to preview/ so the redesign can be reviewed
   before merging. */
const { chromium } = require('playwright-core');
const fs = require('fs');

(async () => {
  fs.mkdirSync('preview', { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome' });
  const url = 'file://' + __dirname + '/index.html';

  for (const [name, viewport] of [
    ['desktop', { width: 1440, height: 900 }],
    ['mobile', { width: 390, height: 844 }],
  ]) {
    const page = await browser.newPage({ viewport });
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    // Force scroll-reveal elements visible so the full-page shot isn't blank below the fold
    await page.evaluate(() => document.querySelectorAll('.reveal').forEach(el => el.classList.add('visible')));
    await page.waitForTimeout(1500); // let fonts and transitions settle
    await page.screenshot({ path: 'preview/' + name + '.png', fullPage: true });
    console.log('Saved preview/' + name + '.png');
    await page.close();
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
