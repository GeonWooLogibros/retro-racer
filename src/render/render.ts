import { SEGMENT_LENGTH, WIDTH } from '../game/constants';
import { currentTheme } from '../game/themes';
import { segmentAt } from '../game/track';
import type { Car, GameState, Records, Track } from '../game/types';
import { drawBackground } from './background';
import { drawHud } from './hud';
import { computeVisible, drawRoad, type VisibleSegment } from './road';
import { drawResult, drawTitle } from './screens';
import { CAR_COLORS, drawCar, drawGate, drawPlayer, drawProp } from './sprites';

export interface View {
  records: Records;
  newRecord: boolean;
  /** 조향 입력. 왼쪽이 -1, 오른쪽이 1입니다. */
  steer: number;
  muted: boolean;
}

const MIN_SPRITE_SCALE = 0.002;

/** 구조물, 길가 사물, 일반 차량을 먼 것부터 그립니다. */
function drawScenery(ctx: CanvasRenderingContext2D, visible: VisibleSegment[], cars: Car[]): void {
  const bySegment = new Map<number, Car[]>();
  for (const car of cars) {
    const index = Math.floor(car.z / SEGMENT_LENGTH);
    const list = bySegment.get(index);
    if (list) list.push(car);
    else bySegment.set(index, [car]);
  }

  for (let i = visible.length - 1; i >= 0; i--) {
    const { segment, p1, p2, clip } = visible[i];
    const here = bySegment.get(segment.index);
    if (!segment.gate && segment.props.length === 0 && !here) continue;

    const s1 = (p1.scale * WIDTH) / 2;
    if (s1 < MIN_SPRITE_SCALE) continue;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, WIDTH, clip);
    ctx.clip();

    if (segment.gate) drawGate(ctx, segment.gate, p1.x, p1.y, p1.w, s1);
    for (const prop of segment.props) {
      drawProp(ctx, prop, p1.x + p1.w * prop.offset, p1.y, s1, segment.index);
    }
    if (here) {
      for (const car of here) {
        const t = (car.z - segment.index * SEGMENT_LENGTH) / SEGMENT_LENGTH;
        const s = ((p1.scale + (p2.scale - p1.scale) * t) * WIDTH) / 2;
        const w = p1.w + (p2.w - p1.w) * t;
        const x = p1.x + (p2.x - p1.x) * t + w * car.offset;
        const y = p1.y + (p2.y - p1.y) * t;
        drawCar(ctx, x, y, s, CAR_COLORS[car.color % CAR_COLORS.length], false);
      }
    }
    ctx.restore();
  }
}

/** 상태를 읽어서 한 프레임을 그립니다. 상태를 변경하지 않습니다. */
export function render(ctx: CanvasRenderingContext2D, state: GameState, track: Track, view: View): void {
  const theme = currentTheme(state.checkpointsPassed, state.elapsed - state.lastCheckpointAt);
  drawBackground(ctx, theme, segmentAt(track, state.player.z).heading);

  const visible = computeVisible(track, state.player);
  drawRoad(ctx, visible, theme);
  drawScenery(ctx, visible, state.cars);
  drawPlayer(ctx, state.player, view.steer, state.elapsed);

  if (state.phase === 'title') {
    drawTitle(ctx, view.records);
    return;
  }
  drawHud(ctx, state, track, view.muted);
  if (state.phase !== 'racing') drawResult(ctx, state, view.records, view.newRecord);
}
