import { describe, it, expect, beforeEach } from 'vitest';
import { MAX_BAND } from '../data/grades';
import { loadGrade, saveGrade } from './primaryGrade';

describe('primary grade state', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('defaults to MAX_BAND when no saved value exists', () => {
    expect(loadGrade()).toBe(MAX_BAND);
  });

  it('round-trips a selected band', () => {
    saveGrade(5);
    expect(loadGrade()).toBe(5);
  });

  it('normalizes corrupt or out-of-range saved values to MAX_BAND', () => {
    window.localStorage.setItem('shiwen-feihua-grade', 'abc');
    expect(loadGrade()).toBe(MAX_BAND);
    window.localStorage.setItem('shiwen-feihua-grade', '0');
    expect(loadGrade()).toBe(MAX_BAND);
    window.localStorage.setItem('shiwen-feihua-grade', '13');
    expect(loadGrade()).toBe(MAX_BAND);
  });

  it('normalizes before saving', () => {
    saveGrade(99);
    expect(window.localStorage.getItem('shiwen-feihua-grade')).toBe(String(MAX_BAND));
  });

  it('survives localStorage being unavailable', () => {
    const originalGet = window.localStorage.getItem;
    const originalSet = window.localStorage.setItem;
    window.localStorage.getItem = () => { throw new Error('denied'); };
    window.localStorage.setItem = () => { throw new Error('denied'); };
    expect(loadGrade()).toBe(MAX_BAND);
    expect(() => saveGrade(5)).not.toThrow();
    window.localStorage.getItem = originalGet;
    window.localStorage.setItem = originalSet;
  });
});