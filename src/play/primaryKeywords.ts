// 小学必背诗（primary 语料库）专用飞花令关键字清单。
// 设计目标：每字在 primary 语料库中至少有 5 句诗可挖空，使单字闯关能稳定出题。
//
// 来源：spec §6 候选字池（entry + mid 各 8 字）+ 数据扫描后回补。
// 第一轮（31 首）：春月花风山水人天 / 雪江日雨寒明酒落清城舟头。
// 第二轮（清理 6 首假阳性后剩 25 首）：天/江/寒/酒/落/清/城 跌破 5 句阈值，
// 替换为同样高频且 ≥5 句的：一/来/绿/时/上/尽/万。
// 第三轮（scraper 根因修复后扩到 65 首，覆盖率 65/99）：所有 20 字均 ≥5 句，
// 多数字达 10+ 句，关键字系统更稳健。

export const PRIMARY_KEYWORD_GROUPS = {
  entry: ['春', '月', '花', '风', '山', '水', '人', '一'],
  mid: ['雪', '来', '日', '雨', '绿', '明', '时', '上', '尽', '万', '舟', '头'],
} as const;

export const PRIMARY_KEYWORDS: readonly string[] = [
  ...PRIMARY_KEYWORD_GROUPS.entry,
  ...PRIMARY_KEYWORD_GROUPS.mid,
];
