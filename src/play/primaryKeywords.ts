// 小学必背 80 首（primary 语料库）专用飞花令关键字清单。
// 设计目标：每字在 primary 语料库中至少有 5 句诗可挖空，使单字闯关能稳定出题。
//
// 来源：spec §6 候选字池（entry + mid 各 8 字）+ 数据扫描后回补。
// 扫描发现：草/秋/夜/云/愁/柳/红 等字在仅 31 首小学诗中不足 5 句；
// 替换为同样意象丰富且 ≥5 句的：日/雨/寒/明/酒/落/清/城/舟/头。
// 最终保留 20 字（每个 ≥5 句），覆盖春/月/风/雨/山/水/天/江 等小学高频意象。

export const PRIMARY_KEYWORD_GROUPS = {
  entry: ['春', '月', '花', '风', '山', '水', '人', '天'],
  mid: ['雪', '江', '日', '雨', '寒', '明', '酒', '落', '清', '城', '舟', '头'],
} as const;

export const PRIMARY_KEYWORDS: readonly string[] = [
  ...PRIMARY_KEYWORD_GROUPS.entry,
  ...PRIMARY_KEYWORD_GROUPS.mid,
];
