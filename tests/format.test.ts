import { describe, expect, it } from 'vitest';
import { formatKm, formatTime, speedKmh } from '../src/format';
import { MAX_SPEED } from '../src/game/constants';

describe('표시 문자열', () => {
  it('시간을 분:초.백분의 일초 형식으로 표시합니다', () => {
    expect(formatTime(83.456)).toBe('1:23.45');
    expect(formatTime(5)).toBe('0:05.00');
    expect(formatTime(0)).toBe('0:00.00');
    expect(formatTime(-3)).toBe('0:00.00');
  });

  it('거리를 km 단위로 표시합니다', () => {
    expect(formatKm(1800000)).toBe('10.00 km');
    expect(formatKm(0)).toBe('0.00 km');
  });

  it('최고 속도는 시속 240km로 표시합니다', () => {
    expect(speedKmh(MAX_SPEED)).toBe(240);
    expect(speedKmh(0)).toBe(0);
    expect(speedKmh(MAX_SPEED / 2)).toBe(120);
  });
});
