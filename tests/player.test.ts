import { describe, expect, it } from 'vitest';
import { MAX_SPEED, NITRO_BOOST, NITRO_DRAIN, OFFROAD_LIMIT, START_Z, STEP } from '../src/game/constants';
import { crash, createPlayer, hitProp, updatePlayer } from '../src/game/player';
import type { Input, Player } from '../src/game/types';

const idle: Input = { left: false, right: false, accel: false, brake: false, nitro: false };
const key = (over: Partial<Input>): Input => ({ ...idle, ...over });
const make = (over: Partial<Player>): Player => ({ ...createPlayer(), ...over });

function run(p: Player, input: Input, seconds: number, curve = 0, canAccelerate = true): Player {
  let player = p;
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    player = updatePlayer(player, input, curve, STEP, canAccelerate);
  }
  return player;
}

describe('createPlayer', () => {
  it('출발 위치에서 정지한 상태로 시작합니다', () => {
    expect(createPlayer()).toEqual({ z: START_Z, x: 0, speed: 0, nitro: 0, nitroActive: false });
  });
});

describe('가속과 감속', () => {
  it('가속 키를 누르면 1초에 최고 속도의 1/5만큼 빨라집니다', () => {
    expect(run(createPlayer(), key({ accel: true }), 1).speed).toBeCloseTo(MAX_SPEED / 5, 5);
  });

  it('최고 속도를 넘지 않습니다', () => {
    expect(run(createPlayer(), key({ accel: true }), 10).speed).toBe(MAX_SPEED);
  });

  it('키를 누르지 않으면 서서히 감속합니다', () => {
    expect(run(make({ speed: MAX_SPEED }), idle, 1).speed).toBeCloseTo(MAX_SPEED * 0.8, 5);
  });

  it('브레이크는 자연 감속보다 빠르게 속도를 줄입니다', () => {
    expect(run(make({ speed: MAX_SPEED }), key({ brake: true }), 0.5).speed).toBeCloseTo(MAX_SPEED / 2, 5);
  });

  it('가속과 브레이크를 함께 누르면 브레이크가 우선합니다', () => {
    const p = run(make({ speed: MAX_SPEED }), key({ accel: true, brake: true }), 0.5);
    expect(p.speed).toBeCloseTo(MAX_SPEED / 2, 5);
  });

  it('속도는 0 아래로 내려가지 않습니다', () => {
    expect(run(make({ speed: 100 }), key({ brake: true }), 1).speed).toBe(0);
  });

  it('속도만큼 앞으로 이동합니다', () => {
    const p = updatePlayer(make({ speed: MAX_SPEED }), key({ accel: true }), 0, STEP, true);
    expect(p.z).toBeCloseTo(START_Z + MAX_SPEED * STEP, 5);
  });

  it('가속할 수 없는 상태에서는 가속 키를 눌러도 감속합니다', () => {
    const p = run(make({ speed: MAX_SPEED }), key({ accel: true }), 1, 0, false);
    expect(p.speed).toBeCloseTo(MAX_SPEED * 0.8, 5);
  });
});

describe('조향', () => {
  it('정지 상태에서는 좌우로 움직이지 않습니다', () => {
    expect(run(createPlayer(), key({ left: true }), 1).x).toBe(0);
  });

  it('조향 속도는 현재 속도에 비례합니다', () => {
    const fast = updatePlayer(make({ speed: MAX_SPEED }), key({ right: true }), 0, STEP, true);
    const slow = updatePlayer(make({ speed: MAX_SPEED / 2 }), key({ right: true }), 0, STEP, true);
    expect(fast.x).toBeCloseTo(STEP * 2, 8);
    expect(slow.x).toBeCloseTo(STEP, 8);
  });

  it('좌우를 함께 누르면 상쇄됩니다', () => {
    const p = updatePlayer(make({ speed: MAX_SPEED }), key({ left: true, right: true }), 0, STEP, true);
    expect(p.x).toBe(0);
  });

  it('오른쪽 커브에서는 왼쪽(바깥쪽)으로 밀립니다', () => {
    const p = updatePlayer(make({ speed: MAX_SPEED }), idle, 4, STEP, true);
    expect(p.x).toBeCloseTo(-STEP * 2, 8);
  });

  it('속도가 낮으면 커브에서 덜 밀립니다', () => {
    const fast = updatePlayer(make({ speed: MAX_SPEED }), idle, 4, STEP, true);
    const slow = updatePlayer(make({ speed: MAX_SPEED / 2 }), idle, 4, STEP, true);
    expect(Math.abs(slow.x)).toBeLessThan(Math.abs(fast.x));
  });

  it('좌우 위치는 도로 폭의 2배를 넘지 못합니다', () => {
    expect(run(make({ speed: MAX_SPEED, x: 1.99 }), key({ right: true, accel: true }), 1).x).toBe(2);
    expect(run(make({ speed: MAX_SPEED, x: -1.99 }), key({ left: true, accel: true }), 1).x).toBe(-2);
  });
});

