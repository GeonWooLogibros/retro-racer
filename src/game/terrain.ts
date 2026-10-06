import type { Segment, Terrain, TerrainKind } from './types';

/** 차량이 달리는 바닥의 성질. */
export interface Surface {
  /** 도로 반폭. 좌우 위치의 절댓값이 이보다 크면 도로 밖입니다. */
  width: number;
  /** 커브가 차량을 바깥으로 미는 힘의 배율. */
  push: number;
  /** 최고 속도의 배율. */
  speed: number;
  /** 도로 밖이 낭떠러지여서, 벗어나면 떨어지는지 여부. */
  falls: boolean;
}

const RULES: Record<TerrainKind, Omit<Surface, 'width'>> = {
  road: { push: 1, speed: 1, falls: false },
  dirt: { push: 1.25, speed: 0.95, falls: false },
  bridge: { push: 1, speed: 1, falls: true },
  ford: { push: 1, speed: 0.75, falls: false },
  ice: { push: 1.5, speed: 1, falls: false },
  space: { push: 0.8, speed: 1.1, falls: true },
};

/** 도로 끝에서 이만큼 더 나가면 떨어집니다. */
export const FALL_MARGIN = 0.15;

export const TERRAINS = {
  road2: { kind: 'road', lanes: 2, width: 0.8 },
  road3: { kind: 'road', lanes: 3, width: 1 },
  road4: { kind: 'road', lanes: 4, width: 1.25 },
  dirt: { kind: 'dirt', lanes: 0, width: 0.9 },
  bridge: { kind: 'bridge', lanes: 0, width: 0.6 },
  ford: { kind: 'ford', lanes: 0, width: 1 },
  ice: { kind: 'ice', lanes: 3, width: 1 },
  space: { kind: 'space', lanes: 2, width: 0.85 },
} satisfies Record<string, Terrain>;

export const DEFAULT_SURFACE: Surface = { width: 1, ...RULES.road };

export function surfaceOf(segment: Segment): Surface {
  return { width: segment.width, ...RULES[segment.terrain.kind] };
}
