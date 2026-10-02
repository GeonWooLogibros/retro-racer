import { describe, expect, it } from 'vitest';
import { MAX_SPEED, PROP_CRASH_SPEED, SEGMENT_LENGTH, START_TIME, STEP } from '../src/game/constants';
import { createGame, requestStart, startRace, step } from '../src/game/step';
import { buildTrack } from '../src/game/track';
import type { GameState, Input } from '../src/game/types';

const track = buildTrack();
const idle: Input = { left: false, right: false, accel: false, brake: false, nitro: false };
const key = (over: Partial<Input>): Input => ({ ...idle, ...over });

describe('createGame과 startRace', () => {
  it('타이틀 상태로 시작합니다', () => {
    const state = createGame(track);
    expect(state.phase).toBe('title');
    expect(state.time).toBe(START_TIME);
    expect(state.cars).toHaveLength(40);
    expect(state.events).toEqual([]);
  });

  it('startRace는 주행 상태를 만듭니다', () => {
    expect(startRace(track).phase).toBe('racing');
  });
});

describe('requestStart', () => {
  it('주행 중에는 상태를 바꾸지 않습니다', () => {
    const racing = { ...startRace(track), elapsed: 30 };
    expect(requestStart(racing, track)).toBe(racing);
  });

  it('타이틀과 결과 화면에서는 새 경주를 시작합니다', () => {
    expect(requestStart(createGame(track), track).phase).toBe('racing');
    const over: GameState = { ...startRace(track), phase: 'timeUp', time: 0, elapsed: 90 };
    const next = requestStart(over, track);
    expect(next.phase).toBe('racing');
    expect(next.time).toBe(START_TIME);
    expect(next.elapsed).toBe(0);
  });
});

describe('step', () => {
  it('주행 중이 아니면 상태를 그대로 반환합니다', () => {
    const state = createGame(track);
    expect(step(state, key({ accel: true }), track, STEP)).toBe(state);
  });

  it('종료된 뒤 다음 단계에서 사건 목록을 비웁니다', () => {
    const over: GameState = { ...startRace(track), phase: 'finished', events: ['finish'] };
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
    const state = { ...base, cars: [], player: { ...base.player, speed: MAX_SPEED, nitro: 50 } };
    expect(step(state, key({ nitro: true }), track, STEP).events).toContain('nitroStart');
    const active = step(state, key({ nitro: true }), track, STEP);
    expect(step(active, key({ nitro: true }), track, STEP).events).not.toContain('nitroStart');
  });

  it('길가 사물에 부딪히면 속도가 거의 0으로 줄어듭니다', () => {
    const segment = track.segments.find((s) => s.index > 100 && s.props.some((pr) => Math.abs(pr.offset) < 1.9))!;
    const prop = segment.props[0];
    const base = startRace(track);
    const state = {
      ...base,
      cars: [],
      player: { ...base.player, z: segment.index * SEGMENT_LENGTH + 10, x: prop.offset, speed: MAX_SPEED / 2 },
    };
    const next = step(state, idle, track, STEP);
    expect(next.events).toContain('crash');
    expect(next.player.speed).toBe(PROP_CRASH_SPEED);
  });

  it('도로 안에서는 길가 사물과 충돌하지 않습니다', () => {
    const base = startRace(track);
    let state: GameState = { ...base, cars: [], player: { ...base.player, speed: MAX_SPEED } };
    for (let i = 0; i < 120; i++) state = step(state, key({ accel: true }), track, STEP);
    expect(state.player.speed).toBe(MAX_SPEED);
  });

  it('시간이 0이 되면 차량이 멈춘 뒤 실패로 종료합니다', () => {
    const base = startRace(track);
    let state: GameState = { ...base, cars: [], time: 0.01, player: { ...base.player, speed: MAX_SPEED } };
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
    for (const v of [player.z, player.x, player.speed, player.nitro, state.time, state.elapsed]) {
      expect(Number.isFinite(v)).toBe(true);
    }
    expect(player.z).toBeGreaterThan(startRace(track).player.z);
    expect(Math.abs(player.x)).toBeLessThanOrEqual(2);
  });
});
