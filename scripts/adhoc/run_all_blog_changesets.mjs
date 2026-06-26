import { readFileSync } from 'fs';
import { insertChangeset, logDecision, db } from './orchestrator/lib/supabase.mjs';

const tasks = [
  {
    file: './tmp_warehouse_cost_content.html',
    url: 'https://www.maxxbuilders.com/cost-per-square-foot-build-warehouse-texas/',
    page_id: 3508,
    queue_id_task: 'blog-write',
    base: 'How much does it cost to build a warehouse in Texas per square foot? Texas warehouse construction costs vary widely.',
    reason: 'blog-write: comprehensive 2026 Texas warehouse cost per SF guide with tables, FAQ, internal links'
  },
  {
    file: './tmp_medical_office_content.html',
    url: 'https://www.maxxbuilders.com/medical-office-construction-costs-texas-2026-comprehensive-guide/',
    page_id: 5913,
    queue_id_task: 'blog-write',
    base: 'Medical office construction in Texas costs between $200 and $450 per square foot for new ground-up builds.',
    reason: 'blog-write: comprehensive 2026 Texas medical office construction cost guide with specialty types, regulatory framework, FAQ'
  },
  {
    file: './tmp_apartment_content.html',
    url: 'https://www.maxxbuilders.com/10-steps-to-build-an-apartment-complex/',
    page_id: 446,
    queue_id_task: 'blog-write',
    base: 'Building an apartment complex requires careful planning across multiple phases from site selection through lease-up.',
    reason: 'blog-write: comprehensive 10-step Texas apartment complex development guide with costs, timeline, permitting, financing'
  },
  {
    file: './tmp_hotel_2026_content.html',
    url: 'https://www.maxxbuilders.com/the-ultimate-2026-hotel-construction-cost-guide-texas-edition/',
    page_id: 5975,
    queue_id_task: 'blog-write',
    base: 'Understanding hotel construction cost in 2026 is essential for developers planning hospitality projects across Texas.',
    reason: 'blog-write: 2026 Texas hotel construction cost guide by brand tier with TL;DR, cost tables, timeline, FAQ'
  },
  {
    file: './tmp_hotel_guide_content.html',
    url: 'https://www.maxxbuilders.com/hotel-construction-guide/',
    page_id: 3581,
    queue_id_task: 'blog-write',
    base: 'Building a hotel in Texas requires coordinating dozens of trades, navigating state and local permitting, and meeting brand requirements.',
    reason: 'blog-write: comprehensive Texas hotel construction guide covering cost, timeline, permits, phase-by-phase process, GC selection, FAQ'
  },
  {
    file: './tmp_mockup_rooms_content.html',
    url: 'https://www.maxxbuilders.com/importance-of-mock-up-rooms-in-the-hospitality-industry/',
    page_id: 300,
    queue_id_task: 'blog-write',
    base: 'Mock-up rooms are critical in hotel construction to validate brand standards and avoid costly rework.',
    reason: 'blog-write: comprehensive guide on hotel mock-up rooms — two-stage process, ADA requirements, cost/schedule impact, FAQ'
  },
  {
    file: './tmp_warehouse_comprehensive_content.html',
    url: 'https://www.maxxbuilders.com/warehouse-construction-cost-per-square-foot-a-comprehensive-guide/',
    page_id: 3324,
    queue_id_task: 'blog-write',
    base: 'Warehouse construction cost per square foot varies significantly based on building type, size, and location.',
    reason: 'blog-write: comprehensive Texas warehouse construction cost guide with full cost tables, tilt-wall vs PEMB comparison, phase breakdown, FAQ'
  }
];

let successCount = 0;
let errorCount = 0;

for (const task of tasks) {
  try {
    console.log(`\nProcessing: ${task.url}`);

    // Read content from file
    const newContent = readFileSync(task.file, 'utf8');
    console.log(`  Content: ${newContent.length} chars`);

    // Insert changeset (change_set table has no change_type column)
    await insertChangeset({
      platform: 'wordpress',
      page_id: String(task.page_id),
      url: task.url,
      field: 'post_content',
      base_value: task.base,
      new_value: newContent,
      status: 'pending',
    });
    console.log(`  Changeset inserted OK`);

    // Log decision
    await logDecision({
      url: task.url,
      action: 'queued',
      risk_class: 'safe',
      change_type: 'blog-write',
      reason: task.reason,
      agent: 'seo-fixer',
    });
    console.log(`  Decision logged OK`);

    // Mark queue row done
    await db.from('work_queue')
      .update({ status: 'done' })
      .eq('url', task.url)
      .eq('task', task.queue_id_task);
    console.log(`  Queue status -> done OK`);

    successCount++;
  } catch (err) {
    console.error(`  ERROR for ${task.url}:`, err.message);
    errorCount++;
  }
}

console.log(`\n=== SUMMARY ===`);
console.log(`Success: ${successCount}/${tasks.length}`);
console.log(`Errors: ${errorCount}/${tasks.length}`);
