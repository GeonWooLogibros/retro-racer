import { describe, expect, it } from 'vitest';
import { CAR_HIT_WIDTH, CAR_LENGTH, MAX_SPEED, RIVAL_BUMP_KEEP, START_Z, STEP } from '../src/game/constants';
import { MAPS } from '../src/game/maps';
import { createPlayer } from '../src/game/player';
import { createRivals, finishRankOf, rankOf, updateRivals } from '../src/game/rivals';
import { buildTrack } from '../src/game/track';
import type { Rival } from '../src/game/types';

const track = buildTrack();
const rival = (over: Partial<Rival>): Rival => ({ ...createRivals(track)[0], ...over });

describe('createRivals', () => {
  it('라이벌 다섯 명이 플레이어보다 앞에 서고, 플레이어는 6위로 출발합니다', () => {
    const rivals = createRivals(track);
    expect(rivals).toHaveLength(5);
    for (const r of rivals) expect(r.z).toBeGreaterThan(START_Z);
    expect(rankOf(rivals)).toBe(6);
    expect(new Set(rivals.map((r) => r.name)).size).toBe(5);
  });

  it('맵 난이도가 높을수록 라이벌의 실력이 높습니다', () => {
    const average = (index: number): number => {
      const rivals = createRivals(buildTrack(MAPS[index]));
      return rivals.reduce((sum, r) => sum + r.skill, 0) / rivals.length;
    };
    const easy = MAPS.findIndex((map) => map.difficulty === 1);
    const hard = MAPS.findIndex((map) => map.difficulty === 5);
    expect(average(hard)).toBeGreaterThan(average(easy));
  });
});

describe('순위', () => {
  it('결승점에서는 실제 위치로 플레이어보다 앞선 라이벌 수에 1을 더합니다', () => {
    const p = { ...createPlayer(), z: 10000 };
    expect(finishRankOf(p, [rival({ z: 9000 }), rival({ z: 12000 }), rival({ z: 10000 })])).toBe(2);
  });

  it('달리는 중에는 차 한 대 길이 이상 벌어져야 앞뒤가 바뀝니다', () => {
    const p = { ...createPlayer(), z: 60000, speed: 0 };
    const still = { speed: 0, skill: 0, boostBlock: 99999 };
    const near = updateRivals([rival({ ...still, z: 60000 - CAR_LENGTH / 2, ahead: true })], p, track, STEP).rivals;
    expect(rankOf(near)).toBe(2);
    const far = updateRivals([rival({ ...still, z: 60000 - CAR_LENGTH * 2, ahead: true })], p, track, STEP).rivals;
    expect(rankOf(far)).toBe(1);
    const back = updateRivals([rival({ ...still, z: 60000 + CAR_LENGTH / 2, ahead: false })], p, track, STEP).rivals;
    expect(rankOf(back)).toBe(1);
  });
});

describe('updateRivals', () => {
  it('출발하면 속도를 올려 앞으로 나아갑니다', () => {
    let rivals = createRivals(track);
    const p = createPlayer();
    for (let i = 0; i < 120; i++) rivals = updateRivals(rivals, p, track, STEP).rivals;
    for (const r of rivals) {
      expect(r.speed).toBeGreaterThan(0);
      expect(r.z).toBeGreaterThan(START_Z);
    }
  });

  it('최고 속도는 실력 배율을 따르고 부스터 없이는 넘지 않습니다', () => {
    let rivals = [rival({ z: 30000, speed: MAX_SPEED, skill: 0.95, boostBlock: 99999 })];
    const p = { ...createPlayer(), z: 30000 };
    for (let i = 0; i < 60; i++) {
      rivals = updateRivals(rivals, { ...p, z: rivals[0].z }, track, STEP).rivals.map((r) => ({ ...r, boost: 0 }));
    }
    expect(rivals[0].speed).toBeLessThanOrEqual(MAX_SPEED * 0.95 + 1e-6);
  });

  it('플레이어보다 많이 뒤처지면 따라잡고, 많이 앞서면 기다립니다', () => {
    const p = { ...createPlayer(), z: 200000, speed: MAX_SPEED };
    const base = { speed: MAX_SPEED, skill: 1, boost: 0, boostBlock: 99999 };
    let behind = [rival({ ...base, z: 150000 })];
    let ahead = [rival({ ...base, z: 260000 })];
    for (let i = 0; i < 120; i++) {
      behind = updateRivals(behind, p, track, STEP).rivals.map((r) => ({ ...r, boost: 0, boostBlock: 99999 }));
      ahead = updateRivals(ahead, p, track, STEP).rivals.map((r) => ({ ...r, boost: 0, boostBlock: 99999 }));
    }
    expect(behind[0].speed).toBeGreaterThan(MAX_SPEED);
    expect(ahead[0].speed).toBeLessThan(MAX_SPEED);
  });

  it('라이벌의 뒤를 들이받으면 조금 느려지면서 옆으로 튕겨 나가고, 모아 둔 부스터는 남습니다', () => {
    const p = { ...createPlayer(), z: 50000, x: 0.05, speed: MAX_SPEED, boosters: 1, gauge: 30 };
    const result = updateRivals([rival({ z: 50100, x: 0, speed: MAX_SPEED * 0.6 })], p, track, STEP);
    expect(result.events).toEqual(['bump']);
    expect(result.player.speed).toBeCloseTo(MAX_SPEED * RIVAL_BUMP_KEEP, 6);
    expect(result.player.x - result.rivals[0].x).toBeGreaterThan(CAR_HIT_WIDTH);
    expect(result.player.boosters).toBe(1);
    expect(result.player.gauge).toBe(30);
    const again = updateRivals(result.rivals, result.player, track, STEP);
    expect(again.events).toEqual([]);
  });

  it('다리 위에서 부딪히면 도로 안쪽으로 튕겨서 떨어지지 않습니다', () => {
    const bridge = track.segments.find((s) => s.terrain.kind === 'bridge' && s.width < 0.65)!;
    const z = bridge.index * 200 + 50;
    const p = { ...createPlayer(), z, x: 0.5, speed: MAX_SPEED };
    const result = updateRivals([rival({ z: z + 100, x: 0.45, speed: MAX_SPEED * 0.6 })], p, track, STEP);
    expect(result.events).toEqual(['bump']);
    expect(Math.abs(result.player.x)).toBeLessThanOrEqual(bridge.width);
    expect(result.player.x).toBeLessThan(0.45);
  });

  it('부딪혀도 라이벌보다 느려지지는 않습니다', () => {
    const p = { ...createPlayer(), z: 50000, x: 0, speed: MAX_SPEED * 0.62 };
    const result = updateRivals([rival({ z: 50100, x: 0, speed: MAX_SPEED * 0.6 })], p, track, STEP);
    expect(result.player.speed).toBeGreaterThanOrEqual(result.rivals[0].speed);
  });

  it('같은 코스에서는 라이벌이 늘 같은 곳에서 부스터를 씁니다', () => {
    const run = (): number[] => {
      let rivals = createRivals(track);
      const boosts: number[] = [];
      for (let i = 0; i < 60 * 60; i++) {
        rivals = updateRivals(rivals, { ...createPlayer(), z: rivals[2].z }, track, STEP).rivals;
        if (rivals[0].boost > 1.19) boosts.push(Math.round(rivals[0].z));
      }
      return boosts;
    };
    const first = run();
    expect(first.length).toBeGreaterThan(0);
    expect(run()).toEqual(first);
    // 부스터를 쓰는 곳은 묶음마다 정해지므로, 모든 묶음에서 쓰지는 않습니다.
    expect(first.length).toBeLessThan(18);
  });
});
