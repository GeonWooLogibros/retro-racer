import { HEIGHT, WIDTH } from '../game/constants';
import { css, lerpColor, luminance } from '../game/themes';
import type { SkinName, Theme } from '../game/types';
import { drawImage, voltaArt } from './skins';

const mod = (value: number, size: number): number => ((value % size) + size) % size;

function hills(
  ctx: CanvasRenderingContext2D,
  color: string,
  shift: number,
  base: number,
  amplitude: number,
  frequency: number,
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, HEIGHT);
  for (let x = 0; x <= WIDTH; x += 8) {
    const a = (x + shift) * frequency;
    ctx.lineTo(x, base - amplitude * (0.6 + 0.4 * Math.sin(a) + 0.25 * Math.sin(a * 2.7 + 1.3)));
  }
  ctx.lineTo(WIDTH, HEIGHT);
  ctx.closePath();
  ctx.fill();
}

/** heading은 현재 구간까지 누적된 커브 값이며, 커브를 돌 때 원경을 좌우로 움직이는 데 사용합니다. */
export function drawBackground(
  ctx: CanvasRenderingContext2D,
  theme: Theme,
  heading: number,
  skin?: SkinName,
  /** 원경 그림의 진하기. 우주 지형에서는 0에 가까워집니다. */
  scenery = 1,
): void {
  const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT * 0.6);
  sky.addColorStop(0, css(theme.skyTop));
  sky.addColorStop(1, css(theme.skyBottom));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const night = Math.max(0, 1 - luminance(theme.skyTop) / 90);
  if (night > 0) {
    ctx.fillStyle = css([255, 255, 255], night * 0.9);
    for (let i = 0; i < 70; i++) {
      ctx.fillRect(mod(i * 197.3 - heading * 0.05, WIDTH), (i * 89.7) % (HEIGHT * 0.45), 2, 2);
    }
  }

  const sunX = mod(WIDTH * 0.72 - heading * 0.1, WIDTH * 1.4) - WIDTH * 0.2;
  const sunY = HEIGHT * 0.24;
  const sun = lerpColor([255, 244, 190], [225, 230, 245], night);
  ctx.fillStyle = css(sun, 0.25);
  ctx.beginPath();
  ctx.arc(sunX, sunY, 58, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = css(sun);
  ctx.beginPath();
  ctx.arc(sunX, sunY, 36, 0, Math.PI * 2);
  ctx.fill();

  if (skin === 'volta') {
    drawCanyon(ctx, heading, scenery);
    return;
  }
  hills(ctx, css(lerpColor(theme.ground, theme.skyBottom, 0.65)), heading * 0.2, HEIGHT * 0.5, 46, 0.006);
  hills(ctx, css(lerpColor(theme.ground, theme.skyBottom, 0.35)), heading * 0.4, HEIGHT * 0.5 + 14, 26, 0.013);
}

const CANYON_WIDTH = 540;

/** 볼타 러너 맵의 원경. 구름과 협곡 그림을 커브에 맞춰 좌우로 흘립니다. */
function drawCanyon(ctx: CanvasRenderingContext2D, heading: number, scenery: number): void {
  if (scenery <= 0.01) return;
  const art = voltaArt();
  ctx.save();
  ctx.globalAlpha = scenery;
  drawImage(ctx, art.cloudLarge, mod(WIDTH * 0.25 - heading * 0.06, WIDTH + 600) - 300, HEIGHT * 0.2, 340);
  drawImage(ctx, art.cloudSmall, mod(WIDTH * 0.8 - heading * 0.09, WIDTH + 500) - 250, HEIGHT * 0.3, 220);
  const offset = mod(heading * 0.25, CANYON_WIDTH * 2);
  for (let x = -offset - CANYON_WIDTH; x < WIDTH + CANYON_WIDTH; x += CANYON_WIDTH * 2) {
    drawImage(ctx, art.canyonLeft, x + CANYON_WIDTH / 2, HEIGHT * 0.5 + 24, CANYON_WIDTH);
    drawImage(ctx, art.canyonRight, x + CANYON_WIDTH * 1.5, HEIGHT * 0.5 + 24, CANYON_WIDTH);
  }
  ctx.restore();
}
