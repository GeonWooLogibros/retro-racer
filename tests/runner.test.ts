import { describe, expect, it } from 'vitest';
import { MAX_SPEED } from '../src/game/constants';
import { createPlayer } from '../src/game/player';
import type { Player } from '../src/game/types';
import { HIT_POSE_SECONDS, RUN_FRAMES, advanceRun, runnerPose } from '../src/render/runner';

const make = (over: Partial<Player>): Player => ({ ...createPlayer(), speed: MAX_SPEED, ...over });

describe('runnerPose', () => {
  it('달리는 중에는 진행 정도에 맞는 달리기 그림을 고릅니다', () => {
    expect(runnerPose(make({}), 9, 0)).toEqual({ kind: 'run', frame: 0 });
    expect(runnerPose(make({}), 9, 4.7)).toEqual({ kind: 'run', frame: 4 });
    expect(runnerPose(make({}), 9, RUN_FRAMES + 1.2)).toEqual({ kind: 'run', frame: 1 });
  });

  it('멈춰 있으면 같은 그림에 머뭅니다', () => {
    expect(runnerPose(make({ speed: 0 }), 9, 0)).toEqual(runnerPose(make({ speed: 0 }), 9, 3.3));
  });

  it('니트로 중에는 제트팩, 드리프트 중에는 웅크린 자세입니다', () => {
    expect(runnerPose(make({ nitroActive: true }), 9, 0)).toEqual({ kind: 'jet' });
    expect(runnerPose(make({ drifting: true }), 9, 0)).toEqual({ kind: 'squat' });
  });

  it('부딪힌 직후에는 다른 상태보다 막힌 자세가 먼저입니다', () => {
    expect(runnerPose(make({ nitroActive: true, drifting: true }), 0.1, 0)).toEqual({ kind: 'blocked' });
    expect(runnerPose(make({}), HIT_POSE_SECONDS + 0.01, 0).kind).toBe('run');
  });
});

describe('advanceRun', () => {
  it('빠를수록 달리기 그림을 빨리 넘깁니다', () => {
    const slow = advanceRun(0, 0.3, 1);
    const fast = advanceRun(0, 1, 1);
    expect(fast).toBeGreaterThan(slow);
    expect(advanceRun(0, 0, 1)).toBe(0);
  });

  it('니트로로 최고 속도를 넘어도 일정 이상 빨라지지 않습니다', () => {
    expect(advanceRun(0, 5, 1)).toBe(advanceRun(0, 1.3, 1));
  });
});
