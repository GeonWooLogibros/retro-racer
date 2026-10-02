import { CAMERA_HEIGHT, CAR_WIDTH, HEIGHT, MAX_SPEED, WIDTH } from '../game/constants';
import { css, shade } from '../game/themes';
import type { Color, GateKind, Player, Prop } from '../game/types';

type Ctx = CanvasRenderingContext2D;

export const CAR_COLORS: Color[] = [
  [40, 110, 220],
  [240, 200, 40],
  [60, 170, 90],
  [230, 230, 235],
  [150, 80, 200],
];

const PLAYER_COLOR: Color = [225, 45, 45];

/** 가로 중심이 cx이고 아래쪽 끝이 bottom인 사각형을 그립니다. */
function box(ctx: Ctx, color: string, cx: number, bottom: number, w: number, h: number): void {
  ctx.fillStyle = color;
  ctx.fillRect(cx - w / 2, bottom - h, w, h);
}

function tri(ctx: Ctx, color: string, cx: number, bottom: number, w: number, h: number): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, bottom);
  ctx.lineTo(cx + w / 2, bottom);
  ctx.lineTo(cx, bottom - h);
  ctx.closePath();
  ctx.fill();
}

function disc(ctx: Ctx, color: string, cx: number, cy: number, r: number): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}

const PALM_LEAVES = [
  [-260, 960],
  [260, 960],
  [-140, 1090],
  [140, 1090],
  [0, 1150],
];

/**
 * 길가 사물을 그립니다. (x, y)는 사물이 지면에 닿는 위치이고,
 * s는 월드 단위 1이 차지하는 화면 픽셀 수입니다.
 */
export function drawProp(ctx: Ctx, prop: Prop, x: number, y: number, s: number, variant: number): void {
  const toRoad = prop.offset > 0 ? -1 : 1;
  switch (prop.kind) {
    case 'palm':
      box(ctx, '#8a5a2b', x, y, 90 * s, 1000 * s);
      for (const [dx, up] of PALM_LEAVES) disc(ctx, '#2f9e44', x + dx * s, y - up * s, 220 * s);
      break;
    case 'cactus':
      box(ctx, '#3a8f4a', x, y, 150 * s, 700 * s);
      box(ctx, '#3a8f4a', x - 190 * s, y - 300 * s, 90 * s, 280 * s);
      box(ctx, '#3a8f4a', x - 120 * s, y - 300 * s, 150 * s, 80 * s);
      box(ctx, '#3a8f4a', x + 190 * s, y - 400 * s, 90 * s, 240 * s);
      box(ctx, '#3a8f4a', x + 120 * s, y - 400 * s, 150 * s, 80 * s);
      break;
    case 'rock':
      ctx.fillStyle = '#8d8478';
      ctx.beginPath();
      ctx.moveTo(x - 260 * s, y);
      ctx.lineTo(x - 180 * s, y - 200 * s);
      ctx.lineTo(x + 20 * s, y - 280 * s);
      ctx.lineTo(x + 220 * s, y - 160 * s);
      ctx.lineTo(x + 280 * s, y);
      ctx.closePath();
      ctx.fill();
      break;
    case 'pine':
      box(ctx, '#5b3a1e', x, y, 90 * s, 260 * s);
      tri(ctx, '#1f5d34', x, y - 200 * s, 640 * s, 520 * s);
      tri(ctx, '#256b3c', x, y - 520 * s, 500 * s, 440 * s);
      tri(ctx, '#2c7a45', x, y - 820 * s, 340 * s, 360 * s);
      break;
    case 'lamp':
      box(ctx, '#9aa0aa', x, y, 40 * s, 1100 * s);
      box(ctx, '#9aa0aa', x + toRoad * 150 * s, y - 1060 * s, 300 * s, 40 * s);
      disc(ctx, 'rgba(255,230,140,0.25)', x + toRoad * 300 * s, y - 1040 * s, 160 * s);
      disc(ctx, '#ffe68c', x + toRoad * 300 * s, y - 1040 * s, 55 * s);
      break;
    case 'building': {
      const w = 1500 * s;
      const h = (2200 + (variant % 5) * 450) * s;
      box(ctx, '#191a2e', x, y, w, h);
      if (w > 14) {
        const rows = Math.floor(h / (300 * s));
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < 4; c++) {
            if ((variant * 7 + r * 3 + c * 5) % 4 === 0) continue;
            box(ctx, '#f2d16b', x - w / 2 + ((c + 0.5) * w) / 4, y - (r * 300 + 140) * s, w / 8, 130 * s);
          }
        }
      }
      break;
    }
    case 'sign':
      box(ctx, '#cfd3da', x, y, 40 * s, 520 * s);
      box(ctx, '#f4f4f4', x, y - 520 * s, 520 * s, 320 * s);
      box(ctx, '#e03131', x, y - 600 * s, 360 * s, 160 * s);
      break;
    case 'flag':
      box(ctx, '#e9ecef', x, y, 30 * s, 900 * s);
      ctx.fillStyle = '#f03e3e';
      ctx.beginPath();
      ctx.moveTo(x, y - 900 * s);
      ctx.lineTo(x + toRoad * 360 * s, y - 780 * s);
      ctx.lineTo(x, y - 660 * s);
      ctx.closePath();
      ctx.fill();
      break;
  }
}

