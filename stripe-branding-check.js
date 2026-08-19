/** Read-only: report what Stripe currently has stored for account branding. */
const KEY = process.env.STRIPE_KEY;
if (!KEY) { console.error('STRIPE_KEY required'); process.exit(1); }

async function api(path) {
  const r = await fetch('https://api.stripe.com/v1' + path, { headers: { Authorization: 'Bearer ' + KEY } });
  return r.json();
}
(async () => {
  const a = await api('/account');
  if (a.error) { console.error('Stripe error: ' + a.error.message); process.exit(1); }
  const bp = a.business_profile || {};
  const dash = (a.settings && a.settings.dashboard) || {};
  const pay = (a.settings && a.settings.payments) || {};
  const brand = (a.settings && a.settings.branding) || {};
  console.log('ACCOUNT ID              : ' + a.id);
  console.log('Country / default curr  : ' + a.country + ' / ' + (a.default_currency || '').toUpperCase());
  console.log('');
  console.log('>> What customers see on Checkout / Payment Links / receipts:');
  console.log('   business_profile.name (Public business name) : ' + (bp.name || '(not set)'));
  console.log('   settings.payments.statement_descriptor       : ' + (pay.statement_descriptor || '(not set)'));
  console.log('');
  console.log('>> Internal / dashboard only:');
  console.log('   settings.dashboard.display_name : ' + (dash.display_name || '(not set)'));
  console.log('   settings.dashboard.timezone     : ' + (dash.timezone || '(not set)'));
  console.log('');
  console.log('>> Branding assets:');
  console.log('   logo    : ' + (brand.logo || '(none)'));
  console.log('   icon    : ' + (brand.icon || '(none)'));
  console.log('   primary : ' + (brand.primary_color || '(none)'));
  console.log('');
  console.log('   support email / url / phone : ' + (bp.support_email || '-') + ' | ' + (bp.support_url || '-') + ' | ' + (bp.support_phone || '-'));
  console.log('   business url                : ' + (bp.url || '-'));
})();
