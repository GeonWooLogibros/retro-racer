import { SEGMENT_LENGTH } from './constants';
import type { Track } from './types';

export interface MapPoint {
  x: number;
  y: number;
}

export interface Minimap {
  /** 위에서 내려다본 코스. 좌표는 0과 1 사이이고, 출발 방향이 위쪽입니다. */
  points: MapPoint[];
  /** 인접한 두 점 사이의 코스 거리. */
  spacing: number;
}

const SAMPLE_SEGMENTS = 10;
/** 코스 전체에서 진행 방향이 바뀌는 폭(라디안). 커브가 미니맵에서 뚜렷하게 보이도록 넓게 잡습니다. */
const TURN_SPAN = 5;

/** 출발점부터 결승점까지의 코스 모양을 만듭니다. */
export function buildMinimap(track: Track): Minimap {
  const spacing = SEGMENT_LENGTH * SAMPLE_SEGMENTS;
  const count = Math.floor(track.finishZ / spacing);
  const headings: number[] = [];
  for (let i = 0; i < count; i++) headings.push(track.segments[i * SAMPLE_SEGMENTS].heading);

  const range = Math.max(...headings) - Math.min(...headings);
  const turn = range > 0 ? TURN_SPAN / range : 0;

  const raw: MapPoint[] = [{ x: 0, y: 0 }];
  for (const heading of headings) {
    const last = raw[raw.length - 1];
    const angle = (heading - headings[0]) * turn;
    raw.push({ x: last.x + Math.sin(angle), y: last.y - Math.cos(angle) });
  }

  const xs = raw.map((point) => point.x);
  const ys = raw.map((point) => point.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const width = Math.max(...xs) - minX;
  const height = Math.max(...ys) - minY;
  const size = Math.max(width, height);

  // 결승점이 표본 간격보다 가까운 코스에서는 점이 하나뿐이므로 가운데에 둡니다.
  if (size === 0) return { points: [{ x: 0.5, y: 0.5 }], spacing };

  const points = raw.map((point) => ({
    x: (point.x - minX + (size - width) / 2) / size,
    y: (point.y - minY + (size - height) / 2) / size,
  }));
  return { points, spacing };
}

/** 코스 위치 z에 해당하는 미니맵 좌표를 반환합니다. */
export function minimapAt(map: Minimap, z: number): MapPoint {
  const last = map.points.length - 1;
  if (last === 0) return map.points[0];
  const raw = Number.isFinite(z) ? z / map.spacing : 0;
  const at = Math.min(last, Math.max(0, raw));
  const index = Math.min(last - 1, Math.floor(at));
  const t = at - index;
  const a = map.points[index];
  const b = map.points[index + 1];
  if (t === 0) return a;
  if (t === 1) return b;
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
