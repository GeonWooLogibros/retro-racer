import { formatKm, formatTime } from '../format';
import { HEIGHT, WIDTH } from '../game/constants';
import { distanceOf } from '../game/race';
import type { GameState, Records } from '../game/types';
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

export function drawTitle(ctx: CanvasRenderingContext2D, records: Records): void {
  dim(ctx);
  const cx = WIDTH / 2;
  drawText(ctx, 'RETRO RACER', cx, 110, 84, 'center', '#ffe066');
  drawText(ctx, 'ENTER 키를 눌러 시작', cx, 240, 30, 'center');
  drawText(ctx, '← → 조향    ↑ 가속    ↓ 브레이크    SPACE 니트로    M 소리', cx, 320, 18, 'center');
  drawText(ctx, '제한 시간 안에 체크포인트를 통과해 결승점까지 달리세요', cx, 354, 18, 'center');
  drawText(ctx, '다른 차를 아슬아슬하게 추월하면 니트로 게이지가 빠르게 찹니다', cx, 384, 18, 'center');
  const best = bestLine(records);
  if (best) drawText(ctx, best, cx, 450, 24, 'center', '#4dabf7');
}

export function drawResult(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  records: Records,
  newRecord: boolean,
): void {
  dim(ctx);
  const cx = WIDTH / 2;
  if (state.phase === 'finished') {
    drawText(ctx, '완주!', cx, 110, 80, 'center', '#ffe066');
    drawText(ctx, `기록  ${formatTime(state.elapsed)}`, cx, 230, 36, 'center');
    drawText(ctx, `남은 시간  ${state.time.toFixed(1)}초`, cx, 282, 20, 'center');
  } else {
    drawText(ctx, '시간 종료', cx, 110, 80, 'center', '#ff5252');
    drawText(ctx, `도달 거리  ${formatKm(distanceOf(state.player))}`, cx, 230, 36, 'center');
    drawText(ctx, `통과한 체크포인트  ${state.checkpointsPassed}개`, cx, 282, 20, 'center');
  }
  if (newRecord) drawText(ctx, '신기록!', cx, 330, 30, 'center', '#ff922b');
  const best = bestLine(records);
  if (best) drawText(ctx, best, cx, 390, 22, 'center', '#4dabf7');
  drawText(ctx, 'ENTER 키를 눌러 다시 시작', cx, 460, 26, 'center');
}
