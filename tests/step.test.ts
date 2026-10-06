import { describe, expect, it } from 'vitest';
import {
  CRASH_KEEP,
  FALL_KEEP,
  MAX_SPEED,
  PROP_CRASH_SPEED,
  SEGMENT_LENGTH,
  START_TIME,
  STEP,
} from '../src/game/constants';
import { createGame, startRace, step } from '../src/game/step';
import { buildTrack } from '../src/game/track';
import type { GameState, Input } from '../src/game/types';

const track = buildTrack();
const idle: Input = {
  left: false,
  right: false,
  accel: false,
  brake: false,
  nitro: false,
  drift: false,
};
const key = (over: Partial<Input>): Input => ({ ...idle, ...over });

describe('createGame과 startRace', () => {
  it('타이틀 상태로 시작합니다', () => {
    const state = createGame(track);
    expect(state.phase).toBe('title');
    expect(state.time).toBe(START_TIME);
    expect(state.events).toEqual([]);
  });

  it('startRace는 주행 상태를 만듭니다', () => {
    expect(startRace(track).phase).toBe('racing');
  });
});

describe('step', () => {
  it('주행 중이 아니면 상태를 그대로 반환합니다', () => {
    const state = createGame(track);
    expect(step(state, key({ accel: true }), track, STEP)).toBe(state);
  });

  it('종료된 뒤 다음 단계에서 사건 목록을 비웁니다', () => {
    const over: GameState = {
      ...startRace(track),
      phase: 'finished',
      events: ['finish'],
    };
    const next = step(over, idle, track, STEP);
    expect(next.events).toEqual([]);
    expect(next.phase).toBe('finished');
  });

  it('가속하면 앞으로 이동하고 시간이 흐릅니다', () => {
    const start = startRace(track);
    const next = step(start, key({ accel: true }), track, STEP);
    expect(next.player.speed).toBeGreaterThan(0);
    expect(next.player.z).toBeGreaterThan(start.player.z);
    expect(next.time).toBeLessThan(START_TIME);
  });

  it('니트로가 시작되면 사건을 기록합니다', () => {
    const base = startRace(track);
    const state = {
      ...base,
      rivals: [],
      rank: 1,
      player: { ...base.player, speed: MAX_SPEED, boosters: 1 },
    };
    expect(step(state, key({ nitro: true }), track, STEP).events).toContain('nitroStart');
    const active = step(state, key({ nitro: true }), track, STEP);
    expect(step(active, key({ nitro: true }), track, STEP).events).not.toContain('nitroStart');
    expect(active.player.boosters).toBe(0);
  });

  it('길가 사물에 부딪히면 속도가 절반쯤으로 줄어듭니다', () => {
    const segment = track.segments.find((s) => s.index > 100 && s.props.some((pr) => Math.abs(pr.offset) < 1.9))!;
    const prop = segment.props[0];
    const base = startRace(track);
    const state = {
      ...base,
      rivals: [],
      rank: 1,
      player: {
        ...base.player,
        z: segment.index * SEGMENT_LENGTH + 10,
        x: prop.offset,
        speed: MAX_SPEED / 2,
      },
    };
    const next = step(state, idle, track, STEP);
    expect(next.events).toContain('crash');
    // 부딪히기 전 한 단계 동안 줄어든 속도의 절반이 남습니다.
    expect(next.player.speed).toBeLessThanOrEqual((MAX_SPEED / 2) * CRASH_KEEP);
    expect(next.player.speed).toBeGreaterThan((MAX_SPEED / 2) * CRASH_KEEP * 0.95);
    expect(next.player.speed).toBeGreaterThan(PROP_CRASH_SPEED);
  });

  it('도로 안에서는 길가 사물과 충돌하지 않습니다', () => {
    const base = startRace(track);
    let state: GameState = {
      ...base,
      rivals: [],
      rank: 1,
      player: { ...base.player, speed: MAX_SPEED },
    };
    for (let i = 0; i < 120; i++) state = step(state, key({ accel: true }), track, STEP);
    expect(state.player.speed).toBe(MAX_SPEED);
  });

  it('드리프트를 끝내며 터보가 붙으면 사건을 기록하고 연속 보너스가 쌓입니다', () => {
    const base = startRace(track);
    let state: GameState = { ...base, rivals: [], rank: 1, player: { ...base.player, speed: MAX_SPEED } };
    const slide = key({ drift: true, right: true, accel: true });
    for (let i = 0; i < 48; i++) {
      state = step({ ...state, player: { ...state.player, x: 0 } }, slide, track, STEP);
    }
    expect(state.events).not.toContain('turbo');
    state = step(state, key({ accel: true }), track, STEP);
    expect(state.events).toContain('turbo');
    expect(state.combo).toBe(1);
    state = step(state, key({ accel: true, left: true }), track, STEP);
    expect(state.events).toContain('counterBoost');
    expect(state.combo).toBe(2);
  });

  it('터보가 남아 있을 때 짧은 드리프트를 끝내면 터보 사건을 기록하지 않습니다', () => {
    const base = startRace(track);
    let state: GameState = {
      ...base,
      rivals: [],
      rank: 1,
      player: { ...base.player, speed: MAX_SPEED, turbo: 0.6 },
    };
    const slide = key({ drift: true, right: true, accel: true });
    for (let i = 0; i < 6; i++) state = step({ ...state, player: { ...state.player, x: 0 } }, slide, track, STEP);
    state = step(state, key({ accel: true }), track, STEP);
    expect(state.events).not.toContain('turbo');
  });

  it('부스터가 끝나는 단계에 바로 다음 부스터를 써도 사용 사건을 기록합니다', () => {
    const base = startRace(track);
    const state: GameState = {
      ...base,
      rivals: [],
      rank: 1,
      player: { ...base.player, speed: MAX_SPEED, boosters: 1, nitroActive: true, nitroTime: STEP / 2 },
    };
    const next = step(state, key({ nitro: true }), track, STEP);
    expect(next.events).toContain('nitroStart');
    expect(next.player.boosters).toBe(0);
  });

  it('연속 보너스는 시간이 지나면 끊깁니다', () => {
    const base = startRace(track);
    let state: GameState = { ...base, rivals: [], rank: 1, combo: 3, comboTime: 0.1 };
    for (let i = 0; i < 12; i++) state = step(state, key({ accel: true }), track, STEP);
    expect(state.combo).toBe(0);
  });

  it('부스터 게이지가 가득 차면 부스터 충전 사건을 기록합니다', () => {
    const base = startRace(track);
    const state: GameState = {
      ...base,
      rivals: [],
      rank: 1,
      player: { ...base.player, speed: MAX_SPEED, gauge: 99.9 },
    };
    const slide = key({ drift: true, right: true, accel: true });
    const next = step(state, slide, track, STEP);
    expect(next.player.boosters).toBe(1);
    expect(next.events).toContain('boosterReady');
  });

  it('급커브에서 드리프트하며 달리면 다른 차량이 없을 때 제한 시간 안에 완주합니다', () => {
    let state: GameState = { ...startRace(track), rivals: [], rank: 1 };
    for (let i = 0; i < 400 * 60 && state.phase === 'racing'; i++) {
      const { x, z } = state.player;
      const curve = track.segments[Math.floor(z / SEGMENT_LENGTH)].curve;
      const target = Math.abs(curve) >= 1 ? 0.4 * Math.sign(curve) : 0;
      const right = x < target - 0.05;
      const left = x > target + 0.05;
      const inward = (right && curve > 0) || (left && curve < 0);
      const input = key({
        accel: true,
        left,
        right,
        drift: Math.abs(curve) >= 4.5 && inward,
      });
      state = step(state, input, track, STEP);
    }
    expect(state.phase).toBe('finished');
  });

  it('급커브에서 조향만 하고 감속하지 않으면 도로 밖으로 밀려납니다', () => {
    const sharp = track.segments.find((s) => Math.abs(s.curve) >= 8)!;
    const base = startRace(track);
    let state: GameState = {
      ...base,
      rivals: [],
      rank: 1,
      player: {
        ...base.player,
        z: sharp.index * SEGMENT_LENGTH,
        speed: MAX_SPEED,
      },
    };
    const inward = key({
      accel: true,
      right: sharp.curve > 0,
      left: sharp.curve < 0,
    });
    let left = false;
    for (let i = 0; i < 90 && !left; i++) {
      state = step(state, inward, track, STEP);
      left = Math.abs(state.player.x) > 1;
    }
    expect(left).toBe(true);
  });

  it('다리에서 벗어나면 떨어져서 길 가운데로 돌아오고 속도를 잃습니다', () => {
    const bridge = track.segments.find((s) => s.terrain.kind === 'bridge' && s.width < 0.65)!;
    const base = startRace(track);
    const state: GameState = {
      ...base,
      rivals: [],
      rank: 1,
      player: {
        ...base.player,
        z: bridge.index * SEGMENT_LENGTH + 10,
        x: 0.9,
        speed: MAX_SPEED,
      },
    };
    const next = step(state, idle, track, STEP);
    expect(next.events).toContain('fall');
    expect(next.player.x).toBe(0);
    expect(next.player.speed).toBeLessThanOrEqual(MAX_SPEED * FALL_KEEP);
    expect(next.player.speed).toBeGreaterThan(MAX_SPEED * FALL_KEEP * 0.95);
  });

  it('다리 끝에서 조금 벗어난 정도로는 떨어지지 않고, 여유를 넘으면 떨어집니다', () => {
    const bridge = track.segments.find((s) => s.terrain.kind === 'bridge' && s.width < 0.65)!;
    const base = startRace(track);
    const at = (x: number): GameState => ({
      ...base,
      rivals: [],
      rank: 1,
      player: { ...base.player, z: bridge.index * SEGMENT_LENGTH + 10, x, speed: MAX_SPEED },
    });
    expect(step(at(bridge.width + 0.1), idle, track, STEP).events).not.toContain('fall');
    expect(step(at(bridge.width + 0.2), idle, track, STEP).events).toContain('fall');
  });

  it('다리 위에 있으면 떨어지지 않습니다', () => {
    const bridge = track.segments.find((s) => s.terrain.kind === 'bridge' && s.width < 0.65)!;
    const base = startRace(track);
    const state: GameState = {
      ...base,
      rivals: [],
      rank: 1,
      player: {
        ...base.player,
        z: bridge.index * SEGMENT_LENGTH + 10,
        x: 0.5,
        speed: MAX_SPEED,
      },
    };
    expect(step(state, idle, track, STEP).events).not.toContain('fall');
  });

  it('도로 밖이 땅인 지형에서는 벗어나도 떨어지지 않습니다', () => {
    const base = startRace(track);
    const state: GameState = {
      ...base,
      rivals: [],
      rank: 1,
      player: { ...base.player, x: 1.8, speed: MAX_SPEED },
    };
    expect(step(state, idle, track, STEP).events).not.toContain('fall');
  });

  it('시간이 0이 되면 차량이 멈춘 뒤 실패로 종료합니다', () => {
    const base = startRace(track);
    let state: GameState = {
      ...base,
      rivals: [],
      rank: 1,
      time: 0.01,
      player: { ...base.player, speed: MAX_SPEED },
    };
    for (let i = 0; i < 20 * 60 && state.phase === 'racing'; i++) {
      state = step(state, key({ accel: true }), track, STEP);
    }
    expect(state.phase).toBe('timeUp');
    expect(state.player.speed).toBe(0);
  });

  it('30초 동안 가속만 해도 모든 값이 유한합니다', () => {
    let state = startRace(track);
    for (let i = 0; i < 30 * 60; i++) state = step(state, key({ accel: true }), track, STEP);
    const { player } = state;
    for (const v of [player.z, player.x, player.speed, player.gauge, state.time, state.elapsed]) {
      expect(Number.isFinite(v)).toBe(true);
    }
    expect(player.z).toBeGreaterThan(startRace(track).player.z);
    expect(Math.abs(player.x)).toBeLessThanOrEqual(2);
  });
});
