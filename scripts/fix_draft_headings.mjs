// One-shot fix: rename TL;DR headings → Key Takeaways, remove standalone ## Internal Links sections
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const DRAFTS = [
  'medical-office-construction-costs-texas-2026-comprehensive-guide.md',
  'hotel-construction-guide.md',
  'the-ultimate-2026-hotel-construction-cost-guide-texas-edition.md',
  'importance-of-mock-up-rooms-in-the-hospitality-industry.md',
  'design-build-construction-houston.md',
  'warehouse-construction-cost-per-square-foot.md',
  'cost-per-square-foot-build-warehouse-texas.md',
];

const DIR = 'drafts';

for (const file of DRAFTS) {
  const path = join(DIR, file);
  let text = readFileSync(path, 'utf8');
  const original = text;

  // 1. Normalize TL;DR heading variants → ## Key Takeaways
  text = text.replace(/^## TL;DR\s*[—\-\/]\s*Key Takeaways$/m, '## Key Takeaways');
  text = text.replace(/^## TL;DR\s*\/\s*Key Takeaways$/m, '## Key Takeaways');

  // 2. Remove the ## Internal Links standalone section.
  //    Pattern: optional ---\n\n, then ## Internal Links heading, all lines until next ---, then that ---
  //    We strip from (the --- before Internal Links OR just the heading) through the closing ---
  text = text.replace(/\n---\n\n## Internal Links\n[\s\S]*?\n---(?=\n)/g, '\n---');
  // Fallback: no leading --- (section at end of file or without preceding ---)
  text = text.replace(/\n## Internal Links\n[\s\S]*?(\n---|\s*$)/g, '$1');

  if (text === original) {
    console.log(`  no changes: ${file}`);
  } else {
    writeFileSync(path, text, 'utf8');
    const tldr = original.match(/## TL;DR/) ? '✓ TL;DR heading fixed' : '';
    const links = original.match(/## Internal Links/) ? '✓ Internal Links removed' : '';
    console.log(`  updated ${file}: ${[tldr, links].filter(Boolean).join(', ')}`);
  }
}
