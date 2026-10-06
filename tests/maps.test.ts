import { describe, expect, it } from 'vitest';
import { MAX_SPEED, SEGMENT_LENGTH, STEP } from '../src/game/constants';
import { MAPS } from '../src/game/maps';
import { startRace, step } from '../src/game/step';
import { buildTrack } from '../src/game/track';
import type { GameState, Input, Track } from '../src/game/types';

const idle: Input = {
  left: false,
  right: false,
  accel: false,
  brake: false,
  nitro: false,
  drift: false,
};

/** 급커브에서는 드리프트하고, 그 밖에서는 도로 가운데를 지키며 달리는 단순한 주행. */
function drive(track: Track): GameState {
  let state: GameState = { ...startRace(track), rivals: [], rank: 1 };
  for (let i = 0; i < 400 * 60 && state.phase === 'racing'; i++) {
    const { x, z } = state.player;
    const { curve, width } = track.segments[Math.floor(z / SEGMENT_LENGTH)];
    const target = Math.abs(curve) >= 1 ? 0.4 * width * Math.sign(curve) : 0;
    const right = x < target - 0.05;
    const left = x > target + 0.05;
    const inward = (right && curve > 0) || (left && curve < 0);
    const input = {
      ...idle,
      accel: true,
      left,
      right,
      drift: Math.abs(curve) >= 4.5 && inward,
    };
    state = step(state, input, track, STEP);
  }
  return state;
}

describe('MAPS', () => {
  it('맵은 8개이고 id와 이름이 겹치지 않습니다', () => {
    expect(MAPS).toHaveLength(8);
    expect(new Set(MAPS.map((map) => map.id)).size).toBe(8);
    expect(new Set(MAPS.map((map) => map.name)).size).toBe(8);
  });

  it('첫 맵은 예전 기록이 넘어오는 선셋 코스트입니다', () => {
    expect(MAPS[0].id).toBe('sunset');
  });

  it('테마 이름은 모든 맵을 통틀어 겹치지 않습니다', () => {
    const names = MAPS.flatMap((map) => map.sections.map((section) => section.theme.name));
    expect(names).toHaveLength(40);
    expect(new Set(names).size).toBe(40);
  });

  it('난이도는 1부터 5까지이고, 가장 쉬운 맵과 가장 어려운 맵이 있습니다', () => {
    const levels = MAPS.map((map) => map.difficulty);
    for (const level of levels) expect([1, 2, 3, 4, 5]).toContain(level);
    expect(Math.min(...levels)).toBe(1);
    expect(Math.max(...levels)).toBe(5);
  });

  it('난이도가 높은 맵일수록 가장 급한 커브가 같거나 더 급합니다', () => {
    const sharpest = (index: number): number =>
      Math.max(...MAPS[index].sections.flatMap((section) => section.pieces.map((piece) => Math.abs(piece.curve))));
    const byLevel = MAPS.map((map, index) => ({
      level: map.difficulty,
      curve: sharpest(index),
    })).sort((a, b) => a.level - b.level);
    for (let i = 1; i < byLevel.length; i++) expect(byLevel[i].curve).toBeGreaterThanOrEqual(byLevel[i - 1].curve);
  });
});

describe.each(MAPS.map((map) => [map.name, map] as const))('%s', (_name, map) => {
  const track = buildTrack(map);

  it('구간은 5개이고, 구간마다 조각 길이의 합이 1800입니다', () => {
    expect(map.sections).toHaveLength(5);
    for (const section of map.sections) {
      expect(section.pieces.reduce((sum, piece) => sum + piece.length, 0)).toBe(1800);
      expect(section.props.length).toBeGreaterThan(0);
    }
  });

  it('체크포인트 4개와 결승점의 위치가 모든 맵에서 같습니다', () => {
    expect(track.checkpoints).toEqual([360000, 720000, 1080000, 1440000]);
    expect(track.finishZ).toBe(1800000);
    expect(track.finishZ / MAX_SPEED).toBe(150);
  });

  it('코스가 자신의 맵과 구간별 테마를 가집니다', () => {
    expect(track.map).toBe(map);
    expect(track.themes).toEqual(map.sections.map((section) => section.theme));
  });

  it('길가 사물은 그 구간에 지정된 종류이고 모두 도로 밖에 있습니다', () => {
    for (const segment of track.segments) {
      for (const prop of segment.props) {
        expect(map.sections[segment.section].props).toContain(prop.kind);
        expect(Math.abs(prop.offset)).toBeGreaterThan(1);
      }
    }
  });

  it('폭이 넓은 사물은 급커브에서도 도로에서 멀리 떨어져 있습니다', () => {
    for (const segment of track.segments) {
      for (const prop of segment.props) {
        if (['building', 'mesa', 'dome'].includes(prop.kind)) {
          expect(Math.abs(prop.offset)).toBeGreaterThanOrEqual(2.6);
        }
      }
    }
  });

  it('급커브에서 드리프트하며 달리면 다른 차량이 없을 때 제한 시간 안에 완주합니다', () => {
    expect(drive(track).phase).toBe('finished');
  });

  it.each([1, 2, 3, 4, 5])('조각을 섞은 코스(시드 %i)도 같은 방식으로 완주합니다', (seed) => {
    const shuffled = buildTrack(map, seed);
    expect(shuffled.checkpoints).toEqual(track.checkpoints);
    expect(drive(shuffled).phase).toBe('finished');
  });

  it('길가 사물은 도로 폭이 넓은 곳에서도 도로 밖에 있습니다', () => {
    for (const segment of track.segments) {
      for (const prop of segment.props) expect(Math.abs(prop.offset)).toBeGreaterThan(segment.width + 0.25);
    }
  });
});

