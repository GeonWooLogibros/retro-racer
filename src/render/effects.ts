import { HEIGHT, WIDTH } from '../game/constants';
import type { GameEvent } from '../game/types';
import { drawText } from './text';

/** 화면 가운데에 잠깐 떠오르는 글자. */
export interface Popup {
  text: string;
  /** 큰 글자 아래의 작은 글자. */
  sub: string | null;
  color: string;
  /** 'main'은 가운데의 칭찬 글자, 'side'는 부스터 칸 위의 알림입니다. 같은 자리의 글자는 새것이 덮습니다. */
  slot: 'main' | 'side';
  born: number;
}

export const POPUP_LIFE = 0.9;

/** 연속 보너스 횟수에 따른 칭찬 글자. */
export function comboLabel(combo: number): string {
  if (combo >= 6) return 'PERFECT!';
  if (combo >= 4) return 'EXCELLENT!';
  if (combo >= 2) return 'GREAT!';
  return 'NICE!';
}

const COMBO_COLORS = ['#ffffff', '#7ee8ff', '#ffd43b', '#ff6bd6'];

function comboColor(combo: number): string {
  return COMBO_COLORS[Math.min(COMBO_COLORS.length - 1, Math.floor((combo - 1) / 2))];
}

/** 한 단계에서 일어난 사건으로 새로 띄울 글자를 만듭니다. */
export function popupsFor(events: GameEvent[], combo: number, clock: number, rank = 0): Popup[] {
  const popups: Popup[] = [];
  const sub = combo >= 2 ? `콤보 ×${combo}` : null;
  if (events.includes('counterBoost')) {
    popups.push({ text: '순간 부스터!', sub, color: '#7ee8ff', slot: 'main', born: clock });
  } else if (events.includes('overtake')) {
    popups.push({ text: `${rank}위!`, sub, color: rank === 1 ? '#ffd43b' : '#ffffff', slot: 'main', born: clock });
  } else if (events.includes('turbo')) {
    popups.push({ text: comboLabel(combo), sub, color: comboColor(combo), slot: 'main', born: clock });
  }
  if (events.includes('boosterReady')) {
    popups.push({ text: '부스터 충전!', sub: null, color: '#ffa94d', slot: 'side', born: clock });
  }
  return popups;
}

/** 새 글자를 더하고, 같은 자리의 이전 글자와 수명이 다한 글자를 지웁니다. */
export function mergePopups(current: Popup[], added: Popup[], clock: number): Popup[] {
  const slots = new Set(added.map((popup) => popup.slot));
  return [...current.filter((popup) => !slots.has(popup.slot) && clock - popup.born < POPUP_LIFE), ...added];
}

export function drawPopups(ctx: CanvasRenderingContext2D, popups: Popup[], clock: number): void {
  for (const popup of popups) {
    const age = clock - popup.born;
    if (age < 0 || age >= POPUP_LIFE) continue;
    // 처음에는 크게 튀어나왔다가 제자리로 줄어들고, 끝에서는 위로 떠오르며 사라집니다.
    const pop = age < 0.12 ? 1.7 - 0.7 * (age / 0.12) : 1;
    const fade = age > 0.6 ? 1 - (age - 0.6) / (POPUP_LIFE - 0.6) : 1;
    const main = popup.slot === 'main';
    const x = main ? WIDTH / 2 : 150;
    const y = (main ? 168 : HEIGHT - 150) - age * 28;
    ctx.save();
    ctx.globalAlpha = Math.max(0, fade);
    ctx.translate(x, y);
    ctx.scale(pop, pop);
    drawText(ctx, popup.text, 0, -22, main ? 44 : 22, 'center', popup.color);
    if (popup.sub) drawText(ctx, popup.sub, 0, 28, 20, 'center', '#ffffff');
    ctx.restore();
  }
}

/** 부스터를 켤 때의 번쩍임과, 터보가 붙을 때 화면 가장자리의 빛을 그립니다. */
export function drawFlashes(ctx: CanvasRenderingContext2D, flashAgo: number, turboAgo: number): void {
  if (flashAgo < 0.25) {
    ctx.fillStyle = `rgba(255,255,255,${(0.4 * (1 - flashAgo / 0.25)).toFixed(3)})`;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }
  if (turboAgo < 0.4) {
    const strength = 1 - turboAgo / 0.4;
    const glow = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, HEIGHT * 0.35, WIDTH / 2, HEIGHT / 2, WIDTH * 0.62);
    glow.addColorStop(0, 'rgba(255,170,60,0)');
    glow.addColorStop(1, `rgba(255,170,60,${(0.45 * strength).toFixed(3)})`);
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }
}

/** 드리프트 단계별 불꽃 색. 파랑, 주황, 보라 순서입니다. */
export const SPARK_COLORS = ['#5ac8ff', '#ffa94d', '#d08bff'];

/** 드리프트 중 뒷바퀴(또는 발밑)에서 튀는 불꽃을 그립니다. level이 0이면 그리지 않습니다. */
export function drawSparks(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  spread: number,
  level: number,
  clock: number,
): void {
  if (level <= 0) return;
  ctx.save();
  ctx.strokeStyle = SPARK_COLORS[level - 1];
  ctx.fillStyle = SPARK_COLORS[level - 1];
  ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    const wheel = x + side * spread;
    for (let i = 0; i < 3 + level * 2; i++) {
      const seed = Math.sin(i * 12.9898 + Math.floor(clock * 30) * 78.233 + side) * 43758.5453;
      const r = seed - Math.floor(seed);
      const angle = Math.PI * (0.55 + r * 0.9) + (side > 0 ? 0 : 0.1);
      const length = 10 + r * (8 + level * 8);
      ctx.lineWidth = 1.5 + level * 0.5;
      ctx.beginPath();
      ctx.moveTo(wheel, y);
      ctx.lineTo(wheel + Math.cos(angle) * length * side, y - Math.sin(angle) * length * 0.6);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(wheel, y - 2, 4 + level * 2, 0, Math.PI * 2);
    ctx.globalAlpha = 0.5;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}
