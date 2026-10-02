import {
  CAR_COLOR_COUNT,
  CAR_HIT_WIDTH,
  CAR_LENGTH,
  MAX_SPEED,
  NEAR_MISS_WIDTH,
  NITRO_MAX,
  NITRO_NEAR_GAIN,
  NITRO_PASS_GAIN,
  SEGMENT_LENGTH,
  START_Z,
  TRAFFIC_ACTIVE_DISTANCE,
  TRAFFIC_SEED,
} from './constants';
import { mulberry32 } from './random';
import type { Car, GameEvent, Player, Track } from './types';

const LANE_OFFSETS = [-0.6, 0, 0.6];
const BASE_CARS = 28;
const CITY_CARS = 12;
const FIRST_CAR_GAP = SEGMENT_LENGTH * 60;

export function createTraffic(track: Track, seed = TRAFFIC_SEED): Car[] {
  const rand = mulberry32(seed);
  const cars: Car[] = [];
  const add = (from: number, to: number, count: number): void => {
    for (let i = 0; i < count; i++) {
      cars.push({
        z: from + ((to - from) * (i + rand())) / count,
        offset: LANE_OFFSETS[Math.floor(rand() * LANE_OFFSETS.length)],
        speed: MAX_SPEED * (0.25 + rand() * 0.3),
        passed: false,
        color: Math.floor(rand() * CAR_COLOR_COUNT),
      });
    }
  };
  add(START_Z + FIRST_CAR_GAP, track.finishZ, BASE_CARS);
  add(track.checkpoints[2], track.checkpoints[3], CITY_CARS);
  return cars.sort((a, b) => a.z - b.z);
}

export function updateTraffic(
  cars: Car[],
  player: Player,
  track: Track,
  dt: number,
): { cars: Car[]; player: Player; events: GameEvent[] } {
  const events: GameEvent[] = [];
  const maxZ = track.length - SEGMENT_LENGTH;
  let p = player;

  const next = cars.map((car) => {
    let z = car.z;
    if (z - p.z < TRAFFIC_ACTIVE_DISTANCE) z = Math.min(maxZ, z + car.speed * dt);
    let passed = car.passed;
    const gap = Math.abs(p.x - car.offset);
    const ahead = z - p.z;

    if (ahead >= 0 && ahead < CAR_LENGTH && gap < CAR_HIT_WIDTH && p.speed > car.speed) {
      p = { ...p, speed: car.speed * 0.5, z: z - CAR_LENGTH, nitroActive: false };
      events.push('crash');
    } else if (!passed && ahead < 0) {
      passed = true;
      const near = gap < NEAR_MISS_WIDTH;
      const gain = near ? NITRO_NEAR_GAIN : NITRO_PASS_GAIN;
      p = { ...p, nitro: Math.min(NITRO_MAX, p.nitro + gain) };
      events.push(near ? 'nearMiss' : 'pass');
    }

    return z === car.z && passed === car.passed ? car : { ...car, z, passed };
  });

  return { cars: next, player: p, events };
}
