import { describe, expect, it } from 'vitest';
import { MAX_SPEED, SEGMENT_LENGTH } from '../src/game/constants';
import { MAPS } from '../src/game/maps';
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

  it('구간마다 가장 급한 커브의 세기가 정해져 있습니다', () => {
    const sharpest = (section: number): number =>
      Math.max(...track.segments.filter((s) => s.section === section).map((s) => Math.abs(s.curve)));
    expect([0, 1, 2, 3, 4].map(sharpest)).toEqual([5, 6, 8, 8, 7]);
  });

  it('급커브의 길가 사물은 바깥쪽 도로 가까이에 있습니다', () => {
    const sharp = track.segments.filter((s) => Math.abs(s.curve) >= 5 && s.props.length > 0);
    expect(sharp.length).toBeGreaterThan(100);
    for (const segment of sharp) {
      for (const prop of segment.props) {
        expect(Math.sign(prop.offset)).toBe(-Math.sign(segment.curve));
        if (prop.kind === 'building') expect(Math.abs(prop.offset)).toBeGreaterThanOrEqual(2.6);
        else expect(Math.abs(prop.offset) / Math.max(1, segment.width)).toBeLessThan(1.8);
      }
    }
  });

  it('매번 같은 코스를 만듭니다', () => {
    expect(buildTrack()).toEqual(track);
  });
});

describe('지형', () => {
  it('구간마다 지형과 폭이 있고, 폭은 지형이 바뀌는 곳에서 조금씩 변합니다', () => {
    const widths = track.segments.map((s) => s.width);
    const steps = widths.slice(1).map((width, i) => Math.abs(width - widths[i]));
    expect(Math.min(...widths)).toBeGreaterThanOrEqual(0.6 - 1e-9);
    expect(Math.max(...widths)).toBeLessThanOrEqual(1.25 + 1e-9);
    expect(Math.max(...steps)).toBeLessThan(0.06);
    expect(track.segments.every((s) => s.terrain.width > 0)).toBe(true);
  });

  it('지형 한가운데의 폭은 그 지형의 폭과 같습니다', () => {
    const middle = track.segments[400];
    expect(middle.width).toBeCloseTo(middle.terrain.width, 9);
  });

  it('다리, 여울, 우주에는 길가 사물이 없습니다', () => {
    for (const map of MAPS) {
      for (const segment of buildTrack(map).segments) {
        if (['bridge', 'ford', 'space'].includes(segment.terrain.kind)) expect(segment.props).toEqual([]);
      }
    }
  });

  it('우주 지형 한가운데에서는 space가 1이고, 멀리 떨어진 곳에서는 0입니다', () => {
    const sakura = buildTrack(MAPS.find((map) => map.id === 'sakura')!);
    const run = sakura.segments.filter((s) => s.terrain.kind === 'space');
    expect(run.length).toBeGreaterThan(100);
    expect(run[Math.floor(run.length / 2)].space).toBe(1);
    expect(sakura.segments[0].space).toBe(0);
    for (const segment of sakura.segments) {
      expect(segment.space).toBeGreaterThanOrEqual(0);
      expect(segment.space).toBeLessThanOrEqual(1);
    }
  });
});

describe('시드', () => {
  const curves = (t: typeof track): number[] => t.segments.map((s) => s.curve);

  it('시드가 0이면 맵에 적힌 순서 그대로입니다', () => {
    expect(buildTrack(MAPS[0], 0)).toEqual(track);
    expect(track.seed).toBe(0);
  });

  it('같은 시드는 같은 코스를 만들고, 다른 시드는 다른 코스를 만듭니다', () => {
    expect(buildTrack(MAPS[0], 5)).toEqual(buildTrack(MAPS[0], 5));
    expect(curves(buildTrack(MAPS[0], 5))).not.toEqual(curves(buildTrack(MAPS[0], 6)));
    expect(curves(buildTrack(MAPS[0], 5))).not.toEqual(curves(track));
  });

  it('시드가 달라도 길이, 체크포인트, 출발 직선은 같습니다', () => {
    for (const seed of [1, 2, 3]) {
      const other = buildTrack(MAPS[0], seed);
      expect(other.segments).toHaveLength(track.segments.length);
      expect(other.checkpoints).toEqual(track.checkpoints);
      expect(other.finishZ).toBe(track.finishZ);
      expect(other.segments.slice(0, 150).every((s) => s.curve === 0)).toBe(true);
    }
  });

  it('시드가 달라도 구간마다 지형이 이어지는 순서와 커브의 세기는 같습니다', () => {
    const order = (t: typeof track, section: number): string[] =>
      t.segments
        .filter((s) => s.section === section)
        .map((s) => s.terrain.kind + s.terrain.lanes)
        .filter((kind, i, all) => kind !== all[i - 1]);
    const strength = (t: typeof track): number[] => t.segments.map((s) => Math.abs(s.curve)).sort((a, b) => a - b);
    const other = buildTrack(MAPS[0], 9);
    for (let section = 0; section < 5; section++) expect(order(other, section)).toEqual(order(track, section));
    const a = strength(other);
    const b = strength(track);
    for (let i = 0; i < a.length; i += 97) expect(a[i]).toBeCloseTo(b[i], 9);
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
