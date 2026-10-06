import {
  CAMERA_HEIGHT,
  DRAW_DISTANCE,
  HEIGHT,
  ROAD_WIDTH,
  RUMBLE_LENGTH,
  SEGMENT_LENGTH,
  WIDTH,
} from '../game/constants';
import { SPACE_THEME, css, lerpColor, liquidOf, shade } from '../game/themes';
import { heightAt, segmentAt } from '../game/track';
import type { Color, Player, Segment, TerrainKind, Theme, Track } from '../game/types';
import { BASE_CAMERA, type Camera } from './camera';
import { project, type Projected } from './projection';

export interface VisibleSegment {
  segment: Segment;
  p1: Projected;
  p2: Projected;
  /** 이 구간의 사물을 그릴 때 이 높이보다 아래쪽은 잘라냅니다. */
  clip: number;
  fog: number;
  drawn: boolean;
}

const MAX_FOG = 0.9;

export function computeVisible(track: Track, player: Player, camera: Camera = BASE_CAMERA): VisibleSegment[] {
  const cameraZ = player.z - camera.distance;
  const base = segmentAt(track, cameraZ);
  const basePercent = Math.min(1, Math.max(0, (cameraZ - base.index * SEGMENT_LENGTH) / SEGMENT_LENGTH));
  const cameraY = heightAt(track, player.z) + CAMERA_HEIGHT;
  const cameraX = player.x * ROAD_WIDTH;

  const visible: VisibleSegment[] = [];
  let x = 0;
  let dx = -base.curve * basePercent;
  let maxY = HEIGHT;

  for (let n = 0; n < DRAW_DISTANCE; n++) {
    const segment = track.segments[base.index + n];
    if (!segment) break;
    const z1 = segment.index * SEGMENT_LENGTH;
    const shift = x;
    x += dx;
    dx += segment.curve;
    if (z1 <= cameraZ) continue;

    const p1 = project(0, segment.y1, z1, cameraX - shift, cameraY, cameraZ, camera.depth);
    const p2 = project(0, segment.y2, z1 + SEGMENT_LENGTH, cameraX - x, cameraY, cameraZ, camera.depth);
    const drawn = p2.y < p1.y && p2.y < maxY;
    visible.push({
      segment,
      p1,
      p2,
      clip: maxY,
      fog: Math.pow(n / DRAW_DISTANCE, 3) * MAX_FOG,
      drawn,
    });
    if (drawn) maxY = p2.y;
  }
  return visible;
}

function quad(
  ctx: CanvasRenderingContext2D,
  color: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  x4: number,
  y4: number,
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineTo(x3, y3);
  ctx.lineTo(x4, y4);
  ctx.closePath();
  ctx.fill();
}

interface Paint {
  /** 도로 밖 바닥. 줄무늬를 위해 두 가지 색을 번갈아 씁니다. */
  ground: [string, string];
  road: [string, string];
  /** 도로 가장자리. 없으면 그리지 않습니다. */
  edge: [string, string] | null;
  lane: string | null;
  /** 흙길의 바퀴 자국 색. */
  ruts: string | null;
}

const pair = (color: Color, factor: number): [string, string] => [css(color), css(shade(color, factor))];

const DIRT: Color = [125, 88, 56];
const WOOD: Color = [156, 110, 66];
const RAIL: Color = [92, 62, 38];
const ICE: Color = [200, 232, 245];

