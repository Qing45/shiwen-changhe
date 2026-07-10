// 小学必背诗（primary 语料库）专用飞花令关键字清单。
// 设计目标：每字在 primary 语料库中至少有 5 句诗可挖空，使单字闯关能稳定出题。
// 每字 ≥5 句由 tests/primary-keywords.test.ts 用真实引擎校验。
//
// 来源：spec §6 候选字池 + 数据扫描后回补。
// 第一轮（31 首）：春月花风山水人天 / 雪江日雨寒明酒落清城舟头。
// 第二轮（清理 6 首假阳性后剩 25 首）：天/江/寒/酒/落/清/城 跌破 5 句阈值，
// 替换为同样高频且 ≥5 句的：一/来/绿/时/上/尽/万。
// 第三轮（scraper 根因修复后扩到 65 首）：所有 20 字均 ≥5 句。
// 第四轮（语料扩到 108 首）：对齐唐诗三档结构扩到 30 字，
// entry 补 云/天，新增 advanced 档 江/千/声/青/夜/红/飞/秋（均 ≥10 句）。

export const PRIMARY_KEYWORD_GROUPS = {
  entry: ['春', '月', '花', '风', '山', '水', '人', '一', '云', '天'],
  mid: ['雪', '来', '日', '雨', '绿', '明', '时', '上', '尽', '万', '舟', '头'],
  advanced: ['江', '千', '声', '青', '夜', '红', '飞', '秋'],
} as const;

export const PRIMARY_KEYWORDS: readonly string[] = [
  ...PRIMARY_KEYWORD_GROUPS.entry,
  ...PRIMARY_KEYWORD_GROUPS.mid,
  ...PRIMARY_KEYWORD_GROUPS.advanced,
];
