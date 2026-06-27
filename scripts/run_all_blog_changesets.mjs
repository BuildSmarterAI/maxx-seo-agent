// Converts 6 existing blog drafts from markdown → HTML and inserts approved
// changeset rows into Supabase so `npm run wp:apply` can push them to WordPress.
// design-build-construction-houston has no existing WP post — use create_design_build_post.mjs
import { readFileSync } from 'fs';
import { marked } from 'marked';
import { insertChangeset } from '../orchestrator/lib/supabase.mjs';

// WP post IDs confirmed via API 2026-06-25
const POSTS = [
  {
    slug: 'medical-office-construction-costs-texas-2026-comprehensive-guide',
    page_id: '5913',
    url: 'https://www.maxxbuilders.com/medical-office-construction-costs-texas-2026-comprehensive-guide/',
  },
  {
    slug: 'hotel-construction-guide',
    page_id: '3581',
    url: 'https://www.maxxbuilders.com/hotel-construction-guide/',
  },
  {
    slug: 'the-ultimate-2026-hotel-construction-cost-guide-texas-edition',
    page_id: '5975',
    url: 'https://www.maxxbuilders.com/the-ultimate-2026-hotel-construction-cost-guide-texas-edition/',
  },
  {
    slug: 'importance-of-mock-up-rooms-in-the-hospitality-industry',
    page_id: '300',
    url: 'https://www.maxxbuilders.com/importance-of-mock-up-rooms-in-the-hospitality-industry/',
  },
  {
    slug: 'warehouse-construction-cost-per-square-foot',
    page_id: '3324',
    url: 'https://www.maxxbuilders.com/warehouse-construction-cost-per-square-foot-a-comprehensive-guide/',
  },
  {
    slug: 'cost-per-square-foot-build-warehouse-texas',
    page_id: '3508',
    url: 'https://www.maxxbuilders.com/cost-per-square-foot-build-warehouse-texas/',
  },
];

// Strip markdown front-matter (--- ... ---) before converting
function stripFrontmatter(md) {
  return md.replace(/^---[\s\S]*?---\n/, '');
}

let inserted = 0;
for (const post of POSTS) {
  const md = readFileSync(`drafts/${post.slug}.md`, 'utf8');
  const html = marked.parse(stripFrontmatter(md));

  await insertChangeset({
    platform: 'wordpress',
    page_id: post.page_id,
    url: post.url,
    field: 'post_content',
    base_value: null,
    new_value: html,
    change_type: 'blog-write',
    status: 'approved',
  });
  console.log(`  ✓ ${post.page_id} → ${post.slug}`);
  inserted++;
}

console.log(`\n${inserted} rows inserted with status=approved.`);
console.log('Next: npm run wp:apply');
