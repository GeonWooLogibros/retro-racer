import { CAMERA_HEIGHT, CAR_WIDTH, HEIGHT, MAX_SPEED, WIDTH } from '../game/constants';
import { css, shade } from '../game/themes';
import type { Color, GateKind, Player, Prop } from '../game/types';
import { playerOnScreen, type Camera } from './camera';
import { driftLevel } from '../game/player';
import { drawSparks } from './effects';
import { drawImage, voltaArt } from './skins';

type Ctx = CanvasRenderingContext2D;

const PLAYER_COLOR: Color = [225, 45, 45];

/** 라이벌 차량 색. 일반 차량과 구분되도록 진한 색을 씁니다. */
export const RIVAL_COLORS: Color[] = [
  [255, 140, 0],
  [20, 200, 170],
  [130, 70, 230],
  [255, 80, 160],
  [30, 30, 40],
];

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

const BLOSSOM = [
  [-230, 700],
  [230, 720],
  [-110, 900],
  [130, 920],
  [0, 760],
  [10, 1040],
];

const BAMBOO = [
  [-150, 1050],
  [0, 1250],
  [140, 950],
];

const CANOPY = [
  [-280, 900],
  [280, 920],
  [-150, 1090],
  [160, 1110],
  [0, 960],
  [0, 1240],
];

