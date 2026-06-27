import { db } from './orchestrator/lib/supabase.mjs';

const { data, error } = await db.from('work_queue')
  .select('id,url,task,status,created_at')
  .order('id', { ascending: true });

if (error) { console.error(error); process.exit(1); }

// Group by url+task
const groups = {};
for (const row of data) {
  const key = row.url + '|' + row.task;
  if (!groups[key]) groups[key] = [];
  groups[key].push({ id: row.id, status: row.status });
}

// Show groups with multiple rows (duplicates)
const duplicates = Object.entries(groups).filter(([k, v]) => v.length > 1);
console.log('DUPLICATE URL+TASK COMBINATIONS:');
for (const [key, rows] of duplicates) {
  console.log(key, '->', JSON.stringify(rows));
}

// Show truly new pending (no corresponding done row)
const genuinelyPending = Object.entries(groups).filter(([k, v]) => {
  return v.every(r => r.status === 'pending');
});
console.log('\nGENUINELY PENDING (no done counterpart):');
for (const [key, rows] of genuinelyPending) {
  console.log(key, '->', JSON.stringify(rows));
}

console.log('\nTotal rows:', data.length);
console.log('Pending rows:', data.filter(r => r.status === 'pending').length);
console.log('Done rows:', data.filter(r => r.status === 'done').length);
