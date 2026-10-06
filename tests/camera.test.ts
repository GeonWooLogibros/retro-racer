import { describe, expect, it } from 'vitest';
import { CAMERA_DEPTH, CAMERA_HEIGHT, HEIGHT, PLAYER_DISTANCE, WIDTH } from '../src/game/constants';
import { createPlayer } from '../src/game/player';
import { buildTrack } from '../src/game/track';
import { BASE_CAMERA, cameraFor, playerOnScreen, speedLineStrength } from '../src/render/camera';
import { computeVisible } from '../src/render/road';

const track = buildTrack();

describe('cameraFor', () => {
  it('정지 상태에서는 기본 카메라와 같습니다', () => {
    const camera = cameraFor(0, 0, 0);
    expect(camera.depth).toBe(CAMERA_DEPTH);
    expect(camera.distance).toBeCloseTo(PLAYER_DISTANCE, 9);
    expect(camera.shakeX).toBe(0);
    expect(camera.shakeY).toBe(0);
    expect(BASE_CAMERA.distance).toBeCloseTo(PLAYER_DISTANCE, 9);
  });

  it('빠를수록 화각이 넓어지지만 내 차의 크기와 위치는 그대로입니다', () => {
    const slow = playerOnScreen(cameraFor(0, 0, 0));
    const fast = cameraFor(0, 1, 0);
    expect(fast.depth).toBeLessThan(CAMERA_DEPTH);
    expect(playerOnScreen(fast).scale).toBeCloseTo(slow.scale, 9);
    expect(playerOnScreen(fast).ground).toBeCloseTo(slow.ground, 9);
  });

  it('최고 속도를 넘어도 화각은 최고 속도일 때보다 더 넓어지지 않습니다', () => {
    expect(cameraFor(0, 1.3, 0).depth).toBe(cameraFor(0, 1, 0).depth);
  });

  it('니트로 연출 중에는 카메라가 뒤로 물러나서 내 차가 작아지고 위로 올라갑니다', () => {
    const normal = playerOnScreen(cameraFor(0, 1, 0));
    const boosted = playerOnScreen(cameraFor(1, 1, 0));
    expect(boosted.scale).toBeLessThan(normal.scale * 0.8);
    expect(boosted.ground).toBeLessThan(normal.ground - 50);
  });

  it('니트로 연출 중에는 화면이 조금 흔들립니다', () => {
    const shakes = [0.1, 0.2, 0.3, 0.4].map((t) => cameraFor(1, 1, t));
    expect(shakes.some((c) => c.shakeX !== 0 || c.shakeY !== 0)).toBe(true);
    for (const c of shakes) {
      expect(Math.abs(c.shakeX)).toBeLessThanOrEqual(3);
      expect(Math.abs(c.shakeY)).toBeLessThanOrEqual(3);
    }
  });
});

describe('playerOnScreen', () => {
  it('기본 카메라에서는 내 차가 화면 아래 끝에 지금과 같은 크기로 놓입니다', () => {
    const at = playerOnScreen(BASE_CAMERA);
    expect(at.ground).toBeCloseTo(HEIGHT, 6);
    expect(at.scale).toBeCloseTo(WIDTH / 2 / CAMERA_HEIGHT, 9);
  });
});

describe('speedLineStrength', () => {
  it('느릴 때는 없고, 최고 속도 근처에서 옅게, 니트로 연출 중에는 진하게 나옵니다', () => {
    expect(speedLineStrength(0, 0.5)).toBe(0);
    expect(speedLineStrength(0, 0.79)).toBe(0);
    const top = speedLineStrength(0, 1);
    expect(top).toBeGreaterThan(0);
    expect(top).toBeLessThan(0.4);
    expect(speedLineStrength(1, 1)).toBeGreaterThan(top * 2);
    expect(speedLineStrength(1, 1.3)).toBeLessThanOrEqual(1);
  });
});

describe('computeVisible와 카메라', () => {
  it('카메라가 물러나도 가까운 도로는 화면 아래 끝부터 그려집니다', () => {
    const visible = computeVisible(track, { ...createPlayer(), z: 50000 }, cameraFor(1, 1, 0));
    const drawn = visible.filter((v) => v.drawn);
    expect(drawn[0].p1.y).toBeGreaterThanOrEqual(HEIGHT);
  });

  it('카메라를 넘기지 않으면 기본 카메라로 그립니다', () => {
    const player = { ...createPlayer(), z: 50000 };
    expect(computeVisible(track, player)).toEqual(computeVisible(track, player, BASE_CAMERA));
  });
});
