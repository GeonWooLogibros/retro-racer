import { describe, expect, it } from 'vitest';
import { DRAW_DISTANCE, HEIGHT, MAX_SPEED } from '../src/game/constants';
import { createPlayer } from '../src/game/player';
import { buildTrack } from '../src/game/track';
import { computeVisible } from '../src/render/road';

const track = buildTrack();

describe('computeVisible', () => {
  it('출발 위치에서 그릴 구간을 가까운 순서대로 반환합니다', () => {
    const visible = computeVisible(track, createPlayer());
    expect(visible.length).toBeGreaterThan(100);
    expect(visible.length).toBeLessThanOrEqual(DRAW_DISTANCE);
    for (let i = 1; i < visible.length; i++) {
      expect(visible[i].segment.index).toBe(visible[i - 1].segment.index + 1);
    }
  });

  it('그리는 구간은 화면에서 위쪽으로 이어집니다', () => {
    const visible = computeVisible(track, createPlayer());
    const drawn = visible.filter((v) => v.drawn);
    expect(drawn.length).toBeGreaterThan(50);
    for (const v of drawn) expect(v.p2.y).toBeLessThan(v.p1.y);
    expect(drawn[0].p1.y).toBeGreaterThanOrEqual(HEIGHT);
  });

  it('가림 높이는 멀어질수록 작아지거나 같습니다', () => {
    const visible = computeVisible(track, { ...createPlayer(), z: 400000 });
    expect(visible[0].clip).toBe(HEIGHT);
    for (let i = 1; i < visible.length; i++) {
      expect(visible[i].clip).toBeLessThanOrEqual(visible[i - 1].clip);
    }
  });

  it('안개 농도는 0과 1 사이에서 멀어질수록 커집니다', () => {
    const visible = computeVisible(track, createPlayer());
    for (const v of visible) {
      expect(v.fog).toBeGreaterThanOrEqual(0);
      expect(v.fog).toBeLessThan(1);
    }
    expect(visible[visible.length - 1].fog).toBeGreaterThan(visible[0].fog);
  });

  it('코스 끝에서도 오류 없이 남은 구간만 반환합니다', () => {
    const visible = computeVisible(track, { ...createPlayer(), z: track.length - 1000, speed: MAX_SPEED });
    expect(visible.length).toBeGreaterThan(0);
    expect(visible.length).toBeLessThan(DRAW_DISTANCE);
  });
});
