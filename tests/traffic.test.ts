import { describe, expect, it } from 'vitest';
import { CAR_LENGTH, MAX_SPEED, START_Z, STEP, TRAFFIC_ACTIVE_DISTANCE } from '../src/game/constants';
import { createPlayer } from '../src/game/player';
import { buildTrack } from '../src/game/track';
import { createTraffic, updateTraffic } from '../src/game/traffic';
import type { Car, Player } from '../src/game/types';

const track = buildTrack();
const player = (over: Partial<Player>): Player => ({ ...createPlayer(), z: 100000, ...over });
const car = (over: Partial<Car>): Car => ({ z: 0, offset: 0, speed: 3000, passed: false, color: 0, ...over });

describe('createTraffic', () => {
  it('차량 40대를 위치 순서대로 배치합니다', () => {
    const cars = createTraffic(track);
    expect(cars).toHaveLength(40);
    for (let i = 1; i < cars.length; i++) expect(cars[i].z).toBeGreaterThanOrEqual(cars[i - 1].z);
  });

  it('모든 차량은 출발점과 결승점 사이에 있고 플레이어보다 느립니다', () => {
    for (const c of createTraffic(track)) {
      expect(c.z).toBeGreaterThan(START_Z);
      expect(c.z).toBeLessThan(track.finishZ);
      expect(c.speed).toBeLessThan(MAX_SPEED);
      expect(Math.abs(c.offset)).toBeLessThan(1);
      expect(c.passed).toBe(false);
    }
  });

  it('시드가 같으면 배치가 동일합니다', () => {
    expect(createTraffic(track)).toEqual(createTraffic(track));
    expect(createTraffic(track, 1)).not.toEqual(createTraffic(track, 2));
  });

  it('야간 도시 구간에 차량이 더 많습니다', () => {
    const cars = createTraffic(track);
    const count = (from: number, to: number): number => cars.filter((c) => c.z >= from && c.z < to).length;
    expect(count(track.checkpoints[2], track.checkpoints[3])).toBeGreaterThan(
      count(track.checkpoints[0], track.checkpoints[1]),
    );
  });
});

describe('updateTraffic', () => {
  it('가까운 차량만 움직입니다', () => {
    const p = player({});
    const near = car({ z: p.z + 10000 });
    const far = car({ z: p.z + TRAFFIC_ACTIVE_DISTANCE + 1000 });
    const result = updateTraffic([near, far], p, track, STEP);
    expect(result.cars[0].z).toBeCloseTo(near.z + 3000 * STEP, 6);
    expect(result.cars[1].z).toBe(far.z);
  });

  it('뒤를 들이받으면 속도가 그 차량보다 낮아지고 니트로가 종료됩니다', () => {
    const p = player({ speed: MAX_SPEED, nitroActive: true, nitro: 50 });
    const result = updateTraffic([car({ z: p.z + 100 })], p, track, STEP);
    expect(result.events).toEqual(['crash']);
    expect(result.player.speed).toBe(1500);
    expect(result.player.nitroActive).toBe(false);
    expect(result.player.z).toBeCloseTo(result.cars[0].z - CAR_LENGTH, 6);
  });

  it('충돌 직후에는 다시 충돌하지 않습니다', () => {
    const p = player({ speed: MAX_SPEED });
    const first = updateTraffic([car({ z: p.z + 100 })], p, track, STEP);
    const second = updateTraffic(first.cars, first.player, track, STEP);
    expect(second.events).toEqual([]);
  });

  it('좌우 간격이 넓으면 충돌하지 않습니다', () => {
    const p = player({ speed: MAX_SPEED, x: 0.5 });
    const result = updateTraffic([car({ z: p.z + 100 })], p, track, STEP);
    expect(result.events).toEqual([]);
    expect(result.player.speed).toBe(MAX_SPEED);
  });

  it('가깝게 스치며 추월하면 게이지가 25 증가합니다', () => {
    const p = player({ speed: MAX_SPEED, nitro: 10 });
    const result = updateTraffic([car({ z: p.z - 400, offset: 0.4 })], p, track, STEP);
    expect(result.events).toEqual(['nearMiss']);
    expect(result.player.nitro).toBe(35);
    expect(result.cars[0].passed).toBe(true);
  });

  it('간격을 두고 추월하면 게이지가 5 증가합니다', () => {
    const p = player({ speed: MAX_SPEED, x: -0.3, nitro: 10 });
    const result = updateTraffic([car({ z: p.z - 400, offset: 0.6 })], p, track, STEP);
    expect(result.events).toEqual(['pass']);
    expect(result.player.nitro).toBe(15);
  });

  it('같은 차량을 두 번 계산하지 않습니다', () => {
    const p = player({ speed: MAX_SPEED });
    const first = updateTraffic([car({ z: p.z - 400, offset: 0.4 })], p, track, STEP);
    const second = updateTraffic(first.cars, first.player, track, STEP);
    expect(second.events).toEqual([]);
    expect(second.player.nitro).toBe(25);
  });

  it('게이지는 100을 넘지 않습니다', () => {
    const p = player({ speed: MAX_SPEED, nitro: 90 });
    const result = updateTraffic([car({ z: p.z - 400, offset: 0.4 })], p, track, STEP);
    expect(result.player.nitro).toBe(100);
  });

  it('차량은 코스 끝을 넘어가지 않습니다', () => {
    const p = player({ z: track.length - 2000 });
    let cars = [car({ z: track.length - 500, speed: 6000 })];
    for (let i = 0; i < 120; i++) cars = updateTraffic(cars, p, track, STEP).cars;
    expect(cars[0].z).toBeLessThan(track.length);
  });
});
