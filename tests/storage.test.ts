import { describe, expect, it } from 'vitest';
import { browserStorage, loadRecords, recordsOf, saveRecords, type RecordStore } from '../src/storage';

const KEY = 'retro-racer.records.v2';
const LEGACY_KEY = 'retro-racer.records';

function fakeStore(initial: Record<string, string> = {}): RecordStore & { data: Map<string, string> } {
  const data = new Map<string, string>(Object.entries(initial));
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
  it('맵별로 저장한 기록을 다시 불러옵니다', () => {
    const store = fakeStore();
    const book = {
      sunset: { bestTime: 141.5, bestDistance: 900000 },
      snow: { bestTime: null, bestDistance: 1200 },
    };
    saveRecords(store, book);
    expect(loadRecords(store)).toEqual(book);
  });

  it('저장된 값이 없으면 빈 기록부를 반환합니다', () => {
    expect(loadRecords(fakeStore())).toEqual({});
  });

  it('맵이 하나뿐이던 때의 기록은 도달 거리만 첫 맵의 기록으로 넘깁니다', () => {
    const store = fakeStore({
      [LEGACY_KEY]: '{"bestTime":150.2,"bestDistance":1798000}',
    });
    expect(loadRecords(store)).toEqual({
      sunset: { bestTime: null, bestDistance: 1798000 },
    });
  });

  it('새 형식으로 저장한 뒤에는 예전 기록을 다시 읽지 않습니다', () => {
    const store = fakeStore({
      [LEGACY_KEY]: '{"bestTime":150.2,"bestDistance":1798000}',
    });
    saveRecords(store, { snow: { bestTime: 160, bestDistance: 1798000 } });
    expect(loadRecords(store)).toEqual({
      snow: { bestTime: 160, bestDistance: 1798000 },
    });
  });

  it('손상된 값은 빈 기록부로 대체합니다', () => {
    for (const raw of ['not json', 'null', '[1,2]', '7']) {
      expect(loadRecords(fakeStore({ [KEY]: raw }))).toEqual({});
    }
    expect(loadRecords(fakeStore({ [LEGACY_KEY]: 'not json' }))).toEqual({});
  });

  it('맵마다 유효한 항목만 받아들입니다', () => {
    const raw =
      '{"sunset":{"bestTime":"x","bestDistance":1200},"snow":"빠름","neon":{"bestTime":-5,"bestDistance":-1}}';
    expect(loadRecords(fakeStore({ [KEY]: raw }))).toEqual({
      sunset: { bestTime: null, bestDistance: 1200 },
      snow: EMPTY,
      neon: EMPTY,
    });
  });

  it('저장소가 없으면 오류 없이 빈 기록부를 반환합니다', () => {
    expect(loadRecords(null)).toEqual({});
    expect(() => saveRecords(null, {})).not.toThrow();
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
    expect(loadRecords(broken)).toEqual({});
    expect(() => saveRecords(broken, {})).not.toThrow();
  });

  it('브라우저가 아닌 환경에서는 저장소가 없습니다', () => {
    expect(browserStorage()).toBeNull();
  });
});

describe('recordsOf', () => {
  it('기록이 있는 맵은 그 기록을, 없는 맵은 기본값을 반환합니다', () => {
    const book = { sunset: { bestTime: 141.5, bestDistance: 900000 } };
    expect(recordsOf(book, 'sunset')).toEqual({
      bestTime: 141.5,
      bestDistance: 900000,
    });
    expect(recordsOf(book, 'snow')).toEqual(EMPTY);
    expect(recordsOf(book, 'toString')).toEqual(EMPTY);
  });
});
