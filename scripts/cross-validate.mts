import { readFileSync } from 'node:fs';
import { PRIMARY_LIST } from './scraper/primary-list';

const poems = JSON.parse(readFileSync('./src/data/poems.json', 'utf-8')) as Array<{
  id: string;
  title: string;
  poetId: string;
  corpus: string;
  content: string;
}>;
const poets = JSON.parse(readFileSync('./src/data/poets.json', 'utf-8')) as Array<{
  id: string;
  name: string;
  corpus: string;
}>;

const primaryPoems = poems.filter((p) => p.corpus === 'primary' || p.corpus === 'both');
const matched: Array<{ poem: (typeof primaryPoems)[number]; poetName: string; spec: (typeof PRIMARY_LIST)[number]; viaPrefix?: boolean }> = [];
const unmatched: Array<{ poem: (typeof primaryPoems)[number]; poetName: string }> = [];

for (const poem of primaryPoems) {
  const poet = poets.find((p) => p.id === poem.poetId);
  const poetName = poet?.name ?? '';
  const exact = PRIMARY_LIST.find((e) => e.title === poem.title && e.poetName === poetName);
  if (exact) {
    matched.push({ poem, poetName, spec: exact });
    continue;
  }
  const prefix = PRIMARY_LIST.find((e) => poem.title.startsWith(e.title) && e.poetName === poetName);
  if (prefix) {
    matched.push({ poem, poetName, spec: prefix, viaPrefix: true });
    continue;
  }
  unmatched.push({ poem, poetName });
}

console.log('=== Cross-validation: ' + primaryPoems.length + ' primary poems vs ' + PRIMARY_LIST.length + ' spec entries ===');
console.log('Matched: ' + matched.length);
console.log('Unmatched: ' + unmatched.length);

console.log('\n=== UNMATCHED (potential false positives) ===');
for (const { poem, poetName } of unmatched) {
  console.log('  ' + poem.title + ' — ' + poetName + ' (' + poem.id + ')');
}

console.log('\n=== MATCHED via prefix (poem title has suffix) ===');
for (const m of matched) {
  if (m.viaPrefix) {
    console.log('  poem "' + m.poem.title + '" ← spec "' + m.spec.title + '" by ' + m.spec.poetName);
  }
}

console.log('\n=== Spec entries NOT scraped ===');
for (const entry of PRIMARY_LIST) {
  const found =
    primaryPoems.some((p) => {
      const poet = poets.find((pp) => pp.id === p.poetId);
      return p.title === entry.title && poet?.name === entry.poetName;
    }) ||
    primaryPoems.some((p) => {
      const poet = poets.find((pp) => pp.id === p.poetId);
      return p.title.startsWith(entry.title) && poet?.name === entry.poetName;
    });
  if (!found) {
    console.log('  ' + entry.title + ' — ' + entry.poetName);
  }
}
