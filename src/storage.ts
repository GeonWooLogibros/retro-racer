import type { Records } from './game/types';

export type RecordStore = Pick<Storage, 'getItem' | 'setItem'>;

/** 맵 id별 기록. */
export type RecordBook = Record<string, Records>;

const KEY = 'retro-racer.records.v2';
/** 맵이 하나뿐이던 때의 저장 위치. 도달 거리만 첫 맵의 기록으로 넘깁니다. */
const LEGACY_KEY = 'retro-racer.records';
const LEGACY_MAP = 'sunset';

const empty = (): Records => ({ bestTime: null, bestDistance: 0 });

export function browserStorage(): RecordStore | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function parseRecords(value: unknown): Records {
  if (typeof value !== 'object' || value === null) return empty();
  const { bestTime, bestDistance } = value as Record<string, unknown>;
  return {
    bestTime: typeof bestTime === 'number' && Number.isFinite(bestTime) && bestTime > 0 ? bestTime : null,
    bestDistance:
      typeof bestDistance === 'number' && Number.isFinite(bestDistance) && bestDistance > 0 ? bestDistance : 0,
  };
}

export function recordsOf(book: RecordBook, mapId: string): Records {
  return Object.hasOwn(book, mapId) ? book[mapId] : empty();
}

export function loadRecords(store: RecordStore | null): RecordBook {
  if (!store) return {};
  try {
    const raw = store.getItem(KEY);
    if (raw === null) {
      const legacy = store.getItem(LEGACY_KEY);
      if (!legacy) return {};
      // 그때의 코스는 지금보다 쉬워서, 완주 시간을 넘기면 깰 수 없는 기록이 됩니다.
      return {
        [LEGACY_MAP]: { ...parseRecords(JSON.parse(legacy)), bestTime: null },
      };
    }
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
    const book: RecordBook = {};
    for (const [mapId, records] of Object.entries(value)) book[mapId] = parseRecords(records);
    return book;
  } catch {
    return {};
  }
}

export function saveRecords(store: RecordStore | null, book: RecordBook): void {
  if (!store) return;
  try {
    store.setItem(KEY, JSON.stringify(book));
  } catch {
    // 저장할 수 없는 환경에서는 기록 저장만 생략합니다.
  }
}
