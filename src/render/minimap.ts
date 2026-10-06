import { HEIGHT, WIDTH } from '../game/constants';
import { buildMinimap, minimapAt, type MapPoint, type Minimap } from '../game/minimap';

/** 미니맵에 표시할 다른 레이서. label이 있으면 점 옆에 이름을 씁니다. */
export interface MapMarker {
  z: number;
  color: string;
  label?: string;
}
import type { GameState, Track } from '../game/types';

export const MINIMAP_SIZE = 132;
const MARGIN = 28;
const PADDING = 12;

const cache = new WeakMap<Track, Minimap>();

function minimapOf(track: Track): Minimap {
  let map = cache.get(track);
  if (!map) {
    map = buildMinimap(track);
    cache.set(track, map);
  }
  return map;
}

/** 화면 오른쪽 아래에 코스 전체와 현재 위치를 그립니다. */
export function drawMinimap(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  track: Track,
  others: readonly MapMarker[],
): void {
  const left = WIDTH - MARGIN - MINIMAP_SIZE;
  const top = HEIGHT - MARGIN - MINIMAP_SIZE;
  drawCourse(ctx, track, left, top, MINIMAP_SIZE, state.player.z, others);
}

/** (left, top)에서 시작하는 정사각형 안에 코스 모양을 그리고, z 위치에 차량을 표시합니다. */
export function drawCourse(
  ctx: CanvasRenderingContext2D,
  track: Track,
  left: number,
  top: number,
  size: number,
  playerZ: number,
  /** 라이벌의 위치. 작은 점으로 표시합니다. */
  others: readonly MapMarker[] = [],
): void {
  const map = minimapOf(track);
  const inner = size - PADDING * 2;
  const place = (point: MapPoint): [number, number] => [
    left + PADDING + point.x * inner,
    top + PADDING + point.y * inner,
  ];

  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(left, top, size, size);

  const z = Math.min(playerZ, track.finishZ);
  const here = minimapAt(map, z);
  const passed = Math.min(map.points.length - 1, Math.floor(z / map.spacing));

  const line = (points: MapPoint[], color: string, width: number): void => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    points.forEach((point, i) => {
      const [x, y] = place(point);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  };

  line(map.points, 'rgba(0,0,0,0.7)', 7);
  line(map.points, '#f1f3f5', 4);
  line([...map.points.slice(0, passed + 1), here], '#ffb020', 4);

  for (const checkpoint of track.checkpoints) {
    const [x, y] = place(minimapAt(map, checkpoint));
    ctx.fillStyle = checkpoint <= z ? '#ffb020' : '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5;
    ctx.fillRect(x - 4, y - 4, 8, 8);
    ctx.strokeRect(x - 4, y - 4, 8, 8);
  }

  const [fx, fy] = place(map.points[map.points.length - 1]);
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 2; col++) {
      ctx.fillStyle = (row + col) % 2 === 0 ? '#111111' : '#f5f5f5';
      ctx.fillRect(fx - 6 + col * 6, fy - 6 + row * 6, 6, 6);
    }
  }

  // 다른 레이서는 차 색과 같은 색 점으로, 함께 달리는 사람은 조금 크게 그리고 이름을 붙입니다.
  for (const marker of others) {
    const [ox, oy] = place(minimapAt(map, Math.min(Math.max(0, marker.z), track.finishZ)));
    const radius = marker.label ? 4.5 : 3;
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(ox, oy, radius + 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = marker.color;
    ctx.beginPath();
    ctx.arc(ox, oy, radius, 0, Math.PI * 2);
    ctx.fill();
    if (marker.label) {
      ctx.font = "bold 11px 'Apple SD Gothic Neo', 'Malgun Gothic', system-ui, sans-serif";
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.strokeText(marker.label, ox + 7, oy);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(marker.label, ox + 7, oy);
    }
  }

  const [px, py] = place(here);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(px, py, 6.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e12d2d';
  ctx.beginPath();
  ctx.arc(px, py, 4.5, 0, Math.PI * 2);
  ctx.fill();
}
