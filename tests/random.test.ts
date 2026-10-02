import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/game/random';

describe('mulberry32', () => {
  it('시드가 같으면 같은 수열을 만듭니다', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('0 이상 1 미만의 값을 만듭니다', () => {
    const rand = mulberry32(7);
    for (let i = 0; i < 1000; i++) {
      const v = rand();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
