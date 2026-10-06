import { CAMERA_DEPTH, HEIGHT, ROAD_WIDTH, WIDTH } from '../game/constants';

export interface Projected {
  x: number;
  y: number;
  /** 이 거리에서 도로 반폭이 차지하는 화면 픽셀 수입니다. */
  w: number;
  scale: number;
}

export function project(
  worldX: number,
  worldY: number,
  worldZ: number,
  cameraX: number,
  cameraY: number,
  cameraZ: number,
  depth = CAMERA_DEPTH,
): Projected {
  const scale = depth / (worldZ - cameraZ);
  return {
    x: WIDTH / 2 + (scale * (worldX - cameraX) * WIDTH) / 2,
    y: HEIGHT / 2 - (scale * (worldY - cameraY) * HEIGHT) / 2,
    w: (scale * ROAD_WIDTH * WIDTH) / 2,
    scale,
  };
}
