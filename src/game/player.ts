import {
  ACCEL,
  BRAKE,
  CENTRIFUGAL,
  DECEL,
  MAX_SPEED,
  MAX_X,
  NITRO_BOOST,
  NITRO_DRAIN,
  NITRO_MIN,
  OFFROAD_DECEL,
  OFFROAD_LIMIT,
  PROP_HIT_WIDTH,
  START_Z,
  STEER_RATE,
} from './constants';
import type { Input, Player, Prop } from './types';

export function createPlayer(): Player {
  return { z: START_Z, x: 0, speed: 0, nitro: 0, nitroActive: false };
}

export function updatePlayer(
  p: Player,
  input: Input,
  curve: number,
  dt: number,
  canAccelerate: boolean,
): Player {
  let { x, speed, nitro } = p;
  let nitroActive = p.nitroActive && canAccelerate;
  if (!nitroActive && input.nitro && canAccelerate && nitro >= NITRO_MIN) nitroActive = true;

  const boost = nitroActive ? NITRO_BOOST : 1;
  const maxSpeed = MAX_SPEED * boost;
  const ratio = p.speed / MAX_SPEED;
  const dx = dt * STEER_RATE * ratio;

  if (input.left) x -= dx;
  if (input.right) x += dx;
  x -= dx * ratio * curve * CENTRIFUGAL;

  if (input.brake) speed += BRAKE * dt;
  else if (input.accel && canAccelerate) speed += ACCEL * boost * dt;
  else speed += DECEL * dt;

  if (Math.abs(x) > 1 && speed > OFFROAD_LIMIT) {
    speed = Math.max(OFFROAD_LIMIT, speed + OFFROAD_DECEL * dt);
  }
  // 니트로가 끝난 직후처럼 최고 속도를 넘은 상태에서는 급격히 자르지 않고 서서히 낮춥니다.
  if (speed > maxSpeed) speed = Math.min(speed, Math.max(maxSpeed, p.speed + 2 * DECEL * dt));

  speed = Math.max(0, speed);
  x = Math.min(MAX_X, Math.max(-MAX_X, x));

  if (nitroActive) {
    nitro -= NITRO_DRAIN * dt;
    if (nitro <= 0) {
      nitro = 0;
      nitroActive = false;
    }
  }

  return { z: p.z + speed * dt, x, speed, nitro, nitroActive };
}

export function hitProp(p: Player, props: Prop[]): boolean {
  return props.some((prop) => Math.abs(p.x - prop.offset) < PROP_HIT_WIDTH);
}

export function crash(p: Player, speed: number): Player {
  return { ...p, speed, nitroActive: false };
}
