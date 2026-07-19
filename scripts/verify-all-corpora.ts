import { getPoems, getPoets } from '../src/data/load';
import { layoutAllPoems, layoutPoets } from '../src/utils/layout';
import { computeCorpusYearRange } from '../src/utils/yearRange';
import { useCorpus as _ } from '../src/state/corpus'; // ignore unused

const corpora: Array<'tang' | 'primary' | 'junior' | 'senior' | 'all'> = ['tang', 'primary', 'junior', 'senior', 'all'];

function countCollisions(items: { x: number; y: number }[], minDx: number, minDy = 10): number {
  let c = 0;
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (Math.abs(items[i].x - items[j].x) < minDx && Math.abs(items[i].y - items[j].y) < minDy) {
        c++;
      }
    }
  }
  return c;
}

console.log('=== /poems (诗文长河) 碰撞检查 ===\n');

// 根据 PoemsRiverPage.tsx 当前的 isDense 规则
const isDense = (corpus: string) =>
  corpus === 'tang' || corpus === 'all' || corpus === 'primary' || corpus === 'junior';

for (const corpus of corpora) {
  const poems = getPoems(corpus === 'all' ? undefined : corpus as any);
  const poets = getPoets();
  const visiblePoets = poets.filter((p) => new Set(poems.map((x) => x.poetId)).has(p.id));
  const range = computeCorpusYearRange(visiblePoets, corpus as any);
  const minDx = isDense(corpus) ? 0.4 : 1.5;
  
  const positioned = layoutAllPoems(poems, poets, { minYear: range.minYear, maxYear: range.maxYear, leftPadding: 8, rightPadding: 8 }, minDx);
  const collisions = countCollisions(positioned, minDx);
  
  console.log(`${corpus.padEnd(8)} | poems=${poems.length.toString().padStart(3)} | minDx=${minDx.toString().padStart(3)}% | canvasWidth=${isDense(corpus) ? '4500' : '600'}% | collisions=${collisions}`);
}

console.log('\n=== /play /river (诗人长河) 碰撞检查 ===\n');

for (const corpus of corpora) {
  const poems = getPoems(corpus === 'all' ? undefined : corpus as any);
  const poets = getPoets();
  const visiblePoets = poets.filter((p) => new Set(poems.map((x) => x.poetId)).has(p.id));
  // 诗人视图的 layout 不用 minDx 参数调整，用默认 1.5%
  const range = computeCorpusYearRange(visiblePoets, corpus as any);
  const positioned = layoutPoets(visiblePoets, { minYear: range.minYear, maxYear: range.maxYear, leftPadding: 8, rightPadding: 8 });
  const collisions = countCollisions(positioned, 1.5);
  
  console.log(`${corpus.padEnd(8)} | poets=${visiblePoets.length.toString().padStart(3)} | canvasWidth=600% | collisions=${collisions}`);
}

