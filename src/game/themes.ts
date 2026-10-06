import { THEME_BLEND_SECONDS } from './constants';
import type { Color, Theme } from './types';

export function lerpColor(a: Color, b: Color, t: number): Color {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

/** 우주 지형에서 하늘과 땅이 바뀌어 가는 색. */
export const SPACE_THEME: Theme = {
  name: '우주',
  skyTop: [2, 2, 12],
  skyBottom: [26, 10, 54],
  ground: [6, 6, 22],
  road: [38, 22, 84],
  rumble: [60, 240, 255],
  lane: [150, 255, 255],
  fog: [10, 8, 30],
};

/** 다리 아래와 여울에 흐르는 것의 색. 하늘이 어두울수록 물도 어둡습니다. */
export function liquidOf(theme: Theme): Color {
  if (theme.liquid) return theme.liquid;
  return lerpColor([18, 50, 95], [70, 160, 215], Math.min(1, luminance(theme.skyBottom) / 200));
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
    liquid: liquidOf(t < 0.5 ? a : b),
  };
}

/** section은 지금까지 통과한 체크포인트 수, sinceCheckpoint는 마지막 통과 후 지난 시간(초)입니다. */
export function currentTheme(themes: Theme[], section: number, sinceCheckpoint: number): Theme {
  const index = Math.min(Math.max(section, 0), themes.length - 1);
  if (index === 0) return themes[0];
  const t = Math.min(1, Math.max(0, sinceCheckpoint / THEME_BLEND_SECONDS));
  return lerpTheme(themes[index - 1], themes[index], t);
}

export function css(color: Color, alpha = 1): string {
  return alpha >= 1 ? `rgb(${color[0]},${color[1]},${color[2]})` : `rgba(${color[0]},${color[1]},${color[2]},${alpha})`;
}

export function shade(color: Color, factor: number): Color {
  return [Math.round(color[0] * factor), Math.round(color[1] * factor), Math.round(color[2] * factor)];
}

export function luminance(color: Color): number {
  return 0.299 * color[0] + 0.587 * color[1] + 0.114 * color[2];
}
