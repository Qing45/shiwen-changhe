import { describe, it, expect } from 'vitest';
import { extractVariants, getPoemMode, splitIntoLines } from './poemText';

describe('extractVariants', () => {
  it('returns clean text unchanged when no variants present', () => {
    const r = extractVariants('寥落古行宫，宫花寂寞红。');
    expect(r.cleanText).toBe('寥落古行宫，宫花寂寞红。');
    expect(r.variants).toEqual([]);
  });

  it('extracts a single 一作 variant', () => {
    const r = extractVariants('请君为我倾耳听。(倾耳听 一作：侧耳听)');
    expect(r.cleanText).toBe('请君为我倾耳听。');
    expect(r.variants).toEqual([
      { original: '倾耳听', variant: '侧耳听', kind: '一作' },
    ]);
  });

  it('extracts multiple variants separated by ；within one paren', () => {
    const r = extractVariants('x(不足贵 一作：何足贵；不愿醒 一作：不复醒)y');
    expect(r.cleanText).toBe('xy');
    expect(r.variants).toEqual([
      { original: '不足贵', variant: '何足贵', kind: '一作' },
      { original: '不愿醒', variant: '不复醒', kind: '一作' },
    ]);
  });

  it('extracts 通 variants', () => {
    const r = extractVariants('x(惟 通：唯)y');
    expect(r.variants).toEqual([
      { original: '惟', variant: '唯', kind: '通' },
    ]);
  });

  it('extracts mixed 一作 and 通 in same paren', () => {
    const r = extractVariants('x(古来 一作：自古；惟 通：唯)y');
    expect(r.variants).toEqual([
      { original: '古来', variant: '自古', kind: '一作' },
      { original: '惟', variant: '唯', kind: '通' },
    ]);
  });

  it('handles half-width colon after marker', () => {
    const r = extractVariants('x(倾耳听 一作: 侧耳听)y');
    expect(r.variants).toEqual([
      { original: '倾耳听', variant: '侧耳听', kind: '一作' },
    ]);
  });

  it('preserves non-variant parenthetical asides', () => {
    const r = extractVariants('正文（不是变体注释）继续。');
    expect(r.cleanText).toBe('正文（不是变体注释）继续。');
    expect(r.variants).toEqual([]);
  });

  it('extracts variants from real-world 将进酒 excerpt', () => {
    const content = '与君歌一曲，请君为我倾耳听。(倾耳听 一作：侧耳听)钟鼓馔玉不足贵，但愿长醉不愿醒。(不足贵 一作：何足贵；不愿醒 一作：不复醒)';
    const r = extractVariants(content);
    expect(r.cleanText).toBe('与君歌一曲，请君为我倾耳听。钟鼓馔玉不足贵，但愿长醉不愿醒。');
    expect(r.variants.length).toBe(3);
    expect(r.variants[0]).toEqual({ original: '倾耳听', variant: '侧耳听', kind: '一作' });
  });
});

describe('getPoemMode', () => {
  it('returns short for <= 80 chars', () => {
    expect(getPoemMode('寥落古行宫，宫花寂寞红。白头宫女在，闲坐说玄宗。')).toBe('short');
  });

  it('returns long for > 80 chars', () => {
    const long = '汉皇重色思倾国，御宇多年求不得。杨家有女初长成，养在深闺人未识。天生丽质难自弃，一朝选在君王侧。回眸一笑百媚生，六宫粉黛无颜色。春寒赐浴华清池，温泉水滑洗凝脂。侍儿扶起娇无力，始是新承恩泽时。';
    expect(long.length).toBeGreaterThan(80);
    expect(getPoemMode(long)).toBe('long');
  });

  it('boundary: 80 chars → short, 81 chars → long', () => {
    expect(getPoemMode('a'.repeat(80))).toBe('short');
    expect(getPoemMode('a'.repeat(81))).toBe('long');
  });
});

describe('splitIntoLines', () => {
  it('short mode: splits on each clause terminator', () => {
    const lines = splitIntoLines('寥落古行宫，宫花寂寞红。白头宫女在，闲坐说玄宗。', 'short');
    expect(lines).toEqual([
      '寥落古行宫，',
      '宫花寂寞红。',
      '白头宫女在，',
      '闲坐说玄宗。',
    ]);
  });

  it('long mode: keeps comma inside line, splits only on 。？！', () => {
    const lines = splitIntoLines('君不见黄河之水天上来，奔流到海不复回。君不见高堂明镜悲白发，朝如青丝暮成雪。', 'long');
    expect(lines).toEqual([
      '君不见黄河之水天上来，奔流到海不复回。',
      '君不见高堂明镜悲白发，朝如青丝暮成雪。',
    ]);
  });

  it('short mode: splits on ！ and ？ too', () => {
    const lines = splitIntoLines('谁家玉笛暗飞声？散入春风满洛城。', 'short');
    expect(lines).toEqual(['谁家玉笛暗飞声？', '散入春风满洛城。']);
  });

  it('short mode: splits on ； as a clause terminator', () => {
    const lines = splitIntoLines('first；second。', 'short');
    expect(lines).toEqual(['first；', 'second。']);
  });

  it('long mode: does NOT split on ，', () => {
    const lines = splitIntoLines('出句，对句。', 'long');
    expect(lines).toEqual(['出句，对句。']);
  });

  it('handles content with no terminators by returning single line', () => {
    const lines = splitIntoLines('no terminators here', 'short');
    expect(lines).toEqual(['no terminators here']);
  });

  it('long mode: 将进酒 multi-comma line stays on one line', () => {
    const content = '岑夫子，丹丘生，将进酒，杯莫停。';
    expect(splitIntoLines(content, 'long')).toEqual([content]);
  });
});
