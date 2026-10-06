import { CAMERA_DEPTH, CAMERA_HEIGHT, HEIGHT, PLAYER_DISTANCE, WIDTH } from '../game/constants';

/** 화면을 비추는 카메라. 주행 규칙에는 영향을 주지 않고, 화면 연출에만 쓰입니다. */
export interface Camera {
  /** 카메라가 내 차보다 뒤에 있는 거리. */
  distance: number;
  /** 투영 깊이. 작을수록 화각이 넓습니다. */
  depth: number;
  /** 화면 흔들림(픽셀). */
  shakeX: number;
  shakeY: number;
}

export const BASE_CAMERA: Camera = { distance: PLAYER_DISTANCE, depth: CAMERA_DEPTH, shakeX: 0, shakeY: 0 };

/** 최고 속도에서 화각이 넓어지는 비율. */
const SPEED_WIDEN = 0.12;
/** 니트로 연출에서 화각이 더 넓어지는 비율. */
const BOOST_WIDEN = 0.12;
/** 니트로 연출에서 카메라가 뒤로 물러나는 비율. */
const BOOST_PULL = 0.35;
const SHAKE = 2.2;

/**
 * boost는 니트로 연출의 정도(0~1), speed는 최고 속도 대비 현재 속도입니다.
 * 화각을 넓히는 만큼 카메라를 앞으로 당겨서, 니트로 연출이 없으면 내 차의 크기와 위치가 그대로입니다.
 */
export function cameraFor(boost: number, speed: number, elapsed: number): Camera {
  const fast = Math.min(1, Math.max(0, speed));
  const depth = CAMERA_DEPTH * (1 - SPEED_WIDEN * fast - BOOST_WIDEN * boost);
  return {
    depth,
    distance: CAMERA_HEIGHT * depth * (1 + BOOST_PULL * boost),
    shakeX: boost > 0 ? Math.sin(elapsed * 53) * SHAKE * boost : 0,
    shakeY: boost > 0 ? Math.cos(elapsed * 61) * SHAKE * 0.7 * boost : 0,
  };
}

/** 내 차가 지면에 닿는 화면 높이와, 월드 단위 1이 차지하는 화면 픽셀 수. */
export function playerOnScreen(camera: Camera): { ground: number; scale: number } {
  const ratio = camera.depth / camera.distance;
  return { ground: HEIGHT / 2 + (ratio * CAMERA_HEIGHT * HEIGHT) / 2, scale: (ratio * WIDTH) / 2 };
}

/** 속도선의 진하기(0~1). 최고 속도 근처에서 옅게 나오고, 니트로 연출 중에는 진해집니다. */
export function speedLineStrength(boost: number, speed: number): number {
  const fast = Math.min(1, Math.max(0, (speed - 0.8) / 0.2));
  return Math.min(1, fast * 0.25 + boost * 0.75);
}

const LINES = 34;
/** 속도선이 흘러나오는 소실점. */
const CENTER_X = WIDTH / 2;
const CENTER_Y = HEIGHT * 0.45;
/** 화면 가운데는 비워 둡니다. */
const INNER = 230;
const OUTER = Math.hypot(WIDTH, HEIGHT) / 2 + 60;

/** 소실점에서 화면 가장자리로 흐르는 흰 속도선을 그립니다. */
export function drawSpeedLines(ctx: CanvasRenderingContext2D, strength: number, elapsed: number): void {
  if (strength <= 0.01) return;
  ctx.save();
  ctx.strokeStyle = `rgba(255,255,255,${(0.75 * strength).toFixed(3)})`;
  ctx.lineCap = 'round';
  for (let i = 0; i < LINES; i++) {
    const angle = (i / LINES) * Math.PI * 2 + Math.sin(i * 7.31) * 0.08;
    const phase = (elapsed * 2.6 + ((i * 0.618) % 1)) % 1;
    const from = INNER + phase * (OUTER - INNER);
    const length = 40 + 120 * phase * strength;
    ctx.lineWidth = 1 + 2 * phase;
    ctx.beginPath();
    ctx.moveTo(CENTER_X + Math.cos(angle) * from, CENTER_Y + Math.sin(angle) * from);
    ctx.lineTo(CENTER_X + Math.cos(angle) * (from + length), CENTER_Y + Math.sin(angle) * (from + length));
    ctx.stroke();
  }
  ctx.restore();
}
