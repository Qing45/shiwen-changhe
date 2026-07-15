// 关卡序号转中文。当前最大 50 关（小学库 entry + mid + advanced 三档合计）。
// >50 直接走 String 兜底——理论上不会触发，但作为防御。
const CN_DIGITS = ['零','一','二','三','四','五','六','七','八','九','十'];

export function toChineseNum(n: number): string {
  if (n <= 10) return CN_DIGITS[n];
  if (n < 20) return '十' + CN_DIGITS[n - 10];
  if (n === 20) return '二十';
  if (n < 30) return '二十' + CN_DIGITS[n - 20];
  if (n === 30) return '三十';
  if (n < 40) return '三十' + CN_DIGITS[n - 30];
  if (n === 40) return '四十';
  if (n < 50) return '四十' + CN_DIGITS[n - 40];
  if (n === 50) return '五十';
  return String(n);
}
