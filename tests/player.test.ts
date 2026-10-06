import { describe, expect, it } from 'vitest';
import {
  COUNTER_TIME,
  DRIFT_GAUGE_RATE,
  DRIFT_SPEED_CAP,
  MAX_SPEED,
  NITRO_BOOST,
  NITRO_DURATION,
  OFFROAD_LIMIT,
  START_Z,
  STEP,
  TURBO_BOOST,
  TURBO_LEVEL_GAUGE,
  TURBO_TIMES,
} from '../src/game/constants';
import { chargeGauge, crash, createPlayer, driftLevel, hitProp, updatePlayer } from '../src/game/player';
import { DEFAULT_SURFACE, type Surface } from '../src/game/terrain';
import type { Input, Player } from '../src/game/types';

const idle: Input = {
  left: false,
  right: false,
  accel: false,
  brake: false,
  nitro: false,
  drift: false,
};
const key = (over: Partial<Input>): Input => ({ ...idle, ...over });
const make = (over: Partial<Player>): Player => ({
  ...createPlayer(),
  ...over,
});

function run(p: Player, input: Input, seconds: number, curve = 0, canAccelerate = true): Player {
  let player = p;
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    player = updatePlayer(player, input, curve, STEP, canAccelerate);
  }
  return player;
}

describe('createPlayer', () => {
  it('출발 위치에서 정지한 상태로, 부스터 없이 시작합니다', () => {
    const p = createPlayer();
    expect(p).toMatchObject({ z: START_Z, x: 0, speed: 0, gauge: 0, boosters: 0, nitroActive: false, turbo: 0 });
    expect(p.drifting).toBe(false);
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

describe('부스터 게이지', () => {
  it('게이지가 가득 차면 부스터 한 칸이 되고 남은 만큼 다시 찹니다', () => {
    const p = chargeGauge(make({ gauge: 90 }), 25);
    expect(p.boosters).toBe(1);
    expect(p.gauge).toBeCloseTo(15, 9);
  });

  it('부스터는 두 칸까지 모이고, 그 뒤로는 게이지가 가득 찬 채로 남습니다', () => {
    const p = chargeGauge(make({ gauge: 0 }), 450);
    expect(p.boosters).toBe(2);
    expect(p.gauge).toBe(100);
  });
});

describe('부스터', () => {
  it('부스터가 없으면 키를 눌러도 켜지지 않습니다', () => {
    expect(updatePlayer(make({ speed: MAX_SPEED }), key({ nitro: true }), 0, STEP, true).nitroActive).toBe(false);
  });

  it('키를 누르면 한 칸을 써서 정해진 시간 동안 켜집니다', () => {
    const p = updatePlayer(make({ speed: MAX_SPEED, boosters: 2 }), key({ nitro: true }), 0, STEP, true);
    expect(p.nitroActive).toBe(true);
    expect(p.boosters).toBe(1);
    expect(p.nitroTime).toBe(NITRO_DURATION);
  });

  it('키를 계속 누르고 있어도 한 칸만 씁니다', () => {
    let p = make({ speed: MAX_SPEED, boosters: 2 });
    for (let i = 0; i < Math.round((NITRO_DURATION + 0.5) * 60); i++)
      p = updatePlayer(p, key({ nitro: true }), 0, STEP, true);
    expect(p.boosters).toBe(1);
    expect(p.nitroActive).toBe(false);
  });

  it('켜져 있는 동안 가속 키를 떼도 최고 속도를 넘어 달립니다', () => {
    const started = updatePlayer(make({ speed: MAX_SPEED, boosters: 1 }), key({ nitro: true }), 0, STEP, true);
    const p = run(started, idle, 1);
    expect(p.speed).toBeGreaterThan(MAX_SPEED);
    expect(p.speed).toBeLessThanOrEqual(MAX_SPEED * NITRO_BOOST);
  });

  it('시간이 지나면 꺼지고 속도가 최고 속도로 돌아옵니다', () => {
    const started = updatePlayer(make({ speed: MAX_SPEED, boosters: 1 }), key({ nitro: true }), 0, STEP, true);
    const p = run(started, key({ accel: true }), NITRO_DURATION + 2);
    expect(p.nitroActive).toBe(false);
    expect(p.speed).toBe(MAX_SPEED);
  });

  it('가속할 수 없는 상태에서는 켜지지 않습니다', () => {
    const p = updatePlayer(make({ speed: MAX_SPEED, boosters: 1 }), key({ nitro: true }), 0, STEP, false);
    expect(p.nitroActive).toBe(false);
    expect(p.boosters).toBe(1);
  });
});

describe('드리프트', () => {
  const slide = key({ drift: true, right: true, accel: true });
  /** 도로 밖으로 나가지 않도록 좌우 위치를 가운데로 고정한 채 드리프트합니다. */
  const hold = (p: Player, seconds: number, input = slide): Player => {
    let next = p;
    for (let i = 0; i < Math.round(seconds * 60); i++) next = updatePlayer({ ...next, x: 0 }, input, 0, STEP, true);
    return next;
  };

  it('드리프트 키를 누른 채 조향하면 드리프트가 되고 조향이 1.6배 강해집니다', () => {
    const p = updatePlayer(make({ speed: MAX_SPEED }), slide, 0, STEP, true);
    expect(p.drifting).toBe(true);
    expect(p.driftDir).toBe(1);
    expect(p.x).toBeCloseTo(STEP * 2 * 1.6, 8);
  });

  it('조향하지 않거나 좌우를 함께 누르면 드리프트가 되지 않습니다', () => {
    expect(updatePlayer(make({ speed: MAX_SPEED }), key({ drift: true }), 0, STEP, true).drifting).toBe(false);
    const both = key({ drift: true, left: true, right: true });
    expect(updatePlayer(make({ speed: MAX_SPEED }), both, 0, STEP, true).drifting).toBe(false);
  });

  it('속도가 최고 속도의 절반보다 낮으면 드리프트가 되지 않습니다', () => {
    expect(updatePlayer(make({ speed: MAX_SPEED * 0.4 }), slide, 0, STEP, true).drifting).toBe(false);
  });

  it('드리프트 중에는 커브에서 덜 밀립니다', () => {
    const p = updatePlayer(make({ speed: MAX_SPEED }), slide, 4, STEP, true);
    expect(p.x).toBeCloseTo(STEP * 2 * (1.6 - 0.6), 8);
  });

  it('드리프트를 유지하면 속도가 최고 속도의 85%까지 줄어듭니다', () => {
    expect(hold(make({ speed: MAX_SPEED }), 0.5).speed).toBeCloseTo(MAX_SPEED * DRIFT_SPEED_CAP, 5);
  });

  it('드리프트하는 동안 부스터 게이지가 찹니다', () => {
    expect(hold(make({ speed: MAX_SPEED }), 1).gauge).toBeCloseTo(DRIFT_GAUGE_RATE, 1);
  });

  it('유지한 시간에 따라 터보 단계가 0부터 3까지 오릅니다', () => {
    expect([0, 0.49, 0.5, 1.1, 1.8, 9].map(driftLevel)).toEqual([0, 0, 1, 2, 3, 3]);
  });

  it('드리프트를 끝내면 단계만큼 터보가 붙고, 속도가 바로 최고 속도로 돌아옵니다', () => {
    const held = hold(make({ speed: MAX_SPEED }), 1.3);
    expect(held.speed).toBeLessThan(MAX_SPEED);
    const released = updatePlayer(held, key({ accel: true }), 0, STEP, true);
    expect(released.drifting).toBe(false);
    expect(released.turbo).toBe(TURBO_TIMES[1]);
    expect(released.speed).toBeGreaterThanOrEqual(MAX_SPEED);
    expect(released.gauge).toBeCloseTo(held.gauge + 2 * TURBO_LEVEL_GAUGE, 5);
  });

  it('터보가 붙어 있는 동안 최고 속도를 조금 넘어섭니다', () => {
    const released = updatePlayer(hold(make({ speed: MAX_SPEED }), 2), key({ accel: true }), 0, STEP, true);
    const p = run(released, key({ accel: true }), 0.5);
    expect(p.speed).toBeGreaterThan(MAX_SPEED);
    expect(p.speed).toBeLessThanOrEqual(MAX_SPEED * TURBO_BOOST + 1e-6);
  });

  it('앞선 터보가 남아 있을 때 다시 터보를 받으면 이어 붙습니다', () => {
    const held = hold(make({ speed: MAX_SPEED, turbo: 0.2 }), 0.6);
    const released = updatePlayer(held, key({ accel: true }), 0, STEP, true);
    expect(released.turbo).toBeCloseTo(Math.max(0, 0.2 - 0.6) + TURBO_TIMES[0], 9);
  });

  it('시간이 끝났으면 순간 부스터가 붙지 않습니다', () => {
    const released = updatePlayer(hold(make({ speed: MAX_SPEED }), 0.6), key({ accel: true }), 0, STEP, true);
    expect(updatePlayer(released, key({ left: true }), 0, STEP, false).turbo).toBe(0);
  });

  it('짧게 끝낸 드리프트에는 터보가 붙지 않습니다', () => {
    const released = updatePlayer(hold(make({ speed: MAX_SPEED }), 0.3), key({ accel: true }), 0, STEP, true);
    expect(released.turbo).toBe(0);
  });

  it('드리프트를 끝낸 직후 반대 방향키를 누르면 순간 부스터가 붙습니다', () => {
    const released = updatePlayer(hold(make({ speed: MAX_SPEED }), 0.6), key({ accel: true }), 0, STEP, true);
    const counter = updatePlayer(released, key({ accel: true, left: true }), 0, STEP, true);
    expect(counter.turbo).toBeCloseTo(released.turbo - STEP + COUNTER_TIME, 9);
    expect(counter.counterWindow).toBe(0);
  });

  it('같은 방향키를 누르거나 너무 늦게 누르면 순간 부스터가 붙지 않습니다', () => {
    const released = updatePlayer(hold(make({ speed: MAX_SPEED }), 0.6), key({ accel: true }), 0, STEP, true);
    const same = updatePlayer(released, key({ accel: true, right: true }), 0, STEP, true);
    expect(same.turbo).toBeLessThan(released.turbo);
    const late = run(released, key({ accel: true }), 0.4);
    expect(updatePlayer(late, key({ accel: true, left: true }), 0, STEP, true).turbo).toBe(0);
  });

  it('도로 밖으로 나가면 터보 없이 끝납니다', () => {
    const held = hold(make({ speed: MAX_SPEED }), 1);
    const out = updatePlayer({ ...held, x: 1.2 }, slide, 0, STEP, true);
    expect(out.drifting).toBe(false);
    expect(out.turbo).toBe(0);
  });

  it('충돌하면 드리프트와 터보가 끝나고, 모아 둔 부스터와 게이지는 남습니다', () => {
    const p = crash(make({ speed: MAX_SPEED, drifting: true, driftTime: 1, turbo: 0.5, boosters: 1, gauge: 40 }), 600);
    expect(p).toMatchObject({ speed: 600, drifting: false, driftTime: 0, turbo: 0, boosters: 1, gauge: 40 });
  });
});

describe('지형', () => {
  const surface = (over: Partial<Surface>): Surface => ({
    ...DEFAULT_SURFACE,
    ...over,
  });
  const on = (p: Player, input: Input, s: Surface, curve = 0): Player => updatePlayer(p, input, curve, STEP, true, s);

  it('미끄러운 지형에서는 커브에서 더 많이 밀립니다', () => {
    const p = on(make({ speed: MAX_SPEED }), idle, surface({ push: 1.5 }), 4);
    expect(p.x).toBeCloseTo(-STEP * 2 * 1.5, 8);
  });

  it('최고 속도가 낮은 지형에서는 그 속도까지 서서히 줄어듭니다', () => {
    let p = make({ speed: MAX_SPEED });
    for (let i = 0; i < 120; i++) p = on(p, key({ accel: true }), surface({ speed: 0.75 }));
    expect(p.speed).toBeCloseTo(MAX_SPEED * 0.75, 5);
  });

  it('최고 속도가 높은 지형에서는 그만큼 더 빨라집니다', () => {
    let p = make({ speed: MAX_SPEED });
    for (let i = 0; i < 120; i++) p = on(p, key({ accel: true }), surface({ speed: 1.1 }));
    expect(p.speed).toBeCloseTo(MAX_SPEED * 1.1, 5);
  });

  it('도로가 좁으면 그 폭을 넘는 곳부터 도로 밖입니다', () => {
    let p = make({ speed: MAX_SPEED, x: 0.7 });
    for (let i = 0; i < 180; i++) p = on(p, key({ accel: true }), surface({ width: 0.6 }));
    expect(p.speed).toBe(OFFROAD_LIMIT);
    const inside = on(make({ speed: MAX_SPEED, x: 0.5 }), key({ accel: true }), surface({ width: 0.6 }));
    expect(inside.speed).toBe(MAX_SPEED);
  });

  it('도로가 넓으면 그 폭 안에서는 감속하지 않고 드리프트도 됩니다', () => {
    const wide = surface({ width: 1.25 });
    const p = on(make({ speed: MAX_SPEED, x: 1.1 }), key({ accel: true, drift: true, left: true }), wide);
    expect(p.drifting).toBe(true);
    expect(on(make({ speed: MAX_SPEED, x: 1.1 }), key({ accel: true }), wide).speed).toBe(MAX_SPEED);
  });
});

describe('길가 사물', () => {
  it('좌우 간격이 좁은 사물이 있으면 충돌로 판정합니다', () => {
    expect(hitProp(make({ x: 1.5 }), [{ offset: 1.6, kind: 'palm' }])).toBe(true);
    expect(hitProp(make({ x: 1.5 }), [{ offset: 1.9, kind: 'palm' }])).toBe(false);
    expect(hitProp(make({ x: 1.5 }), [{ offset: -1.5, kind: 'palm' }])).toBe(false);
    expect(hitProp(make({ x: 1.5 }), [])).toBe(false);
  });

  it('crash는 속도를 지정한 값으로 줄이고 부스터를 끕니다', () => {
    const p = crash(make({ speed: MAX_SPEED, nitroActive: true, nitroTime: 1 }), 600);
    expect(p.speed).toBe(600);
    expect(p.nitroActive).toBe(false);
    expect(p.nitroTime).toBe(0);
  });
});
