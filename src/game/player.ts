import {
  ACCEL,
  BOOST_ACCEL,
  BOOSTER_SLOTS,
  BRAKE,
  CENTRIFUGAL,
  COUNTER_TIME,
  COUNTER_WINDOW,
  DECEL,
  DRIFT_GAUGE_RATE,
  DRIFT_GRIP,
  DRIFT_MIN_SPEED,
  DRIFT_SPEED_CAP,
  DRIFT_STEER,
  GAUGE_MAX,
  MAX_SPEED,
  MAX_X,
  NITRO_BOOST,
  NITRO_DURATION,
  OFFROAD_DECEL,
  OFFROAD_LIMIT,
  PROP_HIT_WIDTH,
  START_Z,
  STEER_RATE,
  TURBO_BOOST,
  TURBO_LEVEL_GAUGE,
  TURBO_LEVEL_TIMES,
  TURBO_TIMES,
} from './constants';
import { DEFAULT_SURFACE, type Surface } from './terrain';
import type { Input, Player, Prop } from './types';

export function createPlayer(): Player {
  return {
    z: START_Z,
    x: 0,
    speed: 0,
    gauge: 0,
    boosters: 0,
    nitroActive: false,
    nitroTime: 0,
    nitroHeld: false,
    drifting: false,
    driftTime: 0,
    driftDir: 0,
    turbo: 0,
    counterWindow: 0,
  };
}

/** 드리프트를 유지한 시간에 따른 터보 단계(0~3). */
export function driftLevel(driftTime: number): number {
  return TURBO_LEVEL_TIMES.filter((time) => driftTime >= time).length;
}

/** 부스터 게이지를 채웁니다. 가득 차면 부스터 한 칸으로 바꾸고, 칸이 모두 차 있으면 게이지만 가득 찬 채로 둡니다. */
export function chargeGauge(p: Player, amount: number): Player {
  let gauge = p.gauge + amount;
  let boosters = p.boosters;
  while (gauge >= GAUGE_MAX && boosters < BOOSTER_SLOTS) {
    gauge -= GAUGE_MAX;
    boosters++;
  }
  if (boosters >= BOOSTER_SLOTS) gauge = Math.min(gauge, GAUGE_MAX);
  return { ...p, gauge, boosters };
}

export function updatePlayer(
  p: Player,
  input: Input,
  curve: number,
  dt: number,
  canAccelerate: boolean,
  surface: Surface = DEFAULT_SURFACE,
): Player {
  let { x, speed, boosters } = p;

  // 부스터는 키를 누르는 순간에 한 칸을 써서, 정해진 시간 동안 켜집니다.
  let nitroTime = canAccelerate ? Math.max(0, p.nitroTime - dt) : 0;
  if (input.nitro && !p.nitroHeld && canAccelerate && boosters > 0 && nitroTime === 0) {
    boosters--;
    nitroTime = NITRO_DURATION;
  }
  const nitroActive = nitroTime > 0;

  const onRoad = Math.abs(p.x) <= surface.width;
  const steerDir = input.left === input.right ? 0 : input.right ? 1 : -1;
  const drifting = input.drift && steerDir !== 0 && p.speed >= DRIFT_MIN_SPEED && onRoad;
  const driftTime = drifting ? p.driftTime + dt : 0;
  const driftDir = drifting ? steerDir : p.driftDir;
  let turbo = canAccelerate ? Math.max(0, p.turbo - dt) : 0;
  let counterWindow = Math.max(0, p.counterWindow - dt);
  let gaugeGain = drifting ? DRIFT_GAUGE_RATE * dt : 0;

  if (!drifting && p.drifting && onRoad && canAccelerate) {
    // 드리프트를 끝내는 순간, 유지한 시간에 따른 단계만큼 터보가 붙습니다.
    const level = driftLevel(p.driftTime);
    if (level > 0) {
      // 앞선 터보가 남아 있으면 그 위에 더해서, 터보를 이어 붙일수록 길어집니다.
      turbo += TURBO_TIMES[level - 1];
      counterWindow = COUNTER_WINDOW;
      gaugeGain += level * TURBO_LEVEL_GAUGE;
      speed = Math.max(speed, MAX_SPEED * surface.speed);
    }
  } else if (
    !drifting &&
    p.counterWindow > 0 &&
    canAccelerate &&
    onRoad &&
    steerDir !== 0 &&
    steerDir === -p.driftDir
  ) {
    // 드리프트를 끝낸 직후 반대 방향키를 누르면 순간 부스터가 붙습니다.
    turbo += COUNTER_TIME;
    counterWindow = 0;
  }

  const boosting = nitroActive || turbo > 0;
  const boost = Math.max(nitroActive ? NITRO_BOOST : 1, turbo > 0 ? TURBO_BOOST : 1);
  const maxSpeed = MAX_SPEED * boost * surface.speed * (drifting ? DRIFT_SPEED_CAP : 1);
  const ratio = p.speed / MAX_SPEED;
  const dx = dt * STEER_RATE * ratio;
  const steer = drifting ? dx * DRIFT_STEER : dx;

  if (input.left) x -= steer;
  if (input.right) x += steer;
  x -= dx * ratio * curve * CENTRIFUGAL * surface.push * (drifting ? DRIFT_GRIP : 1);

  if (input.brake) speed += BRAKE * dt;
  else if (boosting) speed += ACCEL * boost * BOOST_ACCEL * dt;
  else if (input.accel && canAccelerate) speed += ACCEL * dt;
  else speed += DECEL * dt;

  if (Math.abs(x) > surface.width && speed > OFFROAD_LIMIT) {
    speed = Math.max(OFFROAD_LIMIT, speed + OFFROAD_DECEL * dt);
  }
  // 부스터가 끝난 직후처럼 최고 속도를 넘은 상태에서는 급격히 자르지 않고 서서히 낮춥니다.
  if (speed > maxSpeed) speed = Math.min(speed, Math.max(maxSpeed, p.speed + 2 * DECEL * dt));

  speed = Math.max(0, speed);
  x = Math.min(MAX_X, Math.max(-MAX_X, x));

  const next: Player = {
    z: p.z + speed * dt,
    x,
    speed,
    gauge: p.gauge,
    boosters,
    nitroActive,
    nitroTime,
    nitroHeld: input.nitro,
    drifting,
    driftTime,
    driftDir,
    turbo,
    counterWindow,
  };
  return gaugeGain > 0 ? chargeGauge(next, gaugeGain) : next;
}

export function hitProp(p: Player, props: Prop[]): boolean {
  return props.some((prop) => Math.abs(p.x - prop.offset) < PROP_HIT_WIDTH);
}

/** 부딪혔을 때 속도를 줄이고 부스터, 터보, 드리프트를 끝냅니다. 모아 둔 부스터와 게이지는 남습니다. */
export function crash(p: Player, speed: number): Player {
  return {
    ...p,
    speed,
    nitroActive: false,
    nitroTime: 0,
    drifting: false,
    driftTime: 0,
    turbo: 0,
    counterWindow: 0,
  };
}
