export type Phase = 'title' | 'racing' | 'finished' | 'timeUp';

export type PropKind = 'palm' | 'cactus' | 'rock' | 'pine' | 'lamp' | 'building' | 'sign' | 'flag';

export type GateKind = 'checkpoint' | 'finish';

export interface Prop {
  /** 도로 중심에서의 좌우 위치. 도로 반폭이 1입니다. */
  offset: number;
  kind: PropKind;
}

export interface Segment {
  index: number;
  curve: number;
  y1: number;
  y2: number;
  section: number;
  /** 코스 시작부터 이 구간까지 누적된 커브 값. 원경 이동에 사용합니다. */
  heading: number;
  props: Prop[];
  gate: GateKind | null;
}

export interface Track {
  segments: Segment[];
  length: number;
  checkpoints: number[];
  finishZ: number;
}

export interface Input {
  left: boolean;
  right: boolean;
  accel: boolean;
  brake: boolean;
  nitro: boolean;
}

export interface Player {
  z: number;
  /** 도로 중심에서의 좌우 위치. 도로 반폭이 1입니다. */
  x: number;
  speed: number;
  nitro: number;
  nitroActive: boolean;
}

export interface Car {
  z: number;
  offset: number;
  speed: number;
  passed: boolean;
  color: number;
}

export type GameEvent =
  | 'crash'
  | 'checkpoint'
  | 'nearMiss'
  | 'pass'
  | 'nitroStart'
  | 'timeWarning'
  | 'finish'
  | 'timeUp';

export interface GameState {
  phase: Phase;
  player: Player;
  cars: Car[];
  time: number;
  elapsed: number;
  checkpointsPassed: number;
  lastCheckpointAt: number;
  events: GameEvent[];
}

export interface Records {
  bestTime: number | null;
  bestDistance: number;
}

export type Color = readonly [number, number, number];

export interface Theme {
  name: string;
  skyTop: Color;
  skyBottom: Color;
  ground: Color;
  road: Color;
  rumble: Color;
  lane: Color;
  fog: Color;
}
