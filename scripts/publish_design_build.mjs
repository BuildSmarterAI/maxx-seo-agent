const BASE = process.env.WP_BASE_URL?.replace(/\/$/, '');
const AUTH = 'Basic ' + Buffer.from(`${process.env.WP_USER}:${process.env.WP_APP_PASSWORD}`).toString('base64');
const r = await fetch(`${BASE}/wp-json/wp/v2/posts/7429`, {
  method: 'POST',
  headers: { Authorization: AUTH, 'Content-Type': 'application/json' },
  body: JSON.stringify({ status: 'publish', slug: 'design-build-construction-houston' }),
});
if (!r.ok) throw new Error(`WP ${r.status}: ${await r.text()}`);
const p = await r.json();
console.log(`Published: ${p.link}`);