/** 도로를 가로지르는 아치형 구조물을 그립니다. w는 도로 반폭의 화면 픽셀 수입니다. */
export function drawGate(ctx: Ctx, kind: GateKind, x: number, y: number, w: number, s: number): void {
  const half = w * 1.25;
  const pillarHeight = 1800 * s;
  const bannerHeight = 420 * s;
  box(ctx, '#dfe3e8', x - half, y, 160 * s, pillarHeight);
  box(ctx, '#dfe3e8', x + half, y, 160 * s, pillarHeight);

  const top = y - pillarHeight;
  if (kind === 'checkpoint') {
    ctx.fillStyle = '#f7b500';
    ctx.fillRect(x - half, top, half * 2, bannerHeight);
    if (bannerHeight > 12) {
      ctx.fillStyle = '#1a1a1a';
      ctx.font = `bold ${bannerHeight * 0.6}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('CHECKPOINT', x, top + bannerHeight / 2);
    }
    return;
  }

  const columns = 16;
  const cell = (half * 2) / columns;
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < columns; col++) {
      ctx.fillStyle = (row + col) % 2 === 0 ? '#111111' : '#f5f5f5';
      ctx.fillRect(x - half + col * cell, top + (row * bannerHeight) / 2, cell + 0.5, bannerHeight / 2 + 0.5);
    }
  }
}

/** 차량의 뒷모습을 그립니다. (x, y)는 차량 뒤쪽 가운데가 지면에 닿는 위치입니다. */
export function drawCar(ctx: Ctx, x: number, y: number, s: number, color: Color, flames: boolean): void {
  const w = CAR_WIDTH * s;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(x - w * 0.52, y - 14 * s, w * 1.04, 28 * s);
  box(ctx, '#111111', x - w * 0.38, y, w * 0.18, 70 * s);
  box(ctx, '#111111', x + w * 0.38, y, w * 0.18, 70 * s);
  box(ctx, css(color), x, y - 30 * s, w, 150 * s);
  box(ctx, css(shade(color, 0.8)), x, y - 180 * s, w * 0.72, 110 * s);
  box(ctx, '#1c2733', x, y - 190 * s, w * 0.6, 80 * s);
  box(ctx, '#ff3b30', x - w * 0.36, y - 110 * s, w * 0.16, 36 * s);
  box(ctx, '#ff3b30', x + w * 0.36, y - 110 * s, w * 0.16, 36 * s);
  box(ctx, '#eeeeee', x, y - 60 * s, w * 0.2, 34 * s);
  if (flames) {
    for (const side of [-1, 1]) {
      disc(ctx, '#ff922b', x + side * w * 0.2, y - 40 * s, 42 * s);
      disc(ctx, '#ffe066', x + side * w * 0.2, y - 40 * s, 22 * s);
    }
  }
}

export function drawPlayer(ctx: Ctx, player: Player, steer: number, elapsed: number): void {
  const s = WIDTH / 2 / CAMERA_HEIGHT;
  const bounce = Math.sin(elapsed * 40) * (player.speed / MAX_SPEED) * 1.5;
  drawCar(ctx, WIDTH / 2 + steer * 14, HEIGHT - 6 + bounce, s, PLAYER_COLOR, player.nitroActive);
}