const NEON: Color[] = [
  [255, 80, 180],
  [60, 230, 240],
  [250, 220, 70],
  [150, 110, 255],
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
    case 'sakura':
      box(ctx, '#6b4226', x, y, 90 * s, 620 * s);
      for (const [dx, up] of BLOSSOM) disc(ctx, up > 900 ? '#ffc9de' : '#f7a8c8', x + dx * s, y - up * s, 230 * s);
      break;
    case 'bamboo':
      for (const [dx, height] of BAMBOO) {
        box(ctx, '#5a9e3e', x + dx * s, y, 46 * s, height * s);
        box(ctx, '#7cc25a', x + dx * s, y - height * s + 60 * s, 190 * s, 60 * s);
        box(ctx, '#3f7a2b', x + dx * s, y - height * 0.5 * s, 56 * s, 14 * s);
      }
      break;
    case 'lantern':
      box(ctx, '#3b2a2a', x, y, 44 * s, 760 * s);
      box(ctx, '#3b2a2a', x + toRoad * 110 * s, y - 730 * s, 260 * s, 36 * s);
      disc(ctx, 'rgba(255,120,80,0.28)', x + toRoad * 220 * s, y - 610 * s, 190 * s);
      box(ctx, '#e8402f', x + toRoad * 220 * s, y - 520 * s, 150 * s, 190 * s);
      box(ctx, '#ffd27a', x + toRoad * 220 * s, y - 585 * s, 150 * s, 50 * s);
      break;
    case 'snowPine':
      box(ctx, '#5b3a1e', x, y, 90 * s, 260 * s);
      tri(ctx, '#2f6b52', x, y - 200 * s, 640 * s, 520 * s);
      tri(ctx, '#f4f8fb', x, y - 430 * s, 360 * s, 290 * s);
      tri(ctx, '#37785c', x, y - 520 * s, 500 * s, 440 * s);
      tri(ctx, '#f4f8fb', x, y - 720 * s, 280 * s, 240 * s);
      tri(ctx, '#f4f8fb', x, y - 820 * s, 340 * s, 360 * s);
      break;
    case 'iceRock':
      ctx.fillStyle = '#a9d6ee';
      ctx.beginPath();
      ctx.moveTo(x - 240 * s, y);
      ctx.lineTo(x - 120 * s, y - 420 * s);
      ctx.lineTo(x + 30 * s, y - 250 * s);
      ctx.lineTo(x + 130 * s, y - 520 * s);
      ctx.lineTo(x + 260 * s, y);
      ctx.closePath();
      ctx.fill();
      tri(ctx, '#e6f6ff', x - 110 * s, y - 250 * s, 150 * s, 170 * s);
      break;
    case 'mesa': {
      const w = 1500 * s;
      const h = (900 + (variant % 4) * 260) * s;
      box(ctx, '#a3482c', x, y, w, h);
      box(ctx, '#c4623c', x, y - h, w * 1.06, 90 * s);
      box(ctx, '#8a3a24', x, y - h * 0.45, w, 70 * s);
      box(ctx, '#8a3a24', x - w * 0.2, y, w * 0.08, h * 0.45);
      break;
    }
    case 'deadTree':
      box(ctx, '#4a3a33', x, y, 70 * s, 760 * s);
      box(ctx, '#4a3a33', x - 150 * s, y - 520 * s, 300 * s, 40 * s);
      box(ctx, '#4a3a33', x - 280 * s, y - 520 * s, 40 * s, 200 * s);
      box(ctx, '#4a3a33', x + 130 * s, y - 380 * s, 260 * s, 40 * s);
      box(ctx, '#4a3a33', x + 240 * s, y - 380 * s, 40 * s, 240 * s);
      break;
    case 'neonSign': {
      const glow = NEON[variant % NEON.length];
      box(ctx, '#2b2b3a', x, y, 50 * s, 1200 * s);
      disc(ctx, css(glow, 0.22), x + toRoad * 60 * s, y - 1000 * s, 330 * s);
      box(ctx, '#15151f', x + toRoad * 60 * s, y - 760 * s, 300 * s, 480 * s);
      box(ctx, css(glow), x + toRoad * 60 * s, y - 800 * s, 230 * s, 400 * s);
      box(ctx, '#15151f', x + toRoad * 60 * s, y - 940 * s, 150 * s, 120 * s);
      break;
    }
    case 'antenna':
      box(ctx, '#b8bcc8', x, y, 46 * s, 1000 * s);
      box(ctx, '#8e93a3', x, y, 260 * s, 60 * s);
      disc(ctx, '#d9dce6', x + toRoad * 90 * s, y - 900 * s, 150 * s);
      disc(ctx, '#7d8296', x + toRoad * 110 * s, y - 900 * s, 90 * s);
      disc(ctx, 'rgba(255,70,70,0.3)', x, y - 1020 * s, 90 * s);
      disc(ctx, '#ff4646', x, y - 1020 * s, 34 * s);
      break;
    case 'dome': {
      const radius = (620 + (variant % 3) * 120) * s;
      ctx.fillStyle = '#d5d9e4';
      ctx.beginPath();
      ctx.arc(x, y, radius, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#7fd7f0';
      ctx.beginPath();
      ctx.arc(x, y, radius * 0.62, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      box(ctx, '#8e93a3', x, y, radius * 2.1, 50 * s);
      break;
    }
    case 'jungleTree':
      box(ctx, '#5a3d24', x, y, 110 * s, 900 * s);
      for (const [dx, up] of CANOPY) disc(ctx, up > 1000 ? '#2f8a3c' : '#1f6b30', x + dx * s, y - up * s, 250 * s);
      box(ctx, '#3d8f3a', x - 60 * s, y - 300 * s, 30 * s, 420 * s);
      break;
    case 'lavaRock':
      ctx.fillStyle = '#2b2326';
      ctx.beginPath();
      ctx.moveTo(x - 270 * s, y);
      ctx.lineTo(x - 170 * s, y - 260 * s);
      ctx.lineTo(x + 10 * s, y - 360 * s);
      ctx.lineTo(x + 210 * s, y - 200 * s);
      ctx.lineTo(x + 280 * s, y);
      ctx.closePath();
      ctx.fill();
      box(ctx, '#ff7a1a', x - 60 * s, y - 60 * s, 30 * s, 190 * s);
      box(ctx, '#ffb347', x + 90 * s, y - 30 * s, 26 * s, 130 * s);
      break;
    case 'vent':
      tri(ctx, '#3a2c2c', x, y, 560 * s, 420 * s);
      disc(ctx, 'rgba(255,110,30,0.3)', x, y - 470 * s, 190 * s);
      disc(ctx, '#ff7a1a', x, y - 430 * s, 80 * s);
      disc(ctx, '#ffd27a', x, y - 430 * s, 40 * s);
      disc(ctx, 'rgba(120,110,110,0.45)', x + 40 * s, y - 700 * s, 130 * s);
      disc(ctx, 'rgba(120,110,110,0.3)', x - 30 * s, y - 930 * s, 170 * s);
      break;
    case 'pillar':
      drawImage(ctx, voltaArt().pillar, x, y, 900 * s);
      break;
    case 'arch':
      drawImage(ctx, voltaArt().arch, x, y, 1700 * s);
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

/**
 * 차량의 뒷모습을 그립니다. (x, y)는 차량 뒤쪽 가운데가 지면에 닿는 위치입니다.
 * turn은 차체가 돌아간 정도로, 왼쪽이 음수, 오른쪽이 양수입니다. 돌아간 반대쪽 옆면이 보입니다.
 */
export function drawCar(ctx: Ctx, x: number, y: number, s: number, color: Color, flames: boolean, turn = 0): void {
  const w = CAR_WIDTH * s;
  const nose = turn * w * 0.09;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(x - w * 0.52, y - 14 * s, w * 1.04, 28 * s);
  if (turn !== 0) {
    const side = -Math.sign(turn);
    const depth = Math.abs(turn) * w * 0.14;
    const edge = x + side * (w / 2 + depth / 2);
    box(ctx, '#111111', edge - side * depth * 0.1, y, depth * 0.8, 70 * s);
    box(ctx, css(shade(color, 0.62)), edge, y - 30 * s, depth, 150 * s);
  }
  box(ctx, '#111111', x - w * 0.38, y, w * 0.18, 70 * s);
  box(ctx, '#111111', x + w * 0.38, y, w * 0.18, 70 * s);
  box(ctx, css(color), x, y - 30 * s, w, 150 * s);
  box(ctx, css(shade(color, 0.8)), x + nose, y - 180 * s, w * 0.72, 110 * s);
  box(ctx, '#1c2733', x + nose, y - 190 * s, w * 0.6, 80 * s);
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

/** 드리프트 중에 뒷바퀴에서 피어오르는 연기를 그립니다. */
function drawSmoke(ctx: Ctx, x: number, y: number, w: number, elapsed: number): void {
  for (let i = 0; i < 6; i++) {
    const age = (elapsed * 2.4 + i / 6) % 1;
    const side = i % 2 === 0 ? -1 : 1;
    const drift = Math.sin(i * 12.9898 + Math.floor(elapsed * 2.4 + i / 6) * 4.1) * w * 0.08;
    disc(
      ctx,
      `rgba(235,235,235,${(0.45 * (1 - age)).toFixed(3)})`,
      x + side * w * 0.38 + drift,
      y - 8 + age * 26,
      10 + age * 30,
    );
  }
}

/** 화면 아래 끝에서 이만큼 위에 차량을 그려서, 그 아래로 타이어 자국이 보이게 합니다. */
const PLAYER_LIFT = 44;

/** 드리프트 중에 뒷바퀴가 지나온 자리에 남는 타이어 자국을 그립니다. 차량이 미끄러져 온 쪽으로 휘어집니다. */
function drawSkidMarks(ctx: Ctx, x: number, y: number, w: number, steer: number): void {
  const trail = -Math.sign(steer) * 46;
  ctx.fillStyle = 'rgba(12,12,14,0.72)';
  for (const side of [-1, 1]) {
    const wheel = x + side * w * 0.38;
    const tread = w * 0.09;
    ctx.beginPath();
    ctx.moveTo(wheel - tread, y - 6);
    ctx.lineTo(wheel + tread, y - 6);
    ctx.lineTo(wheel + trail + tread * 1.5, HEIGHT);
    ctx.lineTo(wheel + trail - tread * 1.5, HEIGHT);
    ctx.closePath();
    ctx.fill();
  }
}

/** 부딪힌 직후 차체가 좌우로 휘청이는 각도. */
export function hitWobble(hitAgo: number): number {
  if (hitAgo < 0 || hitAgo >= 0.6) return 0;
  return Math.sin(hitAgo * 32) * 0.16 * (1 - hitAgo / 0.6);
}

/** steer는 차체가 돌아간 정도로, 왼쪽이 음수, 오른쪽이 양수입니다. */
export function drawPlayer(
  ctx: Ctx,
  player: Player,
  steer: number,
  elapsed: number,
  camera: Camera,
  hitAgo: number,
): void {
  const { ground, scale: s } = playerOnScreen(camera);
  // 카메라가 물러나면 차가 작아지는 만큼 들어 올린 높이도 줄입니다.
  const shrink = s / (WIDTH / 2 / CAMERA_HEIGHT);
  const bounce = Math.sin(elapsed * 40) * (player.speed / MAX_SPEED) * 1.5;
  const x = WIDTH / 2 + steer * 22 * shrink;
  const y = ground - PLAYER_LIFT * shrink + bounce;
  if (player.drifting) {
    drawSkidMarks(ctx, x, y, CAR_WIDTH * s, steer);
    drawSmoke(ctx, x, y, CAR_WIDTH * s, elapsed);
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(steer * 0.045 + hitWobble(hitAgo));
  drawCar(ctx, 0, 0, s, PLAYER_COLOR, player.nitroActive || player.turbo > 0, steer);
  ctx.restore();
  if (player.drifting) drawSparks(ctx, x, y - 6, CAR_WIDTH * s * 0.38, driftLevel(player.driftTime), elapsed);
}
