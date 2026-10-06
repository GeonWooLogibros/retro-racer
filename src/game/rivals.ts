import {
  ACCEL,
  BOOST_ACCEL,
  CAR_HIT_WIDTH,
  CAR_LENGTH,
  DECEL,
  MAX_SPEED,
  NITRO_BOOST,
  RIVAL_AHEAD,
  RIVAL_BEHIND,
  RIVAL_BUMP_KEEP,
  RIVAL_CATCH_UP,
  RIVAL_CURVE_SLOW,
  RIVAL_WAIT,
  SEGMENT_LENGTH,
  SHARP_CURVE,
  START_Z,
} from './constants';
import { mulberry32 } from './random';
import { surfaceOf } from './terrain';
import { segmentAt } from './track';
import type { GameEvent, Player, Rival, Track } from './types';

export const RIVAL_NAMES = ['번개', '유성', '바람', '혜성', '질주'];
/** 출발선에서 라이벌이 서는 자리. 플레이어보다 앞선 거리와 좌우 위치입니다. */
const GRID = [
  { ahead: 1800, x: -0.5 },
  { ahead: 1400, x: 0.5 },
  { ahead: 1000, x: -0.5 },
  { ahead: 600, x: 0.5 },
  { ahead: 200, x: -0.5 },
];
const LATERAL_RATE = 1.2;
/** 부스터를 쓸지 정하는 구간 묶음의 길이와, 묶음마다 부스터를 쓸 확률. */
const BOOST_BLOCK = SEGMENT_LENGTH * 100;
const BOOST_CHANCE = 0.25;
const RIVAL_BOOST_TIME = 1.2;
/** 부딪힌 뒤 라이벌과 벌어지는 좌우 간격. */
const BUMP_PUSH = CAR_HIT_WIDTH + 0.1;

/** 맵 난이도가 높을수록 라이벌의 실력도 높습니다. 플레이어는 출발선 맨 뒤에서 시작합니다. */
export function createRivals(track: Track): Rival[] {
  const rand = mulberry32(track.map.seed * 31 + track.seed + 5);
  const base = 0.85 + (track.map.difficulty - 1) * 0.025;
  return GRID.map((slot, i) => ({
    name: RIVAL_NAMES[i],
    z: START_Z + slot.ahead,
    x: slot.x,
    speed: 0,
    skill: base + (GRID.length - 1 - i) * 0.012 + rand() * 0.01,
    color: i,
    boost: 0,
    boostBlock: -1,
    ahead: true,
  }));
}

/** 라이벌을 포함한 지금 순위. 나란히 달릴 때 순위가 깜빡이지 않도록, 앞뒤가 차 한 대 길이 이상 벌어져야 바뀝니다. */
export function rankOf(rivals: Rival[]): number {
  return 1 + rivals.filter((rival) => rival.ahead).length;
}

/** 결승점에서의 순위. 실제 위치만으로 정합니다. */
export function finishRankOf(player: Player, rivals: Rival[]): number {
  return 1 + rivals.filter((rival) => rival.z > player.z).length;
}

/** 블록마다 정해진 난수로 부스터를 쓸지 정합니다. 같은 코스에서는 늘 같은 곳에서 씁니다. */
function boostRoll(seed: number, rival: number, block: number): number {
  return mulberry32(seed * 97 + rival * 7919 + block * 104729)();
}

export function updateRivals(
  rivals: Rival[],
  player: Player,
  track: Track,
  dt: number,
): { rivals: Rival[]; player: Player; events: GameEvent[] } {
  const events: GameEvent[] = [];
  const maxZ = track.length - SEGMENT_LENGTH;
  let p = player;

  const next = rivals.map((rival, i) => {
    const segment = segmentAt(track, rival.z);
    const surface = surfaceOf(segment);

    let { boost, boostBlock } = rival;
    boost = Math.max(0, boost - dt);
    const block = Math.floor(rival.z / BOOST_BLOCK);
    if (block !== boostBlock) {
      boostBlock = block;
      if (rival.speed > MAX_SPEED * 0.6 && boostRoll(track.seed + track.map.seed, i, block) < BOOST_CHANCE) {
        boost = RIVAL_BOOST_TIME;
      }
    }

    // 플레이어와 너무 멀어지면 따라잡거나 기다려서, 끝까지 순위 다툼이 이어지게 합니다.
    const gap = rival.z - p.z;
    const band = gap < -RIVAL_BEHIND ? RIVAL_CATCH_UP : gap > RIVAL_AHEAD ? RIVAL_WAIT : 1;
    const sharp = Math.abs(segment.curve) >= SHARP_CURVE ? RIVAL_CURVE_SLOW : 1;
    const target = MAX_SPEED * rival.skill * surface.speed * sharp * band * (boost > 0 ? NITRO_BOOST : 1);
    const accel = ACCEL * (boost > 0 ? BOOST_ACCEL : 1) * dt;
    const raw =
      rival.speed < target ? Math.min(target, rival.speed + accel) : Math.max(target, rival.speed + 2 * DECEL * dt);
    const speed = Math.max(0, raw);

    // 커브에서는 안쪽으로, 직선에서는 원래 자리 쪽으로 천천히 움직입니다.
    const home = GRID[i % GRID.length].x * 0.6;
    const want = (Math.abs(segment.curve) >= 1 ? 0.45 * Math.sign(segment.curve) : home) * segment.width;
    const step = LATERAL_RATE * dt;
    const x = rival.x + Math.max(-step, Math.min(step, want - rival.x));

    const z = Math.min(maxZ, rival.z + speed * dt);

    // 라이벌의 뒤를 들이받으면 조금 느려지면서 옆으로 튕겨 나가서, 뒤에 갇히지 않게 합니다.
    const ahead = z - p.z;
    if (ahead >= 0 && ahead < CAR_LENGTH && Math.abs(p.x - x) < CAR_HIT_WIDTH && p.speed > speed) {
      // 밀려날 쪽에 도로가 모자라면 반대쪽으로 튕겨서, 다리나 우주의 길에서 떨어뜨리지 않습니다.
      const edge = segmentAt(track, p.z).width;
      const side = p.x >= x ? 1 : -1;
      const away = Math.abs(x + side * BUMP_PUSH) <= edge ? side : -side;
      p = {
        ...p,
        speed: Math.max(speed, p.speed * RIVAL_BUMP_KEEP),
        x: Math.max(-edge, Math.min(edge, x + away * BUMP_PUSH)),
        drifting: false,
        driftTime: 0,
      };
      events.push('bump');
    }

    let leading = rival.ahead;
    if (leading && z < p.z - CAR_LENGTH) leading = false;
    else if (!leading && z > p.z + CAR_LENGTH) leading = true;

    return { ...rival, z, x, speed, boost, boostBlock, ahead: leading };
  });

  return { rivals: next, player: p, events };
}