describe('스킨', () => {
  it('볼타 러너만 그림 에셋 스킨을 쓰고, 그림 사물은 그 맵에만 나옵니다', () => {
    for (const map of MAPS) {
      const kinds = map.sections.flatMap((section) => section.props);
      const usesArt = kinds.includes('pillar') || kinds.includes('arch');
      expect(map.skin === 'volta').toBe(map.id === 'volta');
      expect(usesArt).toBe(map.id === 'volta');
    }
  });
});

describe('여정', () => {
  const kinds = (map: (typeof MAPS)[number]): Set<string> =>
    new Set(map.sections.flatMap((section) => section.pieces.map((piece) => piece.terrain.kind)));

  it('모든 맵이 세 가지 이상의 지형을 지나고, 차선 수가 한 가지로 고정되어 있지 않습니다', () => {
    for (const map of MAPS) {
      expect(kinds(map).size).toBeGreaterThanOrEqual(3);
      const lanes = new Set(map.sections.flatMap((section) => section.pieces.map((piece) => piece.terrain.lanes)));
      expect(lanes.size).toBeGreaterThanOrEqual(2);
    }
  });

  it('맵 전체를 통틀어 흙길, 다리, 여울, 빙판, 우주가 모두 나옵니다', () => {
    const all = new Set(MAPS.flatMap((map) => [...kinds(map)]));
    expect([...all].sort()).toEqual(['bridge', 'dirt', 'ford', 'ice', 'road', 'space']);
  });

  it('다리, 여울, 빙판, 우주 지형의 커브는 완만합니다', () => {
    const limit: Record<string, number> = {
      bridge: 2,
      ford: 2,
      ice: 3,
      space: 5,
    };
    for (const map of MAPS) {
      for (const piece of map.sections.flatMap((section) => section.pieces)) {
        const max = limit[piece.terrain.kind];
        if (max !== undefined) expect(Math.abs(piece.curve)).toBeLessThanOrEqual(max);
      }
    }
  });
});

describe('라이벌과의 균형', () => {
  /** drive와 같지만 라이벌과 함께 달리고, 직선에서 부스터를 씁니다. */
  function race(track: Track, useBoosters: boolean): GameState {
    let state: GameState = { ...startRace(track) };
    for (let i = 0; i < 400 * 60 && state.phase === 'racing'; i++) {
      const { x, z } = state.player;
      const { curve, width } = track.segments[Math.floor(z / SEGMENT_LENGTH)];
      const target = Math.abs(curve) >= 1 ? 0.4 * width * Math.sign(curve) : 0;
      const right = x < target - 0.05;
      const left = x > target + 0.05;
      const inward = (right && curve > 0) || (left && curve < 0);
      const boost = useBoosters && state.player.boosters > 0 && Math.abs(curve) < 2 && i % 2 === 0;
      const input = { ...idle, accel: true, left, right, drift: Math.abs(curve) >= 4.5 && inward, nitro: boost };
      state = step(state, input, track, STEP);
    }
    return state;
  }

  it('쉬운 맵에서 드리프트와 부스터를 잘 쓰면 3위 안에 듭니다', () => {
    const result = race(
      buildTrack(
        MAPS.find((map) => map.id === 'sakura')!,
        3,
      ),
      true,
    );
    expect(result.phase).toBe('finished');
    expect(result.rank).toBeLessThanOrEqual(3);
  });

  it('어려운 맵에서 부스터를 쓰지 않으면 1위가 어렵습니다', () => {
    const result = race(
      buildTrack(
        MAPS.find((map) => map.id === 'volcano')!,
        3,
      ),
      false,
    );
    expect(result.rank).toBeGreaterThan(1);
  });
});
