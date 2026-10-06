import { formatKm, speedKmh } from '../format';
import {
  BOOSTER_SLOTS,
  CHECKPOINT_BONUS,
  GAUGE_MAX,
  HEIGHT,
  START_Z,
  THEME_BLEND_SECONDS,
  WARNING_SECONDS,
  WIDTH,
} from '../game/constants';
import { distanceOf } from '../game/race';
import type { GameState, Track } from '../game/types';
import { driftLevel } from '../game/player';
import { SPARK_COLORS } from './effects';
import { drawMinimap, MINIMAP_SIZE, type MapMarker } from './minimap';
import { drawText } from './text';

export function drawHud(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  track: Track,
  muted: boolean,
  /** 참가자 수와 다른 레이서들의 위치. */
  field: { total: number; others: readonly MapMarker[] },
): void {
  const { player } = state;

  drawText(ctx, String(speedKmh(player.speed)), 28, 16, 46);
  drawText(ctx, 'km/h', 30, 66, 16);

  // 순위
  const racers = field.total;
  drawText(ctx, `${state.rank}위`, 28, 94, 38, 'left', state.rank === 1 ? '#ffd43b' : '#ffffff');
  drawText(ctx, `/ ${racers}`, 28 + (state.rank >= 10 ? 96 : 76), 110, 18);

  const low = state.time <= WARNING_SECONDS;
  drawText(ctx, String(Math.ceil(state.time)), WIDTH / 2, 10, 58, 'center', low ? '#ff5252' : '#ffe066');
  const { themes } = track;
  const section = Math.min(state.checkpointsPassed, themes.length - 1);
  drawText(ctx, `구간 ${section + 1}/${themes.length} · ${themes[section].name}`, WIDTH / 2, 76, 16, 'center');

  // 진행도
  const barX = WIDTH - 248;
  const barW = 220;
  const total = track.finishZ - START_Z;
  const progress = Math.min(1, distanceOf(player) / total);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(barX, 24, barW, 10);
  ctx.fillStyle = '#ffe066';
  ctx.fillRect(barX, 24, barW * progress, 10);
  ctx.fillStyle = '#ffffff';
  for (const z of track.checkpoints) ctx.fillRect(barX + (barW * (z - START_Z)) / total - 1, 20, 2, 18);
  drawText(ctx, formatKm(distanceOf(player)), WIDTH - 28, 42, 16, 'right');

  // 부스터 칸과 게이지
  const boxX = 28;
  const boxY = HEIGHT - 66;
  drawText(ctx, 'BOOSTER', boxX, boxY - 24, 16);
  for (let i = 0; i < BOOSTER_SLOTS; i++) {
    const x = boxX + i * 56;
    const using = player.nitroActive && i === player.boosters;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x, boxY, 48, 26);
    if (i < player.boosters || using) {
      ctx.fillStyle = using ? (state.elapsed % 0.2 < 0.1 ? '#fff3bf' : '#ff922b') : '#ff922b';
      ctx.fillRect(x + 3, boxY + 3, 42, 20);
    }
  }
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(boxX, boxY + 32, 104, 8);
  ctx.fillStyle = '#4dabf7';
  ctx.fillRect(boxX, boxY + 32, (104 * player.gauge) / GAUGE_MAX, 8);

  if (player.drifting) {
    const level = driftLevel(player.driftTime);
    const label = level > 0 ? `DRIFT  Lv${level}` : 'DRIFT';
    drawText(ctx, label, boxX, boxY - 54, 22, 'left', level > 0 ? SPARK_COLORS[level - 1] : '#ffffff');
  }

  drawMinimap(ctx, state, track, field.others);

  const sinceCheckpoint = state.elapsed - state.lastCheckpointAt;
  if (state.checkpointsPassed > 0 && sinceCheckpoint < THEME_BLEND_SECONDS) {
    drawText(ctx, `CHECKPOINT  +${CHECKPOINT_BONUS}초`, WIDTH / 2, 130, 34, 'center', '#ffe066');
  } else if (state.phase === 'racing' && state.time <= 0) {
    drawText(ctx, '시간 종료', WIDTH / 2, 130, 34, 'center', '#ff5252');
  }

  if (muted) drawText(ctx, '음소거 (M)', WIDTH - 28, HEIGHT - 52 - MINIMAP_SIZE, 14, 'right');
}
