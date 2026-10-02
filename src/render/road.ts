import {
  CAMERA_HEIGHT,
  DRAW_DISTANCE,
  HEIGHT,
  LANES,
  PLAYER_DISTANCE,
  ROAD_WIDTH,
  RUMBLE_LENGTH,
  SEGMENT_LENGTH,
  WIDTH,
} from '../game/constants';
import { css, shade } from '../game/themes';
import { heightAt, segmentAt } from '../game/track';
import type { Player, Segment, Theme, Track } from '../game/types';
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

export function computeVisible(track: Track, player: Player): VisibleSegment[] {
  const cameraZ = player.z - PLAYER_DISTANCE;
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

    const p1 = project(0, segment.y1, z1, cameraX - shift, cameraY, cameraZ);
    const p2 = project(0, segment.y2, z1 + SEGMENT_LENGTH, cameraX - x, cameraY, cameraZ);
    const drawn = p2.y < p1.y && p2.y < maxY;
    visible.push({ segment, p1, p2, clip: maxY, fog: Math.pow(n / DRAW_DISTANCE, 3) * MAX_FOG, drawn });
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

export function drawRoad(ctx: CanvasRenderingContext2D, visible: VisibleSegment[], theme: Theme): void {
  const ground = [css(theme.ground), css(shade(theme.ground, 0.93))];
  const road = [css(theme.road), css(shade(theme.road, 0.94))];
  const rumble = [css(theme.rumble), css([245, 245, 245])];
  const lane = css(theme.lane);

  // 먼 구간부터 그려서 가까운 구간이 경계선의 틈을 덮도록 합니다.
  for (let i = visible.length - 1; i >= 0; i--) {
    const v = visible[i];
    if (!v.drawn) continue;
    const { p1, p2 } = v;
    const alt = Math.floor(v.segment.index / RUMBLE_LENGTH) % 2;
    const height = p1.y - p2.y + 1;

    ctx.fillStyle = ground[alt];
    ctx.fillRect(0, p2.y, WIDTH, height);

    const r1 = p1.w / 6;
    const r2 = p2.w / 6;
    quad(ctx, rumble[alt], p1.x - p1.w - r1, p1.y, p1.x - p1.w, p1.y, p2.x - p2.w, p2.y, p2.x - p2.w - r2, p2.y);
    quad(ctx, rumble[alt], p1.x + p1.w + r1, p1.y, p1.x + p1.w, p1.y, p2.x + p2.w, p2.y, p2.x + p2.w + r2, p2.y);
    quad(ctx, road[alt], p1.x - p1.w, p1.y, p1.x + p1.w, p1.y, p2.x + p2.w, p2.y, p2.x - p2.w, p2.y);

    if (alt === 0) {
      const l1 = p1.w / 32;
      const l2 = p2.w / 32;
      for (let n = 1; n < LANES; n++) {
        const c1 = p1.x - p1.w + (2 * p1.w * n) / LANES;
        const c2 = p2.x - p2.w + (2 * p2.w * n) / LANES;
        quad(ctx, lane, c1 - l1, p1.y, c1 + l1, p1.y, c2 + l2, p2.y, c2 - l2, p2.y);
      }
    }

    if (v.fog > 0.01) {
      ctx.fillStyle = css(theme.fog, v.fog);
      ctx.fillRect(0, p2.y, WIDTH, height);
    }
  }
}
