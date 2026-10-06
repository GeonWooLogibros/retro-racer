import { formatKm, formatTime } from '../format';
import { HEIGHT, WIDTH } from '../game/constants';
import { distanceOf } from '../game/race';
import type { GameState, Records, Track } from '../game/types';
import { drawCourse } from './minimap';
import { drawText } from './text';

function dim(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
}

function bestLine(records: Records): string {
  if (records.bestTime !== null) return `최고 기록  ${formatTime(records.bestTime)}`;
  if (records.bestDistance > 0) return `최장 거리  ${formatKm(records.bestDistance)}`;
  return '';
}

const PREVIEW_SIZE = 150;

function stars(difficulty: number): string {
  return '★'.repeat(difficulty) + '☆'.repeat(5 - difficulty);
}

/** 맵 선택을 겸하는 타이틀 화면. index는 맵 목록에서의 순서(0부터)입니다. */
export function drawTitle(
  ctx: CanvasRenderingContext2D,
  track: Track,
  records: Records,
  index: number,
  count: number,
): void {
  dim(ctx);
  const cx = WIDTH / 2;
  const { map } = track;
  drawText(ctx, 'RETRO RACER', cx, 26, 60, 'center', '#ffe066');

  drawText(ctx, '◀', cx - 250, 116, 40, 'center');
  drawText(ctx, map.name, cx, 112, 46, 'center');
  drawText(ctx, '▶', cx + 250, 116, 40, 'center');
  drawText(ctx, `난이도 ${stars(map.difficulty)}   ·   맵 ${index + 1}/${count}`, cx, 172, 20, 'center', '#ffe066');
  drawText(ctx, track.themes.map((theme) => theme.name).join(' → '), cx, 204, 16, 'center');

  drawCourse(ctx, track, cx - PREVIEW_SIZE / 2, 234, PREVIEW_SIZE, 0);

  const best = bestLine(records);
  drawText(ctx, best || '아직 기록이 없습니다', cx, 394, 20, 'center', best ? '#4dabf7' : '#ced4da');
  drawText(ctx, '← → 맵 선택      ENTER 시작', cx, 430, 28, 'center');
  drawText(ctx, '↑ 가속    ↓ 브레이크    ← → 조향    SHIFT 드리프트    SPACE 부스터    M 소리', cx, 484, 16, 'center');
  drawText(
    ctx,
    '드리프트를 오래 할수록 불꽃 색이 바뀌고, 떼는 순간 터보가 붙어요. 바로 반대 방향키를 누르면 순간 부스터!',
    cx,
    512,
    16,
    'center',
  );
  drawText(
    ctx,
    '라이벌 다섯 명을 제치고 1위로 들어오세요. 드리프트하고 라이벌을 추월하면 부스터가 모여요',
    cx,
    538,
    16,
    'center',
  );
}

export function drawResult(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  track: Track,
  records: Records,
  newRecord: boolean,
  /** 함께 달릴 때는 다시 시작 안내 대신 오른쪽 순위표를 보라고 알립니다. */
  together = false,
): void {
  dim(ctx);
  const cx = WIDTH / 2;
  const { map } = track;
  drawText(ctx, `${map.name}  ·  난이도 ${stars(map.difficulty)}`, cx, 198, 20, 'center', '#ffe066');
  if (state.phase === 'finished') {
    const first = state.rank === 1;
    drawText(ctx, first ? '1위 완주!' : `${state.rank}위 완주`, cx, 110, 80, 'center', first ? '#ffd43b' : '#ffffff');
    drawText(ctx, `클리어 타임  ${formatTime(state.elapsed)}`, cx, 232, 36, 'center');
    drawText(ctx, `남은 시간  ${state.time.toFixed(1)}초`, cx, 282, 20, 'center');
  } else {
    drawText(ctx, '시간 종료', cx, 110, 80, 'center', '#ff5252');
    drawText(ctx, `도달 거리  ${formatKm(distanceOf(state.player))}`, cx, 230, 36, 'center');
    drawText(ctx, `통과한 체크포인트  ${state.checkpointsPassed}개`, cx, 282, 20, 'center');
  }
  if (newRecord) drawText(ctx, '신기록!', cx, 330, 30, 'center', '#ff922b');
  const best = bestLine(records);
  if (best) drawText(ctx, best, cx, 390, 22, 'center', '#4dabf7');
  drawText(
    ctx,
    together ? '오른쪽 순위표에서 다른 사람의 기록을 확인하세요' : 'ENTER 다시 시작      ESC 맵 선택',
    cx,
    460,
    together ? 20 : 26,
    'center',
  );
}

/** 함께 달릴 때 출발 전 3, 2, 1을 크게 보여 줍니다. */
export function drawCountdown(ctx: CanvasRenderingContext2D, remaining: number): void {
  const count = Math.ceil(remaining);
  const label = count > 0 ? String(count) : '출발!';
  const pop = 1.4 - 0.4 * Math.min(1, (1 - (remaining - Math.floor(remaining))) * 4);
  ctx.save();
  ctx.translate(WIDTH / 2, HEIGHT / 2 - 40);
  ctx.scale(pop, pop);
  drawText(ctx, label, 0, -60, 120, 'center', count > 0 ? '#ffffff' : '#ffd43b');
  ctx.restore();
}
