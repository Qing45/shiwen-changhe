// 飞花令关键字清单。50 字按难度三档分组，难度递进。
// 来源：spec §7。最终清单在 Task 2 的 buildKeywordIndex 扫描后验证每字 ≥ 5 句。

export const KEYWORD_GROUPS = {
  entry: ['春','月','花','风','山','水','云','天','人','心'],
  mid: ['夜','秋','年','日','雪','酒','梦','愁','思','江',
        '河','雨','柳','草','木','梅','竹','松','茶','楼'],
  advanced: ['菊','桃','燕','鸟','马','衣','书','剑','琴','笛',
             '钟','灯','影','台','城','海','舟','桥','鹤','霜'],
} as const;

export const KEYWORDS: readonly string[] = [
  ...KEYWORD_GROUPS.entry,
  ...KEYWORD_GROUPS.mid,
  ...KEYWORD_GROUPS.advanced,
];

// 对战 tab 默认可选的「自由 5 字礼包」，无需通关解锁（Plan 2 用）
export const FREE_KEYWORDS: readonly string[] = ['春','月','花','风','雪'];
