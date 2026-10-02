import { describe, expect, it } from 'vitest';
import { browserStorage, loadRecords, saveRecords, type RecordStore } from '../src/storage';

function fakeStore(initial?: string): RecordStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set('retro-racer.records', initial);
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

const EMPTY = { bestTime: null, bestDistance: 0 };

describe('기록 저장', () => {
  it('저장한 기록을 다시 불러옵니다', () => {
    const store = fakeStore();
    saveRecords(store, { bestTime: 141.5, bestDistance: 900000 });
    expect(loadRecords(store)).toEqual({ bestTime: 141.5, bestDistance: 900000 });
  });

  it('저장된 값이 없으면 기본값을 반환합니다', () => {
    expect(loadRecords(fakeStore())).toEqual(EMPTY);
  });

  it('손상된 값은 기본값으로 대체합니다', () => {
    expect(loadRecords(fakeStore('not json'))).toEqual(EMPTY);
    expect(loadRecords(fakeStore('null'))).toEqual(EMPTY);
    expect(loadRecords(fakeStore('[1,2]'))).toEqual(EMPTY);
    expect(loadRecords(fakeStore('{"bestTime":"빠름","bestDistance":"멀리"}'))).toEqual(EMPTY);
    expect(loadRecords(fakeStore('{"bestTime":-5,"bestDistance":-100}'))).toEqual(EMPTY);
  });

  it('유효한 항목만 받아들입니다', () => {
    expect(loadRecords(fakeStore('{"bestTime":"x","bestDistance":1200}'))).toEqual({
      bestTime: null,
      bestDistance: 1200,
    });
  });

  it('저장소가 없으면 오류 없이 기본값을 반환합니다', () => {
    expect(loadRecords(null)).toEqual(EMPTY);
    expect(() => saveRecords(null, EMPTY)).not.toThrow();
  });

  it('저장소가 예외를 던져도 오류를 내지 않습니다', () => {
    const broken: RecordStore = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('quota');
      },
    };
    expect(loadRecords(broken)).toEqual(EMPTY);
    expect(() => saveRecords(broken, EMPTY)).not.toThrow();
  });

  it('브라우저가 아닌 환경에서는 저장소가 없습니다', () => {
    expect(browserStorage()).toBeNull();
  });
});
