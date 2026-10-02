import type { Records } from './game/types';

export type RecordStore = Pick<Storage, 'getItem' | 'setItem'>;

const KEY = 'retro-racer.records';

const empty = (): Records => ({ bestTime: null, bestDistance: 0 });

export function browserStorage(): RecordStore | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadRecords(store: RecordStore | null): Records {
  if (!store) return empty();
  try {
    const raw = store.getItem(KEY);
    if (!raw) return empty();
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) return empty();
    const { bestTime, bestDistance } = value as Record<string, unknown>;
    return {
      bestTime: typeof bestTime === 'number' && Number.isFinite(bestTime) && bestTime > 0 ? bestTime : null,
      bestDistance:
        typeof bestDistance === 'number' && Number.isFinite(bestDistance) && bestDistance > 0 ? bestDistance : 0,
    };
  } catch {
    return empty();
  }
}

export function saveRecords(store: RecordStore | null, records: Records): void {
  if (!store) return;
  try {
    store.setItem(KEY, JSON.stringify(records));
  } catch {
    // 저장할 수 없는 환경에서는 기록 저장만 생략합니다.
  }
}
