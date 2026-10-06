import { HEIGHT, SEGMENT_LENGTH, WIDTH } from '../game/constants';
import { SPACE_THEME, css, currentTheme, lerpTheme } from '../game/themes';
import { segmentAt } from '../game/track';
import type { GameState, Records, Rival, SkinName, Track } from '../game/types';
import { drawBackground } from './background';
import { cameraFor, drawSpeedLines, speedLineStrength, type Camera } from './camera';
import { drawFlashes, drawPopups, type Popup } from './effects';
import { drawHud } from './hud';
import { computeVisible, drawRoad, type VisibleSegment } from './road';
import { drawRivalRunner, drawRunner, runnerPose } from './runner';
import { drawCountdown, drawResult, drawTitle } from './screens';
import { drawImage, voltaArt } from './skins';
import { RIVAL_COLORS, drawCar, drawGate, drawPlayer, drawProp } from './sprites';
import { drawText } from './text';

export interface View {
  records: Records;
  newRecord: boolean;
  /** 화면에 보이는 차체의 회전. 왼쪽이 음수, 오른쪽이 양수이고, 드리프트 중에는 절댓값이 1을 넘습니다. */
  steer: number;
  muted: boolean;
  /** 맵 목록에서 지금 고른 맵의 순서(0부터)와 전체 맵 수. */
  mapIndex: number;
  mapCount: number;
  /** 니트로 연출의 정도(0~1)와 최고 속도 대비 현재 속도. 카메라와 속도선에 쓰입니다. */
  boost: number;
  speed: number;
  /** 화면 흔들림과 속도선 움직임에 쓰는 시각(초). */
  clock: number;
  /** 달리기 동작의 진행 정도와, 마지막으로 부딪히거나 떨어진 뒤 지난 시간(초). 캐릭터 스킨에 쓰입니다. */
  runPhase: number;
  hitAgo: number;
  /** 화면에 떠 있는 칭찬 글자와 알림. */
  popups: Popup[];
  /** 부스터를 켠 뒤, 터보가 붙은 뒤 지난 시간(초). 번쩍임과 가장자리 빛에 쓰입니다. */
  flashAgo: number;
  turboAgo: number;
  /** 함께 달리는 다른 사람들. 혼자 할 때는 비어 있습니다. */
  others: Racer[];
  /** 함께 달릴 때의 순위와 참가자 수. 혼자 할 때는 null이고 라이벌과의 순위를 씁니다. */
  standing: { rank: number; total: number } | null;
  /** 출발까지 남은 시간(초). 카운트다운 중이 아니면 null입니다. */
  countdown: number | null;
}

/** 화면에 그리는 다른 레이서. 라이벌과 함께 달리는 다른 사람을 같은 방식으로 그립니다. */
export type Racer = Pick<Rival, 'name' | 'z' | 'x' | 'boost' | 'color'> & {
  /** 함께 달리는 다른 사람. 부딪히지 않으므로 반투명하게 그립니다. */
  ghost?: boolean;
};

const MIN_SPRITE_SCALE = 0.002;
const HIT_SHAKE_SECONDS = 0.3;
const HIT_SHAKE = 7;

/** 부딪힌 직후에는 화면을 크게 흔듭니다. */
function withHitShake(camera: Camera, hitAgo: number, clock: number): Camera {
  if (hitAgo < 0 || hitAgo >= HIT_SHAKE_SECONDS) return camera;
  const strength = HIT_SHAKE * (1 - hitAgo / HIT_SHAKE_SECONDS);
  return {
    ...camera,
    shakeX: camera.shakeX + Math.sin(clock * 90) * strength,
    shakeY: camera.shakeY + Math.cos(clock * 77) * strength * 0.6,
  };
}

