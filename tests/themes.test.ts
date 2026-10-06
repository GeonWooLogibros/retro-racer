import { describe, expect, it } from 'vitest';
import { MAPS } from '../src/game/maps';
import { css, currentTheme, lerpColor, luminance, shade } from '../src/game/themes';

const THEMES = MAPS[0].sections.map((section) => section.theme);

describe('lerpColor', () => {
  it('양 끝과 중간 값을 계산합니다', () => {
    expect(lerpColor([0, 0, 0], [100, 200, 50], 0)).toEqual([0, 0, 0]);
    expect(lerpColor([0, 0, 0], [100, 200, 50], 1)).toEqual([100, 200, 50]);
    expect(lerpColor([0, 0, 0], [100, 200, 50], 0.5)).toEqual([50, 100, 25]);
  });
});

describe('currentTheme', () => {
  it('테마는 5개입니다', () => {
    expect(THEMES).toHaveLength(5);
  });

  it('첫 구간에서는 첫 테마를 그대로 사용합니다', () => {
    expect(currentTheme(THEMES, 0, 0)).toBe(THEMES[0]);
  });

  it('체크포인트 직후에는 이전 테마의 색으로 시작합니다', () => {
    expect(currentTheme(THEMES, 1, 0).skyTop).toEqual(THEMES[0].skyTop);
  });

  it('2초가 지나면 다음 테마의 색이 됩니다', () => {
    expect(currentTheme(THEMES, 1, 2).skyTop).toEqual(THEMES[1].skyTop);
    expect(currentTheme(THEMES, 1, 99).ground).toEqual(THEMES[1].ground);
  });

  it('전환 도중에는 두 테마의 중간 색입니다', () => {
    expect(currentTheme(THEMES, 1, 1).skyTop).toEqual(lerpColor(THEMES[0].skyTop, THEMES[1].skyTop, 0.5));
  });

  it('구간 번호가 범위를 넘으면 마지막 테마를 사용합니다', () => {
    expect(currentTheme(THEMES, 9, 99).skyTop).toEqual(THEMES[4].skyTop);
  });
});

describe('색 도우미', () => {
  it('css 문자열을 만듭니다', () => {
    expect(css([1, 2, 3])).toBe('rgb(1,2,3)');
    expect(css([1, 2, 3], 0.5)).toBe('rgba(1,2,3,0.5)');
  });

  it('shade는 각 성분에 배율을 곱합니다', () => {
    expect(shade([100, 200, 50], 0.5)).toEqual([50, 100, 25]);
  });

  it('luminance는 밝은 색에서 더 큽니다', () => {
    expect(luminance([255, 255, 255])).toBeGreaterThan(luminance([10, 12, 40]));
  });
});