/** 지형마다 도로와 그 주변을 칠할 색을 정합니다. */
function paintOf(theme: Theme, kind: TerrainKind): Paint {
  const ground = pair(theme.ground, 0.93);
  switch (kind) {
    case 'road':
      return {
        ground,
        road: pair(theme.road, 0.94),
        edge: [css(theme.rumble), css([245, 245, 245])],
        lane: css(theme.lane),
        ruts: null,
      };
    case 'dirt': {
      const soil = lerpColor(theme.ground, DIRT, 0.7);
      return {
        ground,
        road: pair(soil, 0.93),
        edge: pair(shade(soil, 0.78), 0.92),
        lane: null,
        ruts: css(shade(soil, 0.72)),
      };
    }
    case 'bridge':
      return {
        ground: pair(liquidOf(theme), 0.9),
        road: pair(WOOD, 0.8),
        edge: pair(RAIL, 1.3),
        lane: null,
        ruts: null,
      };
    case 'ford': {
      const water = liquidOf(theme);
      return {
        ground: pair(water, 0.9),
        road: pair(lerpColor(water, [255, 255, 255], 0.2), 0.93),
        edge: null,
        lane: null,
        ruts: null,
      };
    }
    case 'ice': {
      const ice = lerpColor(theme.road, ICE, 0.8);
      return {
        ground,
        road: pair(ice, 0.95),
        edge: [css(theme.rumble), css([245, 245, 245])],
        lane: css([255, 255, 255], 0.6),
        ruts: null,
      };
    }
    case 'space':
      return {
        ground: pair(SPACE_THEME.ground, 1),
        road: pair(SPACE_THEME.road, 1.35),
        edge: [css(SPACE_THEME.rumble), css([255, 70, 200])],
        lane: css(SPACE_THEME.lane),
        ruts: null,
      };
  }
}

export function drawRoad(ctx: CanvasRenderingContext2D, visible: VisibleSegment[], theme: Theme): void {
  const paints = new Map<TerrainKind, Paint>();
  const paint = (kind: TerrainKind): Paint => {
    let found = paints.get(kind);
    if (!found) {
      found = paintOf(theme, kind);
      paints.set(kind, found);
    }
    return found;
  };

  // 먼 구간부터 그려서 가까운 구간이 경계선의 틈을 덮도록 합니다.
  for (let i = visible.length - 1; i >= 0; i--) {
    const v = visible[i];
    if (!v.drawn) continue;
    const { p1, p2, segment } = v;
    const { ground, road, edge, lane, ruts } = paint(segment.terrain.kind);
    const alt = Math.floor(segment.index / RUMBLE_LENGTH) % 2;
    const height = p1.y - p2.y + 1;
    // 구간의 먼 쪽 끝은 다음 구간의 폭에 맞춰서, 폭이 바뀌는 곳이 매끄럽게 이어지도록 합니다.
    const w1 = p1.w * segment.width;
    const w2 = p2.w * (visible[i + 1]?.segment.width ?? segment.width);

    ctx.fillStyle = ground[alt];
    ctx.fillRect(0, p2.y, WIDTH, height);

    if (edge) {
      const r1 = p1.w / 6;
      const r2 = p2.w / 6;
      quad(ctx, edge[alt], p1.x - w1 - r1, p1.y, p1.x - w1, p1.y, p2.x - w2, p2.y, p2.x - w2 - r2, p2.y);
      quad(ctx, edge[alt], p1.x + w1 + r1, p1.y, p1.x + w1, p1.y, p2.x + w2, p2.y, p2.x + w2 + r2, p2.y);
    }
    quad(ctx, road[alt], p1.x - w1, p1.y, p1.x + w1, p1.y, p2.x + w2, p2.y, p2.x - w2, p2.y);

    if (ruts) {
      for (const side of [-0.42, 0.42]) {
        const c1 = p1.x + w1 * side;
        const c2 = p2.x + w2 * side;
        quad(ctx, ruts, c1 - w1 / 14, p1.y, c1 + w1 / 14, p1.y, c2 + w2 / 14, p2.y, c2 - w2 / 14, p2.y);
      }
    }

    const lanes = segment.terrain.lanes;
    if (lane && alt === 0) {
      const l1 = p1.w / 32;
      const l2 = p2.w / 32;
      for (let n = 1; n < lanes; n++) {
        const c1 = p1.x - w1 + (2 * w1 * n) / lanes;
        const c2 = p2.x - w2 + (2 * w2 * n) / lanes;
        quad(ctx, lane, c1 - l1, p1.y, c1 + l1, p1.y, c2 + l2, p2.y, c2 - l2, p2.y);
      }
    }

    if (v.fog > 0.01) {
      ctx.fillStyle = css(theme.fog, v.fog);
      ctx.fillRect(0, p2.y, WIDTH, height);
    }
  }
}
