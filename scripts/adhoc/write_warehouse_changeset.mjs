import { readFileSync } from 'fs';
import { insertChangeset, logDecision } from '../orchestrator/lib/supabase.mjs';

const newContent = readFileSync('C:/dev/maxx-seo-agent/tmp_warehouse_new.html', 'utf8');

const baseText = 'Warehouse construction cost remains a decisive factor for developers and investors planning new industrial projects in 2025. Knowing the warehouse construction cost per square foot is important. This applies to both distribution centers in Houston';

await insertChangeset({
  platform: 'wordpress',
  page_id: '3324',
  url: 'https://www.maxxbuilders.com/warehouse-construction-cost-per-square-foot-a-comprehensive-guide/',
  field: 'post_content',
  base_value: baseText,
  new_value: newContent,
  change_type: 'blog-write',
  status: 'pending',
});
console.log('changeset row inserted');