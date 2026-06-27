import { db, logDecision } from './orchestrator/lib/supabase.mjs';

// seo-audit rows for sitemap XML files — not actionable via metadata-generate or blog-write.
// These require human review to determine what sitemap audit action to take.
const sitemapAuditIds = [239, 240, 241, 242, 243, 244, 245];
const sitemapUrls = [
  'https://www.maxxbuilders.com/post-sitemap.xml',
  'https://www.maxxbuilders.com/page-sitemap.xml',
  'https://www.maxxbuilders.com/portfolio-sitemap.xml',
  'https://www.maxxbuilders.com/locations-sitemap.xml',
  'https://www.maxxbuilders.com/project-type-sitemap.xml',
  'https://www.maxxbuilders.com/project-attributes-sitemap.xml',
  'https://www.maxxbuilders.com/geo-sitemap.xml',
];

console.log('Escalating seo-audit sitemap rows...');

// Mark all as escalated
const { error } = await db.from('work_queue')
  .update({ status: 'escalated' })
  .in('id', sitemapAuditIds);

if (error) {
  console.error('ERROR updating status:', JSON.stringify(error));
} else {
  console.log(`Marked ${sitemapAuditIds.length} sitemap seo-audit rows as escalated`);
}

// Log decisions for each
for (const url of sitemapUrls) {
  await logDecision({
    url,
    action: 'escalated',
    risk_class: 'safe',
    change_type: 'seo-audit',
    reason: 'seo-audit on sitemap XML file: not actionable via automated changeset — requires human review to determine sitemap structure audit action',
    agent: 'orchestrator',
  });
  console.log('Logged decision for:', url);
}

console.log('\nDone.');

// Final remaining pending count
const { data: remaining } = await db.from('work_queue').select('id,url,task,status').eq('status', 'pending');
console.log('\nRemaining pending rows:', remaining?.length ?? 0);
for (const r of (remaining ?? [])) {
  console.log(`  [${r.id}] ${r.task} | ${r.url}`);
}
