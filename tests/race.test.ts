import { describe, expect, it } from 'vitest';
import { CHECKPOINT_BONUS, START_TIME, START_Z } from '../src/game/constants';
import { applyResult, distanceOf, updateRace } from '../src/game/race';
import { startRace } from '../src/game/step';
import { buildTrack } from '../src/game/track';
import type { GameState, Player } from '../src/game/types';

const track = buildTrack();

function make(over: Partial<GameState> = {}, playerOver: Partial<Player> = {}): GameState {
  const base = startRace(track);
  return { ...base, ...over, player: { ...base.player, speed: 5000, ...playerOver } };
}

describe('updateRace', () => {
  it('남은 시간이 줄고 경과 시간이 늘어납니다', () => {
    const next = updateRace(make(), track, 1);
    expect(next.time).toBe(START_TIME - 1);
    expect(next.elapsed).toBe(1);
    expect(next.phase).toBe('racing');
  });

  it('체크포인트를 통과하면 시간이 30초 추가됩니다', () => {
    const next = updateRace(make({ elapsed: 20 }, { z: track.checkpoints[0] }), track, 1);
    expect(next.checkpointsPassed).toBe(1);
    expect(next.time).toBe(START_TIME - 1 + CHECKPOINT_BONUS);
    expect(next.lastCheckpointAt).toBe(21);
    expect(next.events).toContain('checkpoint');
  });

  it('같은 체크포인트를 두 번 계산하지 않습니다', () => {
    const first = updateRace(make({}, { z: track.checkpoints[0] }), track, 1);
    const second = updateRace({ ...first, events: [] }, track, 1);
    expect(second.checkpointsPassed).toBe(1);
    expect(second.events).not.toContain('checkpoint');
  });

  it('시간이 0이어도 차량이 움직이는 동안에는 끝나지 않습니다', () => {
    const next = updateRace(make({ time: 0 }, { speed: 500 }), track, 1);
    expect(next.time).toBe(0);
    expect(next.phase).toBe('racing');
  });

  it('시간이 0이고 차량이 멈추면 실패로 종료합니다', () => {
    const next = updateRace(make({ time: 0 }, { speed: 0 }), track, 1);
    expect(next.phase).toBe('timeUp');
    expect(next.events).toContain('timeUp');
  });

  it('시간이 0인 상태로 체크포인트에 도달하면 경주가 이어집니다', () => {
    const next = updateRace(make({ time: 0 }, { speed: 0, z: track.checkpoints[0] }), track, 1);
    expect(next.time).toBe(CHECKPOINT_BONUS);
    expect(next.phase).toBe('racing');
  });

  it('결승점을 통과하면 완주로 종료합니다', () => {
    const next = updateRace(make({ checkpointsPassed: 4 }, { z: track.finishZ }), track, 1);
    expect(next.phase).toBe('finished');
    expect(next.events).toContain('finish');
  });

  it('남은 시간이 10초 이하일 때 1초마다 경고를 냅니다', () => {
    expect(updateRace(make({ time: 10.005 }), track, 0.01).events).toContain('timeWarning');
    expect(updateRace(make({ time: 9.5 }), track, 0.01).events).not.toContain('timeWarning');
    expect(updateRace(make({ time: 20.005 }), track, 0.01).events).not.toContain('timeWarning');
  });
});

describe('기록', () => {
  it('도달 거리는 출발 위치를 기준으로 계산합니다', () => {
    expect(distanceOf({ ...make().player, z: START_Z + 500 })).toBe(500);
    expect(distanceOf({ ...make().player, z: 0 })).toBe(0);
  });

  it('첫 완주는 신기록입니다', () => {
    const state = make({ phase: 'finished', elapsed: 140 }, { z: track.finishZ });
    const result = applyResult({ bestTime: null, bestDistance: 0 }, state);
    expect(result.isNew).toBe(true);
    expect(result.records.bestTime).toBe(140);
    expect(result.records.bestDistance).toBe(track.finishZ - START_Z);
  });

  it('완주 시간이 더 짧을 때에만 기록을 갱신합니다', () => {
    const slow = make({ phase: 'finished', elapsed: 150 }, { z: track.finishZ });
    const fast = make({ phase: 'finished', elapsed: 130 }, { z: track.finishZ });
    const records = { bestTime: 140, bestDistance: 0 };
    expect(applyResult(records, slow).isNew).toBe(false);
    expect(applyResult(records, slow).records.bestTime).toBe(140);
    expect(applyResult(records, fast).isNew).toBe(true);
    expect(applyResult(records, fast).records.bestTime).toBe(130);
  });

  it('실패했을 때는 더 멀리 간 경우에만 거리 기록을 갱신합니다', () => {
    const state = make({ phase: 'timeUp' }, { z: START_Z + 5000 });
    const better = applyResult({ bestTime: null, bestDistance: 4000 }, state);
    expect(better.isNew).toBe(true);
    expect(better.records).toEqual({ bestTime: null, bestDistance: 5000 });
    const worse = applyResult({ bestTime: 140, bestDistance: 9000 }, state);
    expect(worse.isNew).toBe(false);
    expect(worse.records).toEqual({ bestTime: 140, bestDistance: 9000 });
  });

  it('경주가 끝나지 않았으면 기록을 바꾸지 않습니다', () => {
    const records = { bestTime: null, bestDistance: 0 };
    expect(applyResult(records, make())).toEqual({ records, isNew: false });
  });
});
