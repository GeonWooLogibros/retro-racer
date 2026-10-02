import { describe, expect, it } from 'vitest';
import { CAMERA_HEIGHT, HEIGHT, PLAYER_DISTANCE, ROAD_WIDTH, WIDTH } from '../src/game/constants';
import { project } from '../src/render/projection';

describe('project', () => {
  it('카메라 정면의 점은 화면 가로 중앙에 놓입니다', () => {
    expect(project(0, 0, 1000, 0, CAMERA_HEIGHT, 0).x).toBe(WIDTH / 2);
  });

  it('크기 비율은 거리에 반비례합니다', () => {
    const near = project(0, 0, 1000, 0, CAMERA_HEIGHT, 0);
    const far = project(0, 0, 2000, 0, CAMERA_HEIGHT, 0);
    expect(near.scale).toBeCloseTo(far.scale * 2, 10);
    expect(near.w).toBeCloseTo(far.w * 2, 8);
  });

  it('플레이어 위치의 지면은 화면 아래쪽 끝에 놓입니다', () => {
    expect(project(0, 0, PLAYER_DISTANCE, 0, CAMERA_HEIGHT, 0).y).toBeCloseTo(HEIGHT, 6);
  });

  it('카메라와 같은 높이의 점은 화면 세로 중앙에 놓입니다', () => {
    expect(project(0, CAMERA_HEIGHT, 5000, 0, CAMERA_HEIGHT, 0).y).toBe(HEIGHT / 2);
  });

  it('카메라보다 오른쪽에 있는 점은 화면 오른쪽에 놓입니다', () => {
    expect(project(500, 0, 1000, 0, CAMERA_HEIGHT, 0).x).toBeGreaterThan(WIDTH / 2);
  });

  it('도로 반폭을 화면 크기로 변환합니다', () => {
    const p = project(0, 0, 1000, 0, CAMERA_HEIGHT, 0);
    expect(p.w).toBeCloseTo((p.scale * ROAD_WIDTH * WIDTH) / 2, 8);
  });
});
