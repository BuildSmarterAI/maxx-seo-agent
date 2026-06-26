import { db } from './orchestrator/lib/supabase.mjs';

// These are duplicate pending rows where a done/escalated/skipped counterpart already exists
// We skip them (mark as skipped) since the work is already done
const duplicatePendingIds = [
  178, 179, 180, 182, 183, 184, 185, 186,  // blog-write duplicates
  188, 189, 190, 192, 197, 198, 199, 201, 206, 208, 209, 213, 216, 217, 225, 232, 234  // metadata-generate duplicates
];

console.log(`Marking ${duplicatePendingIds.length} duplicate pending rows as skipped...`);

const { error } = await db.from('work_queue')
  .update({ status: 'skipped' })
  .in('id', duplicatePendingIds);

if (error) {
  console.error('ERROR:', JSON.stringify(error));
} else {
  console.log('Done. All duplicate pending rows marked as skipped.');
}

// Verify remaining pending rows
const { data: remaining } = await db.from('work_queue')
  .select('id,url,task,status')
  .eq('status', 'pending');

console.log('\nRemaining pending rows:', remaining?.length ?? 0);
for (const row of (remaining ?? [])) {
  console.log(`  [${row.id}] ${row.task} | ${row.url}`);
}
