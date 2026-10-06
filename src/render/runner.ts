import { CAMERA_HEIGHT, WIDTH } from '../game/constants';
import type { Player } from '../game/types';
import { playerOnScreen, type Camera } from './camera';
import { driftLevel } from '../game/player';
import { drawSparks } from './effects';
import { drawImage, voltaArt } from './skins';
import { hitWobble } from './sprites';

export type RunnerPose = { kind: 'run'; frame: number } | { kind: 'jet' } | { kind: 'squat' } | { kind: 'blocked' };

export const RUN_FRAMES = 6;
/** 부딪힌 뒤 막힌 자세를 보여 주는 시간(초). */
export const HIT_POSE_SECONDS = 0.6;
/** 최고 속도로 달릴 때 1초에 넘기는 달리기 그림 수. */
const RUN_FRAMES_PER_SECOND = 14;
/** 멈춰 있을 때 보여 주는 달리기 그림. */
const STAND_FRAME = 2;

/** 달리기 동작이 속도에 맞춰 빨라지도록 진행 정도를 늘립니다. */
export function advanceRun(phase: number, speedRatio: number, dt: number): number {
  return phase + dt * RUN_FRAMES_PER_SECOND * Math.min(1.3, Math.max(0, speedRatio));
}

/** hitAgo는 마지막으로 부딪히거나 떨어진 뒤 지난 시간(초)입니다. */
export function runnerPose(player: Player, hitAgo: number, runPhase: number): RunnerPose {
  if (hitAgo < HIT_POSE_SECONDS) return { kind: 'blocked' };
  if (player.nitroActive || player.turbo > 0) return { kind: 'jet' };
  if (player.drifting) return { kind: 'squat' };
  if (player.speed <= 0) return { kind: 'run', frame: STAND_FRAME };
  const frame = Math.floor(runPhase) % RUN_FRAMES;
  return { kind: 'run', frame: frame < 0 ? frame + RUN_FRAMES : frame };
}

/** 화면 아래 끝에서 이만큼 위에 캐릭터를 세웁니다. 기본 맵의 차량과 같은 높이입니다. */
const RUNNER_LIFT = 44;
/** 캐릭터의 키(월드 단위). */
const RUNNER_HEIGHT = 470;

/** 뒤에서 본 달리는 캐릭터를 그립니다. 드리프트 중에는 발밑에서 흙먼지가 일어납니다. */
export function drawRunner(
  ctx: CanvasRenderingContext2D,
  player: Player,
  steer: number,
  camera: Camera,
  pose: RunnerPose,
  runPhase: number,
  hitAgo: number,
  clock: number,
): void {
  const art = voltaArt();
  const { ground, scale } = playerOnScreen(camera);
  const shrink = scale / (WIDTH / 2 / CAMERA_HEIGHT);
  const stride = pose.kind === 'run' && player.speed > 0 ? Math.abs(Math.sin((runPhase * Math.PI) / 3)) * 5 : 0;
  const x = WIDTH / 2 + steer * 22 * shrink;
  const y = ground - RUNNER_LIFT * shrink - stride;
  const image =
    pose.kind === 'run'
      ? art.run[pose.frame]
      : pose.kind === 'jet'
        ? art.jet
        : pose.kind === 'squat'
          ? art.squat
          : art.blocked;
  const height = RUNNER_HEIGHT * scale;
  const width = image.naturalHeight > 0 ? (height * image.naturalWidth) / image.naturalHeight : 0;

  if (player.drifting) {
    // 미끄러져 온 쪽, 즉 조향 반대쪽에 흙먼지를 남깁니다.
    const dust = steer > 0 ? art.dustLeft : art.dustRight;
    ctx.save();
    ctx.globalAlpha = 0.85;
    drawImage(ctx, dust, x - Math.sign(steer) * width * 0.9, y + 8 * shrink, 230 * shrink);
    ctx.restore();
  }

  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(x, y + 4 * shrink, width * 0.45, 9 * shrink, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(steer * 0.06 + hitWobble(hitAgo));
  drawImage(ctx, image, 0, 0, width);
  ctx.restore();
  if (player.drifting) drawSparks(ctx, x, y, width * 0.3, driftLevel(player.driftTime), clock);
}

/** 라이벌 캐릭터를 그립니다. (x, y)는 발이 닿는 도로 위의 점입니다. */
export function drawRivalRunner(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  frame: number,
  boosting: boolean,
): void {
  const art = voltaArt();
  const image = boosting ? art.jet : art.run[frame % RUN_FRAMES];
  const height = RUNNER_HEIGHT * s;
  const width = image.naturalHeight > 0 ? (height * image.naturalWidth) / image.naturalHeight : 0;
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(x, y, width * 0.45, 30 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  drawImage(ctx, image, x, y, width);
}
