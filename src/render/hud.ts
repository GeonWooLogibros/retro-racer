import { formatKm, speedKmh } from '../format';
import {
  CHECKPOINT_BONUS,
  HEIGHT,
  NITRO_MAX,
  NITRO_MIN,
  START_Z,
  THEME_BLEND_SECONDS,
  WARNING_SECONDS,
  WIDTH,
} from '../game/constants';
import { distanceOf } from '../game/race';
import { THEMES } from '../game/themes';
import type { GameState, Track } from '../game/types';
import { drawText } from './text';

export function drawHud(ctx: CanvasRenderingContext2D, state: GameState, track: Track, muted: boolean): void {
  const { player } = state;

  drawText(ctx, String(speedKmh(player.speed)), 28, 16, 46);
  drawText(ctx, 'km/h', 30, 66, 16);

  const low = state.time <= WARNING_SECONDS;
  drawText(ctx, String(Math.ceil(state.time)), WIDTH / 2, 10, 58, 'center', low ? '#ff5252' : '#ffe066');
  const section = Math.min(state.checkpointsPassed, THEMES.length - 1);
  drawText(ctx, `구간 ${section + 1}/${THEMES.length} · ${THEMES[section].name}`, WIDTH / 2, 76, 16, 'center');

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

  // 니트로 게이지
  const nitroX = 28;
  const nitroY = HEIGHT - 38;
  const nitroW = 200;
  drawText(ctx, 'NITRO', nitroX, nitroY - 24, 16);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(nitroX, nitroY, nitroW, 14);
  ctx.fillStyle = player.nitroActive ? '#ff922b' : player.nitro >= NITRO_MIN ? '#4dabf7' : '#6c7a89';
  ctx.fillRect(nitroX, nitroY, (nitroW * player.nitro) / NITRO_MAX, 14);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(nitroX + (nitroW * NITRO_MIN) / NITRO_MAX - 1, nitroY - 3, 2, 20);

  const sinceCheckpoint = state.elapsed - state.lastCheckpointAt;
  if (state.checkpointsPassed > 0 && sinceCheckpoint < THEME_BLEND_SECONDS) {
    drawText(ctx, `CHECKPOINT  +${CHECKPOINT_BONUS}초`, WIDTH / 2, 130, 34, 'center', '#ffe066');
  } else if (state.phase === 'racing' && state.time <= 0) {
    drawText(ctx, '시간 종료', WIDTH / 2, 130, 34, 'center', '#ff5252');
  }

  if (muted) drawText(ctx, '음소거 (M)', WIDTH - 28, HEIGHT - 34, 14, 'right');
}
