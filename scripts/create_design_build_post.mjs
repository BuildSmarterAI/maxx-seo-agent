// Creates design-build-construction-houston as a new WordPress draft post.
// This post has no existing WP ID so it can't go through the standard changeset pipeline.
// Run after confirming credentials: node --env-file=.env scripts/create_design_build_post.mjs
import { readFileSync } from 'fs';
import { marked } from 'marked';

const BASE = process.env.WP_BASE_URL?.replace(/\/$/, '');
const AUTH = 'Basic ' + Buffer.from(`${process.env.WP_USER}:${process.env.WP_APP_PASSWORD}`).toString('base64');
if (!BASE) throw new Error('Set WP_BASE_URL');

function stripFrontmatter(md) {
  return md.replace(/^---[\s\S]*?---\n/, '');
}

const md = readFileSync('drafts/design-build-construction-houston.md', 'utf8');
const html = marked.parse(stripFrontmatter(md));

const r = await fetch(`${BASE}/wp-json/wp/v2/posts`, {
  method: 'POST',
  headers: { Authorization: AUTH, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: 'Design-Build Construction Houston | Maxx Builders',
    slug: 'design-build-construction-houston',
    content: { raw: html },
    status: 'draft',
  }),
});

if (!r.ok) throw new Error(`WP ${r.status}: ${await r.text()}`);
const post = await r.json();
console.log(`Created post ID: ${post.id}`);
console.log(`Link: ${post.link}`);
console.log('Status: draft — review in WP dashboard before publishing.');
