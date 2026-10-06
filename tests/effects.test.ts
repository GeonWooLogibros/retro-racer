import { describe, expect, it } from 'vitest';
import { POPUP_LIFE, comboLabel, mergePopups, popupsFor } from '../src/render/effects';

describe('comboLabel', () => {
  it('연속 횟수가 늘수록 칭찬이 커집니다', () => {
    expect([1, 2, 3, 4, 5, 6, 12].map(comboLabel)).toEqual([
      'NICE!',
      'GREAT!',
      'GREAT!',
      'EXCELLENT!',
      'EXCELLENT!',
      'PERFECT!',
      'PERFECT!',
    ]);
  });
});

describe('popupsFor', () => {
  it('터보에는 칭찬 글자를, 두 번째부터는 콤보 횟수도 띄웁니다', () => {
    expect(popupsFor(['turbo'], 1, 0)).toMatchObject([{ text: 'NICE!', sub: null, slot: 'main' }]);
    expect(popupsFor(['turbo'], 4, 0)).toMatchObject([{ text: 'EXCELLENT!', sub: '콤보 ×4' }]);
  });

  it('순간 부스터는 칭찬 대신 전용 글자를 띄웁니다', () => {
    expect(popupsFor(['turbo', 'counterBoost'], 2, 0)).toMatchObject([{ text: '순간 부스터!', sub: '콤보 ×2' }]);
  });

  it('라이벌을 제치면 바뀐 순위를 띄웁니다', () => {
    expect(popupsFor(['overtake', 'turbo'], 3, 0, 2)).toMatchObject([{ text: '2위!', sub: '콤보 ×3' }]);
  });

  it('부스터가 충전되면 옆자리에 알림을 띄웁니다', () => {
    expect(popupsFor(['boosterReady'], 0, 0)).toMatchObject([{ text: '부스터 충전!', slot: 'side' }]);
  });

  it('다른 사건에는 글자를 띄우지 않습니다', () => {
    expect(popupsFor(['crash', 'bump', 'checkpoint'], 0, 0)).toEqual([]);
  });
});

describe('mergePopups', () => {
  it('같은 자리의 글자는 새것으로 바꾸고 다른 자리의 글자는 남깁니다', () => {
    const old = [...popupsFor(['turbo'], 1, 0), ...popupsFor(['boosterReady'], 0, 0)];
    const merged = mergePopups(old, popupsFor(['turbo'], 2, 0.2), 0.2);
    expect(merged.map((popup) => popup.text)).toEqual(['부스터 충전!', 'GREAT!']);
  });

  it('수명이 다한 글자는 지웁니다', () => {
    expect(mergePopups(popupsFor(['turbo'], 1, 0), [], POPUP_LIFE + 0.01)).toEqual([]);
  });
});
