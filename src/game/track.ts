import { SEGMENT_LENGTH, SHARP_CURVE } from './constants';
import { MAPS } from './maps';
import { mulberry32 } from './random';
import type { GameMap, Piece, PropKind, Segment, Terrain, TerrainKind, Track } from './types';

/** 폭이 넓어서 도로 가까이 두면 도로를 덮는 사물. */
const WIDE_PROPS: PropKind[] = ['building', 'mesa', 'dome', 'arch'];
/** 길가에 사물을 둘 땅이 없는 지형. */
const BARE_TERRAINS: TerrainKind[] = ['bridge', 'ford', 'space'];
/** 지형이 바뀌는 곳에서 도로 폭을 앞뒤 이만큼의 구간에 걸쳐 잇습니다. */
const WIDTH_BLEND = 6;
const SPACE_BLEND = 20;

const TAIL_SEGMENTS = 300;
const PROP_SEED = 7;
const PROP_SPACING = 4;
const PROP_START = 20;

const easeIn = (a: number, b: number, t: number): number => a + (b - a) * t * t;
const easeInOut = (a: number, b: number, t: number): number => a + (b - a) * (-Math.cos(t * Math.PI) / 2 + 0.5);

/**
 * 조각의 순서와 좌우를 섞습니다. 지형이 이어지는 순서는 그대로 두고, 같은 지형이 연속되는 묶음 안에서만 섞습니다.
 * keepFirst이면 맨 앞 조각은 그대로 둡니다.
 */
function arrange(pieces: Piece[], rand: () => number, keepFirst: boolean): Piece[] {
  const groups: Piece[][] = [];
  for (const piece of pieces) {
    const group = groups[groups.length - 1];
    if (group && group[0].terrain === piece.terrain) group.push(piece);
    else groups.push([piece]);
  }
  return groups.flatMap((group, g) => {
    const fixed = keepFirst && g === 0 ? group.slice(0, 1) : [];
    const rest = group.slice(fixed.length);
    for (let i = rest.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [rest[i], rest[j]] = [rest[j], rest[i]];
    }
    return [...fixed, ...rest.map((piece) => (rand() < 0.5 ? { ...piece, curve: -piece.curve || 0 } : piece))];
  });
}

/** 앞뒤 radius개 구간의 평균을 구합니다. */
function smooth(values: number[], radius: number): number[] {
  return values.map((_, i) => {
    const from = Math.max(0, i - radius);
    const to = Math.min(values.length - 1, i + radius);
    let sum = 0;
    for (let k = from; k <= to; k++) sum += values[k];
    return sum / (to - from + 1);
  });
}

/** seed가 0이면 맵에 적힌 그대로, 아니면 시드에 따라 조각의 순서와 좌우를 섞은 코스를 만듭니다. */
export function buildTrack(map: GameMap = MAPS[0], seed = 0): Track {
  const segments: Segment[] = [];
  const checkpoints: number[] = [];
  let heading = 0;

  const lastY = (): number => (segments.length > 0 ? segments[segments.length - 1].y2 : 0);

  const push = (curve: number, y2: number, section: number, terrain: Terrain): void => {
    heading += curve;
    segments.push({
      index: segments.length,
      curve,
      y1: lastY(),
      y2,
      section,
      heading,
      props: [],
      gate: null,
      terrain,
      width: terrain.width,
      space: 0,
    });
  };

  const addPiece = (piece: Piece, section: number): void => {
    const enter = Math.floor(piece.length / 4);
    const leave = enter;
    const hold = piece.length - enter - leave;
    const startY = lastY();
    const endY = startY + piece.hill * SEGMENT_LENGTH;
    let n = 0;
    const nextY = (): number => easeInOut(startY, endY, ++n / piece.length);
    for (let i = 0; i < enter; i++) push(easeIn(0, piece.curve, i / enter), nextY(), section, piece.terrain);
    for (let i = 0; i < hold; i++) push(piece.curve, nextY(), section, piece.terrain);
    for (let i = 0; i < leave; i++) push(easeInOut(piece.curve, 0, i / leave), nextY(), section, piece.terrain);
  };

  const last = map.sections.length - 1;
  const shuffle = mulberry32(seed);
  map.sections.forEach(({ pieces }, section) => {
    const ordered = seed === 0 ? pieces : arrange(pieces, shuffle, section === 0);
    for (const piece of ordered) addPiece(piece, section);
    if (section < last) checkpoints.push(segments.length * SEGMENT_LENGTH);
  });

  const finishZ = segments.length * SEGMENT_LENGTH;
  const tail = segments[segments.length - 1].terrain;
  for (let i = 0; i < TAIL_SEGMENTS; i++) push(0, lastY(), last, tail);

  const widths = smooth(
    segments.map((segment) => segment.terrain.width),
    WIDTH_BLEND,
  );
  const spaces = smooth(
    segments.map((segment) => (segment.terrain.kind === 'space' ? 1 : 0)),
    SPACE_BLEND,
  );
  segments.forEach((segment, i) => {
    segment.width = widths[i];
    segment.space = spaces[i];
  });

  for (const z of checkpoints) segments[z / SEGMENT_LENGTH].gate = 'checkpoint';
  segments[finishZ / SEGMENT_LENGTH].gate = 'finish';

  const rand = mulberry32(PROP_SEED + map.seed + seed);
  for (let i = PROP_START; i < segments.length; i += PROP_SPACING) {
    const segment = segments[i];
    if (segment.gate || BARE_TERRAINS.includes(segment.terrain.kind)) continue;
    const kinds = map.sections[segment.section].props;
    const sharp = Math.abs(segment.curve) >= SHARP_CURVE;
    const pick = rand() < 0.5 ? -1 : 1;
    const side = sharp ? -Math.sign(segment.curve) : pick;
    const kind = kinds[Math.floor(rand() * kinds.length)];
    const spread = rand();
    const wide = WIDE_PROPS.includes(kind);
    const far = wide ? 2.6 + spread * 1.5 : 1.3 + spread * 1.7;
    // 급커브에서는 바깥쪽 도로 가까이에 둡니다. 폭이 넓은 사물은 도로를 덮으므로 멀리 둡니다.
    const near = sharp && !wide;
    // 폭이 넓은 도로에서는 그만큼 바깥으로 밀어 둡니다.
    const reach = Math.max(1, segment.width);
    segment.props.push({
      offset: side * reach * (near ? 1.35 + spread * 0.4 : far),
      kind,
    });
  }

  return {
    map,
    seed,
    themes: map.sections.map((section) => section.theme),
    segments,
    length: segments.length * SEGMENT_LENGTH,
    checkpoints,
    finishZ,
  };
}

export function segmentAt(track: Track, z: number): Segment {
  const raw = Math.floor(z / SEGMENT_LENGTH);
  const index = Number.isFinite(raw) ? Math.min(Math.max(raw, 0), track.segments.length - 1) : 0;
  return track.segments[index];
}

export function heightAt(track: Track, z: number): number {
  const segment = segmentAt(track, z);
  const t = Math.min(1, Math.max(0, (z - segment.index * SEGMENT_LENGTH) / SEGMENT_LENGTH));
  return segment.y1 + (segment.y2 - segment.y1) * t;
}
