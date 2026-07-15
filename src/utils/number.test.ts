import { describe, it, expect } from 'vitest';
import { toChineseNum } from './number';

describe('toChineseNum', () => {
  it('converts 1-10 to 一..十', () => {
    expect(toChineseNum(1)).toBe('一');
    expect(toChineseNum(5)).toBe('五');
    expect(toChineseNum(10)).toBe('十');
  });

  it('converts teens', () => {
    expect(toChineseNum(11)).toBe('十一');
    expect(toChineseNum(19)).toBe('十九');
  });

  it('converts twenties and thirties and forties', () => {
    expect(toChineseNum(20)).toBe('二十');
    expect(toChineseNum(21)).toBe('二十一');
    expect(toChineseNum(30)).toBe('三十');
    expect(toChineseNum(33)).toBe('三十三');
    expect(toChineseNum(40)).toBe('四十');
    expect(toChineseNum(45)).toBe('四十五');
    expect(toChineseNum(50)).toBe('五十');
  });

  it('falls back to String for >50', () => {
    expect(toChineseNum(51)).toBe('51');
    expect(toChineseNum(100)).toBe('100');
  });
});