describe('도로 이탈', () => {
  it('도로 밖에서는 가속 키를 눌러도 최고 속도의 1/4까지 줄어듭니다', () => {
    const p = run(make({ speed: MAX_SPEED, x: 1.5 }), key({ accel: true }), 3);
    expect(p.speed).toBe(OFFROAD_LIMIT);
  });

  it('도로 안에서는 감속하지 않습니다', () => {
    const p = run(make({ speed: MAX_SPEED, x: 0.9 }), key({ accel: true }), 1);
    expect(p.speed).toBe(MAX_SPEED);
  });
});

describe('니트로', () => {
  it('게이지가 30 미만이면 작동하지 않습니다', () => {
    const p = updatePlayer(make({ speed: MAX_SPEED, nitro: 29 }), key({ nitro: true }), 0, STEP, true);
    expect(p.nitroActive).toBe(false);
    expect(p.nitro).toBe(29);
  });

  it('게이지가 30 이상이면 작동하고 게이지가 줄어듭니다', () => {
    const p = updatePlayer(make({ speed: MAX_SPEED, nitro: 30 }), key({ nitro: true }), 0, STEP, true);
    expect(p.nitroActive).toBe(true);
    expect(p.nitro).toBeCloseTo(30 - NITRO_DRAIN * STEP, 8);
  });

  it('작동하는 동안 최고 속도를 넘어섭니다', () => {
    const p = run(make({ speed: MAX_SPEED, nitro: 100 }), key({ accel: true, nitro: true }), 1);
    expect(p.speed).toBeGreaterThan(MAX_SPEED);
    expect(p.speed).toBeLessThanOrEqual(MAX_SPEED * NITRO_BOOST);
  });

  it('키에서 손을 떼어도 게이지가 0이 될 때까지 유지됩니다', () => {
    const started = updatePlayer(make({ speed: MAX_SPEED, nitro: 100 }), key({ nitro: true }), 0, STEP, true);
    expect(run(started, key({ accel: true }), 1).nitroActive).toBe(true);
  });

  it('게이지가 0이 되면 종료되고 속도가 최고 속도로 돌아옵니다', () => {
    const p = run(make({ speed: MAX_SPEED, nitro: 100 }), key({ accel: true, nitro: true }), 5);
    expect(p.nitroActive).toBe(false);
    expect(p.nitro).toBe(0);
    expect(p.speed).toBe(MAX_SPEED);
  });

  it('가속할 수 없는 상태에서는 작동하지 않습니다', () => {
    const p = updatePlayer(make({ speed: MAX_SPEED, nitro: 100 }), key({ nitro: true }), 0, STEP, false);
    expect(p.nitroActive).toBe(false);
  });
});

describe('길가 사물', () => {
  it('좌우 간격이 좁은 사물이 있으면 충돌로 판정합니다', () => {
    expect(hitProp(make({ x: 1.5 }), [{ offset: 1.6, kind: 'palm' }])).toBe(true);
    expect(hitProp(make({ x: 1.5 }), [{ offset: 1.9, kind: 'palm' }])).toBe(false);
    expect(hitProp(make({ x: 1.5 }), [{ offset: -1.5, kind: 'palm' }])).toBe(false);
    expect(hitProp(make({ x: 1.5 }), [])).toBe(false);
  });

  it('crash는 속도를 지정한 값으로 줄이고 니트로를 종료합니다', () => {
    const p = crash(make({ speed: MAX_SPEED, nitro: 50, nitroActive: true }), 600);
    expect(p.speed).toBe(600);
    expect(p.nitroActive).toBe(false);
    expect(p.nitro).toBe(50);
  });
});
