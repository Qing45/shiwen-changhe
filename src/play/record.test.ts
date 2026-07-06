import { describe, it, expect, beforeEach } from 'vitest';
import { loadRecord, saveRecord, recordWin, recordLoss } from './record';
import { INITIAL_RECORD } from './types';

describe('combat record persistence', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('loadRecord returns INITIAL_RECORD when empty', () => {
    expect(loadRecord()).toEqual(INITIAL_RECORD);
  });

  it('saveRecord round-trips', () => {
    const r = {
      qingdeng: { win: 3, lose: 2 },
      mohe:     { win: 1, lose: 4 },
      shisheng: { win: 0, lose: 0 },
    };
    saveRecord(r);
    expect(loadRecord()).toEqual(r);
  });

  it('recordWin bumps only that difficulty win and persists', () => {
    const r1 = recordWin('mohe');
    expect(r1.mohe.win).toBe(1);
    expect(r1.qingdeng.win).toBe(0);
    expect(r1.shisheng.win).toBe(0);

    const r2 = recordWin('mohe');
    expect(r2.mohe.win).toBe(2);
    expect(loadRecord().mohe.win).toBe(2);
  });

  it('recordLoss bumps only that difficulty lose and persists', () => {
    const r = recordLoss('qingdeng');
    expect(r.qingdeng.lose).toBe(1);
    expect(loadRecord().qingdeng.lose).toBe(1);
  });

  it('survives localStorage being unavailable on read', () => {
    const orig = window.localStorage.getItem;
    window.localStorage.getItem = () => { throw new Error('denied'); };
    expect(loadRecord()).toEqual(INITIAL_RECORD);
    window.localStorage.getItem = orig;
  });

  it('survives localStorage being unavailable on write', () => {
    const orig = window.localStorage.setItem;
    window.localStorage.setItem = () => { throw new Error('quota'); };
    expect(() => recordWin('qingdeng')).not.toThrow();
    window.localStorage.setItem = orig;
  });

  it('parses malformed JSON gracefully', () => {
    window.localStorage.setItem('shiwen-feihua-record', 'not-json');
    expect(loadRecord()).toEqual(INITIAL_RECORD);
  });

  it('parses partial object with missing difficulty keys', () => {
    window.localStorage.setItem(
      'shiwen-feihua-record',
      JSON.stringify({ qingdeng: { win: 5, lose: 3 } }),
    );
    const r = loadRecord();
    expect(r.qingdeng.win).toBe(5);
    expect(r.mohe).toEqual({ win: 0, lose: 0 });
    expect(r.shisheng).toEqual({ win: 0, lose: 0 });
  });
});
