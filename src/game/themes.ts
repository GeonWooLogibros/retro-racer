import { THEME_BLEND_SECONDS } from './constants';
import type { Color, Theme } from './types';

export const THEMES: Theme[] = [
  {
    name: '해변',
    skyTop: [60, 150, 230],
    skyBottom: [170, 220, 250],
    ground: [230, 205, 140],
    road: [105, 105, 110],
    rumble: [220, 60, 60],
    lane: [240, 240, 240],
    fog: [190, 225, 245],
  },
  {
    name: '사막',
    skyTop: [235, 110, 50],
    skyBottom: [250, 200, 120],
    ground: [200, 150, 80],
    road: [115, 100, 90],
    rumble: [200, 80, 30],
    lane: [245, 235, 210],
    fog: [245, 195, 130],
  },
  {
    name: '숲',
    skyTop: [90, 180, 170],
    skyBottom: [190, 230, 215],
    ground: [30, 95, 50],
    road: [90, 95, 95],
    rumble: [230, 230, 60],
    lane: [240, 240, 240],
    fog: [170, 215, 200],
  },
  {
    name: '야간 도시',
    skyTop: [10, 12, 40],
    skyBottom: [45, 35, 90],
    ground: [35, 35, 45],
    road: [55, 55, 65],
    rumble: [60, 200, 230],
    lane: [250, 220, 90],
    fog: [30, 28, 60],
  },
  {
    name: '새벽',
    skyTop: [110, 90, 170],
    skyBottom: [250, 170, 170],
    ground: [130, 190, 110],
    road: [100, 100, 105],
    rumble: [240, 90, 150],
    lane: [240, 240, 240],
    fog: [240, 190, 190],
  },
];

export function lerpColor(a: Color, b: Color, t: number): Color {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

export function lerpTheme(a: Theme, b: Theme, t: number): Theme {
  return {
    name: t < 0.5 ? a.name : b.name,
    skyTop: lerpColor(a.skyTop, b.skyTop, t),
    skyBottom: lerpColor(a.skyBottom, b.skyBottom, t),
    ground: lerpColor(a.ground, b.ground, t),
    road: lerpColor(a.road, b.road, t),
    rumble: lerpColor(a.rumble, b.rumble, t),
    lane: lerpColor(a.lane, b.lane, t),
    fog: lerpColor(a.fog, b.fog, t),
  };
}

/** section은 지금까지 통과한 체크포인트 수, sinceCheckpoint는 마지막 통과 후 지난 시간(초)입니다. */
export function currentTheme(section: number, sinceCheckpoint: number): Theme {
  const index = Math.min(Math.max(section, 0), THEMES.length - 1);
  if (index === 0) return THEMES[0];
  const t = Math.min(1, Math.max(0, sinceCheckpoint / THEME_BLEND_SECONDS));
  return lerpTheme(THEMES[index - 1], THEMES[index], t);
}

export function css(color: Color, alpha = 1): string {
  return alpha >= 1
    ? `rgb(${color[0]},${color[1]},${color[2]})`
    : `rgba(${color[0]},${color[1]},${color[2]},${alpha})`;
}

export function shade(color: Color, factor: number): Color {
  return [Math.round(color[0] * factor), Math.round(color[1] * factor), Math.round(color[2] * factor)];
}

export function luminance(color: Color): number {
  return 0.299 * color[0] + 0.587 * color[1] + 0.114 * color[2];
}
