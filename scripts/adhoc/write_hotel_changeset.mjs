import { readFileSync } from 'fs';
import { insertChangeset } from '../orchestrator/lib/supabase.mjs';

const newContent = readFileSync('tmp_hotel_new.html', 'utf8');
const baseText = 'Understanding hotel construction cost in 2026 is essential for developers planning hospitality projects across Texas. The financial environment remains tight, interest rates are still elevated, and lenders require far more detailed cost backing than previous cycles.';

await insertChangeset({
  platform: 'wordpress',
  page_id: '5975',
  url: 'https://www.maxxbuilders.com/the-ultimate-2026-hotel-construction-cost-guide-texas-edition/',
  field: 'post_content',
  base_value: baseText,
  new_value: newContent,
  change_type: 'blog-write',
  status: 'pending',
});
console.log('changeset row inserted');
