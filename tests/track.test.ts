import { describe, expect, it } from 'vitest';
import { MAX_SPEED, SEGMENT_LENGTH } from '../src/game/constants';
import { buildTrack, heightAt, segmentAt } from '../src/game/track';

const track = buildTrack();

describe('buildTrack', () => {
  it('구간 5개와 꼬리 구간으로 구성됩니다', () => {
    expect(track.segments).toHaveLength(5 * 1800 + 300);
    expect(track.length).toBe(track.segments.length * SEGMENT_LENGTH);
  });

  it('체크포인트 4개가 구간 경계에 오름차순으로 있습니다', () => {
    expect(track.checkpoints).toEqual([360000, 720000, 1080000, 1440000]);
    expect(track.finishZ).toBe(1800000);
  });

  it('최고 속도로 달리면 결승점까지 150초가 걸립니다', () => {
    expect(track.finishZ / MAX_SPEED).toBe(150);
  });

  it('구간마다 테마 번호가 지정됩니다', () => {
    expect(track.segments[0].section).toBe(0);
    expect(track.segments[1799].section).toBe(0);
    expect(track.segments[1800].section).toBe(1);
    expect(track.segments[8999].section).toBe(4);
    expect(track.segments[9299].section).toBe(4);
  });

  it('체크포인트와 결승점 구간에 구조물 표시가 있습니다', () => {
    expect(track.segments[1800].gate).toBe('checkpoint');
    expect(track.segments[7200].gate).toBe('checkpoint');
    expect(track.segments[9000].gate).toBe('finish');
    expect(track.segments.filter((s) => s.gate !== null)).toHaveLength(5);
  });

  it('인접한 구간의 높이가 이어집니다', () => {
    for (let i = 1; i < track.segments.length; i++) {
      expect(track.segments[i].y1).toBe(track.segments[i - 1].y2);
    }
  });

  it('길가 사물은 모두 도로 밖에 있습니다', () => {
    const props = track.segments.flatMap((s) => s.props);
    expect(props.length).toBeGreaterThan(1000);
    for (const prop of props) expect(Math.abs(prop.offset)).toBeGreaterThan(1);
  });

  it('커브와 언덕이 있습니다', () => {
    expect(track.segments.some((s) => s.curve > 0)).toBe(true);
    expect(track.segments.some((s) => s.curve < 0)).toBe(true);
    expect(track.segments.some((s) => s.y2 !== 0)).toBe(true);
  });

  it('매번 같은 코스를 만듭니다', () => {
    expect(buildTrack()).toEqual(track);
  });
});

describe('segmentAt', () => {
  it('위치에 해당하는 구간을 반환합니다', () => {
    expect(segmentAt(track, 0).index).toBe(0);
    expect(segmentAt(track, 450).index).toBe(2);
  });

  it('범위를 벗어난 위치는 양 끝 구간으로 제한합니다', () => {
    expect(segmentAt(track, -5000).index).toBe(0);
    expect(segmentAt(track, track.length + 5000).index).toBe(track.segments.length - 1);
    expect(segmentAt(track, Number.NaN).index).toBe(0);
  });
});

describe('heightAt', () => {
  it('구간 안에서 높이를 보간합니다', () => {
    const seg = track.segments.find((s) => s.y1 !== s.y2)!;
    const z = seg.index * SEGMENT_LENGTH + SEGMENT_LENGTH / 2;
    expect(heightAt(track, z)).toBeCloseTo((seg.y1 + seg.y2) / 2, 6);
  });
});
