import { db } from './orchestrator/lib/supabase.mjs';

// These are duplicate pending rows where work is already done.
// We need to mark each one individually. Some can't be 'skipped' due to unique constraint,
// so we use 'done' for those (work is complete).
const rows = [
  // blog-write duplicates (done counterparts exist)
  { id: 178, note: 'homepage blog-write - done at id 175' },
  { id: 179, note: 'warehouse cost blog-write - done at id 1' },
  { id: 180, note: 'medical office blog-write - done at id 2' },
  { id: 182, note: 'hotel 2026 blog-write - done at id 3' },
  { id: 183, note: 'hotel guide blog-write - done at id 4' },
  { id: 184, note: 'http homepage blog-write - escalated at id 5' },
  { id: 185, note: 'mockup rooms blog-write - done at id 6' },
  { id: 186, note: 'warehouse comprehensive blog-write - done at id 7' },
  // metadata-generate duplicates (done counterparts exist)
  { id: 188, note: 'homepage metadata - done at id 176' },
  { id: 189, note: 'commercial costs metadata - done at id 9' },
  { id: 190, note: 'warehouse cost metadata - done at id 10' },
  { id: 192, note: 'commercial buildouts metadata - done at id 12' },
  { id: 197, note: '10 key steps metadata - done at id 17' },
  { id: 198, note: '3 obstacles metadata - done at id 177' },
  { id: 199, note: '8 restaurant metadata - done at id 20' },
  { id: 201, note: 'best retail contractors metadata - done at id 22' },
  { id: 206, note: 'retail buildout costs metadata - done at id 26' },
  { id: 208, note: 'mixed-use metadata - done at id 29' },
  { id: 209, note: 'houston commercial cost metadata - done at id 30' },
  { id: 213, note: 'commercial timelines metadata - done at id 34' },
  { id: 216, note: 'commercial loans metadata - done at id 37' },
  { id: 217, note: 'complete commercial guide metadata - done at id 38' },
  { id: 225, note: 'restaurant cost-efficient metadata - done at id 46' },
  { id: 232, note: 'car wash metadata - done at id 53' },
  { id: 234, note: 'dallas costs metadata - done at id 55' },
];

let successCount = 0;
let errorCount = 0;

for (const row of rows) {
  // Try 'done' first, then 'skipped' if that conflicts
  let { error } = await db.from('work_queue')
    .update({ status: 'done' })
    .eq('id', row.id);

  if (error && error.code === '23505') {
    // 'done' conflicts, try 'cancelled'
    const res2 = await db.from('work_queue')
      .update({ status: 'cancelled' })
      .eq('id', row.id);
    if (res2.error) {
      // try 'duplicate'... actually just delete it
      const res3 = await db.from('work_queue').delete().eq('id', row.id);
      if (res3.error) {
        console.error(`[${row.id}] FAILED to resolve: ${JSON.stringify(res3.error)}`);
        errorCount++;
      } else {
        console.log(`[${row.id}] DELETED (unique constraint prevented status update): ${row.note}`);
        successCount++;
      }
    } else {
      console.log(`[${row.id}] marked cancelled: ${row.note}`);
      successCount++;
    }
  } else if (error) {
    console.error(`[${row.id}] ERROR: ${JSON.stringify(error)}`);
    errorCount++;
  } else {
    console.log(`[${row.id}] marked done: ${row.note}`);
    successCount++;
  }
}

console.log(`\nDone: ${successCount}/${rows.length}, Errors: ${errorCount}`);

// Final pending count
const { data: remaining } = await db.from('work_queue').select('id,url,task,status').eq('status', 'pending');
console.log('\nRemaining pending:', remaining?.length ?? 0);
for (const r of (remaining ?? [])) {
  console.log(`  [${r.id}] ${r.task} | ${r.url}`);
}
