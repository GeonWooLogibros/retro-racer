import { describe, expect, it } from 'vitest';
import { SEGMENT_LENGTH, START_Z } from '../src/game/constants';
import { buildMinimap, minimapAt } from '../src/game/minimap';
import { buildTrack } from '../src/game/track';

const track = buildTrack();
const map = buildMinimap(track);

describe('buildMinimap', () => {
  it('출발점부터 결승점까지를 일정한 간격으로 표본화합니다', () => {
    expect(map.spacing).toBe(SEGMENT_LENGTH * 10);
    expect(map.points).toHaveLength(track.finishZ / map.spacing + 1);
  });

  it('모든 점이 0과 1 사이에 있고 긴 쪽이 영역을 가득 채웁니다', () => {
    const xs = map.points.map((p) => p.x);
    const ys = map.points.map((p) => p.y);
    for (const v of [...xs, ...ys]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
    const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    expect(span).toBeCloseTo(1, 6);
  });

  it('커브를 따라 좌우로 휘어집니다', () => {
    const xs = map.points.map((p) => p.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(0.2);
  });

  it('인접한 점 사이의 간격이 모두 같습니다', () => {
    const gap = (i: number): number =>
      Math.hypot(map.points[i].x - map.points[i - 1].x, map.points[i].y - map.points[i - 1].y);
    for (let i = 2; i < map.points.length; i++) expect(gap(i)).toBeCloseTo(gap(1), 8);
  });

  it('매번 같은 결과를 만듭니다', () => {
    expect(buildMinimap(track)).toEqual(map);
  });
});

describe('표본 간격보다 짧은 코스', () => {
  it('점 하나를 가운데에 두고, 어느 위치에서든 그 점을 반환합니다', () => {
    const short = buildMinimap({ ...track, finishZ: SEGMENT_LENGTH * 5 });
    expect(short.points).toEqual([{ x: 0.5, y: 0.5 }]);
    expect(minimapAt(short, 700)).toEqual({ x: 0.5, y: 0.5 });
  });
});

describe('minimapAt', () => {
  it('표본 위치에서는 해당 점을 반환합니다', () => {
    expect(minimapAt(map, 0)).toEqual(map.points[0]);
    expect(minimapAt(map, map.spacing * 7)).toEqual(map.points[7]);
  });

  it('표본 사이에서는 두 점을 보간합니다', () => {
    const p = minimapAt(map, map.spacing * 7.5);
    expect(p.x).toBeCloseTo((map.points[7].x + map.points[8].x) / 2, 8);
    expect(p.y).toBeCloseTo((map.points[7].y + map.points[8].y) / 2, 8);
  });

  it('범위를 벗어난 위치는 양 끝 점으로 제한합니다', () => {
    const last = map.points[map.points.length - 1];
    expect(minimapAt(map, -START_Z)).toEqual(map.points[0]);
    expect(minimapAt(map, track.length + 5000)).toEqual(last);
    expect(minimapAt(map, Number.NaN)).toEqual(map.points[0]);
  });
});
