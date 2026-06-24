import { readFileSync } from 'fs';

const csvPath = process.argv[2] || 'metadata-changes.csv';
const lines = readFileSync(csvPath, 'utf8').trim().split('\n');
const header = lines[0].split(',');
const required = ['url','page_id','current_title','new_title','current_description','new_description','canonical'];
const missing = required.filter(col => header.includes(col) === false);
if (missing.length) {
  console.error('Missing columns: ' + missing.join(', '));
  process.exit(1);
}

function parseCSVLine(line) {
  const fields = [];
  let inQ = false, cur = '';
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ; }
    else if (ch === ',' && !inQ) { fields.push(cur); cur = ''; }
    else { cur += ch; }
  }
  fields.push(cur);
  return fields;
}

const dataRows = lines.slice(1);
const errors = [];

dataRows.forEach((rawLine, i) => {
  const fields = parseCSVLine(rawLine);
  const row = {};
  header.forEach((h, idx) => { row[h] = (fields[idx] || '').trim(); });

  const newTitle = row['new_title'];
  const newDesc  = row['new_description'];
  const canon    = row['canonical'];
  const url      = row['url'];

  if (!url) errors.push(`Row ${i+1}: url is empty`);
  if (!newTitle) errors.push(`Row ${i+1}: new_title is empty`);
  if (newTitle && newTitle.length > 60) {
    errors.push(`Row ${i+1}: new_title length ${newTitle.length} exceeds 60 chars: "${newTitle}"`);
  }
  if (!newDesc) errors.push(`Row ${i+1}: new_description is empty`);
  if (newDesc && newDesc.length > 155) {
    errors.push(`Row ${i+1}: new_description length ${newDesc.length} exceeds 155 chars`);
  }
  if (canon !== url) errors.push(`Row ${i+1}: canonical "${canon}" does not match url "${url}"`);

  console.log(`Row ${i+1}: url=${url}`);
  console.log(`  new_title (${newTitle.length}c): ${newTitle}`);
  console.log(`  new_description (${newDesc.length}c): ${newDesc}`);
  console.log(`  canonical match: ${canon === url}`);
});

if (errors.length) {
  console.error('\nVALIDATION ERRORS:');
  errors.forEach(e => console.error('  ' + e));
  process.exit(1);
}

console.log('\nSchema validator: PASS');