/** 구조물, 길가 사물, 라이벌을 먼 것부터 그립니다. */
function drawScenery(
  ctx: CanvasRenderingContext2D,
  visible: VisibleSegment[],
  rivals: readonly Racer[],
  skin: SkinName | undefined,
  view: View,
): void {
  const rivalsBySegment = new Map<number, Racer[]>();
  for (const rival of rivals) {
    const index = Math.floor(rival.z / SEGMENT_LENGTH);
    const list = rivalsBySegment.get(index);
    if (list) list.push(rival);
    else rivalsBySegment.set(index, [rival]);
  }

  for (let i = visible.length - 1; i >= 0; i--) {
    const { segment, p1, p2, clip } = visible[i];
    const racers = rivalsBySegment.get(segment.index);
    if (!segment.gate && segment.props.length === 0 && !racers) continue;

    const s1 = (p1.scale * WIDTH) / 2;
    if (s1 < MIN_SPRITE_SCALE) continue;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, WIDTH, clip);
    ctx.clip();

    if (segment.gate) {
      const half = p1.w * Math.max(1, segment.width);
      if (skin === 'volta' && segment.gate === 'checkpoint') drawImage(ctx, voltaArt().arch, p1.x, p1.y, half * 2.9);
      else drawGate(ctx, segment.gate, p1.x, p1.y, half, s1);
    }
    for (const prop of segment.props) {
      drawProp(ctx, prop, p1.x + p1.w * prop.offset, p1.y, s1, segment.index);
    }
    if (racers) {
      for (const rival of racers) {
        const t = (rival.z - segment.index * SEGMENT_LENGTH) / SEGMENT_LENGTH;
        const s = ((p1.scale + (p2.scale - p1.scale) * t) * WIDTH) / 2;
        const w = p1.w + (p2.w - p1.w) * t;
        const x = p1.x + (p2.x - p1.x) * t + w * rival.x;
        const y = p1.y + (p2.y - p1.y) * t;
        const boosting = rival.boost > 0;
        ctx.globalAlpha = rival.ghost ? 0.7 : 1;
        if (skin === 'volta') drawRivalRunner(ctx, x, y, s, Math.floor(view.clock * 12 + rival.color * 2), boosting);
        else drawCar(ctx, x, y, s, RIVAL_COLORS[rival.color % RIVAL_COLORS.length], boosting);
        // 가까이 있는 라이벌은 머리 위에 이름을 띄웁니다.
        if (s > 0.08) drawText(ctx, rival.name, x, y - 330 * s - 22, Math.min(18, 9 + s * 24), 'center', '#ffe066');
        ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
  }
}

/** 상태를 읽어서 한 프레임을 그립니다. 상태를 변경하지 않습니다. */
export function render(ctx: CanvasRenderingContext2D, state: GameState, track: Track, view: View): void {
  const here = segmentAt(track, state.player.z);
  const section = currentTheme(track.themes, state.checkpointsPassed, state.elapsed - state.lastCheckpointAt);
  // 우주 지형에 들어서면 하늘과 땅이 우주의 색으로 바뀝니다.
  const theme = here.space > 0 ? lerpTheme(section, SPACE_THEME, here.space) : section;
  const camera = withHitShake(cameraFor(view.boost, view.speed, view.clock), view.hitAgo, view.clock);

  // 흔들릴 때 화면 가장자리가 비지 않도록 조금 확대해서 그립니다.
  ctx.save();
  if (camera.shakeX !== 0 || camera.shakeY !== 0) {
    ctx.translate(WIDTH / 2 + camera.shakeX, HEIGHT / 2 + camera.shakeY);
    ctx.scale(1.012, 1.012);
    ctx.translate(-WIDTH / 2, -HEIGHT / 2);
  }
  const skin = track.map.skin;
  drawBackground(ctx, theme, here.heading, skin, 1 - here.space);

  const visible = computeVisible(track, state.player, camera);
  drawRoad(ctx, visible, theme);
  const racers: readonly Racer[] = view.others.length > 0 ? [...state.rivals, ...view.others] : state.rivals;
  drawScenery(ctx, visible, racers, skin, view);
  if (skin === 'volta') {
    const pose = runnerPose(state.player, view.hitAgo, view.runPhase);
    drawRunner(ctx, state.player, view.steer, camera, pose, view.runPhase, view.hitAgo, view.clock);
  } else {
    drawPlayer(ctx, state.player, view.steer, state.elapsed, camera, view.hitAgo);
  }
  ctx.restore();
  drawSpeedLines(ctx, speedLineStrength(view.boost, view.speed), view.clock);
  drawFlashes(ctx, view.flashAgo, view.turboAgo);

  if (state.phase === 'title') {
    if (view.countdown !== null) drawCountdown(ctx, view.countdown);
    else drawTitle(ctx, track, view.records, view.mapIndex, view.mapCount);
    return;
  }
  const shown = view.standing ? { ...state, rank: view.standing.rank } : state;
  drawHud(ctx, shown, track, view.muted, {
    total: view.standing?.total ?? state.rivals.length + 1,
    others: racers.map((racer) => ({
      z: racer.z,
      color: css(RIVAL_COLORS[racer.color % RIVAL_COLORS.length]),
      label: racer.ghost ? racer.name : undefined,
    })),
  });
  drawPopups(ctx, view.popups, view.clock);
  if (state.phase !== 'racing') drawResult(ctx, shown, track, view.records, view.newRecord, view.standing !== null);
}
