import { SEGMENT_LENGTH } from './constants';
import { mulberry32 } from './random';
import type { PropKind, Segment, Track } from './types';

interface Piece {
  length: number;
  curve: number;
  /** 이 조각을 지나는 동안의 높이 변화. 단위는 구간 길이입니다. */
  hill: number;
}

const p = (length: number, curve = 0, hill = 0): Piece => ({ length, curve, hill });

/** 구간마다 조각 길이의 합은 1800입니다. */
const SECTIONS: Piece[][] = [
  // 해변: 완만한 커브
  [p(200), p(300, 2), p(200, 0, 30), p(300, -2), p(200, 0, -30), p(300, 3), p(300, -3, 20)],
  // 사막: 긴 직선과 언덕
  [p(400, 0, 60), p(300, 0, -60), p(300, 2, 40), p(400, 0, -40), p(400, -2, 50)],
  // 숲: 연속되는 급커브
  [
    p(150, 4),
    p(150, -4),
    p(200, 5, 30),
    p(150, -5),
    p(200, 0, -40),
    p(200, 6),
    p(200, -6, 30),
    p(150, 4),
    p(200, -4, -30),
    p(200),
  ],
  // 야간 도시: 직선과 커브
  [p(400), p(300, 3), p(300), p(300, -3), p(500)],
  // 새벽: 결승점으로 이어지는 완만한 구간
  [p(400, 1, 40), p(500, -1, -40), p(400, 0, -30), p(500)],
];

const SECTION_PROPS: PropKind[][] = [
  ['palm'],
  ['cactus', 'rock'],
  ['pine'],
  ['lamp', 'building'],
  ['sign', 'flag'],
];

const TAIL_SEGMENTS = 300;
const PROP_SEED = 7;
const PROP_SPACING = 4;
const PROP_START = 20;

const easeIn = (a: number, b: number, t: number): number => a + (b - a) * t * t;
const easeInOut = (a: number, b: number, t: number): number =>
  a + (b - a) * (-Math.cos(t * Math.PI) / 2 + 0.5);

export function buildTrack(): Track {
  const segments: Segment[] = [];
  const checkpoints: number[] = [];
  let heading = 0;

  const lastY = (): number => (segments.length > 0 ? segments[segments.length - 1].y2 : 0);

  const push = (curve: number, y2: number, section: number): void => {
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
    for (let i = 0; i < enter; i++) push(easeIn(0, piece.curve, i / enter), nextY(), section);
    for (let i = 0; i < hold; i++) push(piece.curve, nextY(), section);
    for (let i = 0; i < leave; i++) push(easeInOut(piece.curve, 0, i / leave), nextY(), section);
  };

  SECTIONS.forEach((pieces, section) => {
    for (const piece of pieces) addPiece(piece, section);
    if (section < SECTIONS.length - 1) checkpoints.push(segments.length * SEGMENT_LENGTH);
  });

  const finishZ = segments.length * SEGMENT_LENGTH;
  for (let i = 0; i < TAIL_SEGMENTS; i++) push(0, lastY(), SECTIONS.length - 1);

  for (const z of checkpoints) segments[z / SEGMENT_LENGTH].gate = 'checkpoint';
  segments[finishZ / SEGMENT_LENGTH].gate = 'finish';

  const rand = mulberry32(PROP_SEED);
  for (let i = PROP_START; i < segments.length; i += PROP_SPACING) {
    const segment = segments[i];
    if (segment.gate) continue;
    const kinds = SECTION_PROPS[segment.section];
    const side = rand() < 0.5 ? -1 : 1;
    const kind = kinds[Math.floor(rand() * kinds.length)];
    const distance = kind === 'building' ? 2.6 + rand() * 1.5 : 1.25 + rand() * 1.75;
    segment.props.push({ offset: side * distance, kind });
  }

  return { segments, length: segments.length * SEGMENT_LENGTH, checkpoints, finishZ };
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
