import { describe, expect, it } from 'vitest';
import { MAX_FRAME_TIME } from '../src/game/constants';
import { accumulate } from '../src/game/loop';

describe('accumulate', () => {
  it('프레임 시간을 누적합니다', () => {
    expect(accumulate(0.01, 0.016)).toBeCloseTo(0.026, 8);
  });

  it('탭이 오래 멈춰 있었어도 누적 시간을 제한합니다', () => {
    expect(accumulate(0, 30)).toBe(MAX_FRAME_TIME);
  });

  it('음수이거나 유효하지 않은 프레임 시간은 무시합니다', () => {
    expect(accumulate(0.02, -1)).toBe(0.02);
    expect(accumulate(0.02, Number.NaN)).toBe(0.02);
  });
});
