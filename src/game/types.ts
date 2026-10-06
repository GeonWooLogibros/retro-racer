export type Phase = 'title' | 'racing' | 'finished' | 'timeUp';

export type PropKind =
  | 'palm'
  | 'cactus'
  | 'rock'
  | 'pine'
  | 'lamp'
  | 'building'
  | 'sign'
  | 'flag'
  | 'sakura'
  | 'bamboo'
  | 'lantern'
  | 'snowPine'
  | 'iceRock'
  | 'mesa'
  | 'deadTree'
  | 'neonSign'
  | 'antenna'
  | 'dome'
  | 'jungleTree'
  | 'lavaRock'
  | 'vent'
  | 'pillar'
  | 'arch';

export type GateKind = 'checkpoint' | 'finish';

export type TerrainKind = 'road' | 'dirt' | 'bridge' | 'ford' | 'ice' | 'space';

export interface Terrain {
  kind: TerrainKind;
  /** 차선 수. 2보다 작으면 차선을 그리지 않습니다. */
  lanes: number;
  /** 도로 반폭. 기본 3차선 도로가 1입니다. */
  width: number;
}

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
  terrain: Terrain;
  /** 이 구간의 도로 반폭. 지형이 바뀌는 곳에서는 앞뒤 구간과 서서히 이어집니다. */
  width: number;
  /** 우주 지형에 들어온 정도. 0과 1 사이이고, 하늘과 땅의 색을 바꾸는 데 사용합니다. */
  space: number;
}

export interface Piece {
  length: number;
  curve: number;
  /** 이 조각을 지나는 동안의 높이 변화. 단위는 구간 길이입니다. */
  hill: number;
  terrain: Terrain;
}

export interface MapSection {
  theme: Theme;
  /** 이 구간의 길가에 놓이는 사물 종류. */
  props: PropKind[];
  pieces: Piece[];
}

export interface GameMap {
  /** 기록을 저장할 때 쓰는 이름. 바꾸면 저장된 기록을 잃습니다. */
  id: string;
  name: string;
  /** 1(쉬움)부터 5(어려움)까지. */
  difficulty: number;
  /** 길가 사물과 차량 배치에 쓰는 난수 시드. */
  seed: number;
  sections: MapSection[];
  /** 캐릭터, 장애물, 관문, 원경을 그림 에셋으로 바꾸는 스킨. 없으면 기본 그림으로 그립니다. */
  skin?: SkinName;
}

export type SkinName = 'volta';

export interface Track {
  map: GameMap;
  /** 조각 순서와 좌우, 사물과 차량 배치를 정하는 난수 시드. 0이면 맵에 적힌 순서 그대로입니다. */
  seed: number;
  /** 구간 순서대로의 테마. */
  themes: Theme[];
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
  drift: boolean;
}

export interface Player {
  z: number;
  /** 도로 중심에서의 좌우 위치. 도로 반폭이 1입니다. */
  x: number;
  speed: number;
  /** 부스터 게이지(0~100). 가득 차면 부스터 한 칸이 됩니다. */
  gauge: number;
  /** 모아 둔 부스터 수. */
  boosters: number;
  nitroActive: boolean;
  /** 남은 부스터 시간(초). */
  nitroTime: number;
  /** 지난 단계에 부스터 키를 누르고 있었는지. 누르는 순간에만 부스터를 쓰기 위해 기억합니다. */
  nitroHeld: boolean;
  drifting: boolean;
  /** 현재 드리프트를 유지한 시간(초). 드리프트 중이 아니면 0입니다. */
  driftTime: number;
  /** 마지막 드리프트의 방향. 오른쪽이 1, 왼쪽이 -1, 드리프트한 적이 없으면 0입니다. */
  driftDir: number;
  /** 남은 터보 시간(초). 드리프트를 끝낼 때 붙는 짧은 가속입니다. */
  turbo: number;
  /** 순간 부스터를 쓸 수 있는 남은 시간(초). */
  counterWindow: number;
}

export interface Rival {
  name: string;
  z: number;
  /** 도로 중심에서의 좌우 위치. 도로 반폭이 1입니다. */
  x: number;
  speed: number;
  /** 최고 속도에 곱하는 실력 배율. */
  skill: number;
  color: number;
  /** 남은 부스터 시간(초). */
  boost: number;
  /** 마지막으로 부스터를 쓴 구간 묶음. 같은 묶음에서 두 번 쓰지 않게 합니다. */
  boostBlock: number;
  /** 순위를 셀 때 플레이어보다 앞선 것으로 치는지 여부. */
  ahead: boolean;
}

export type GameEvent =
  | 'crash'
  | 'fall'
  | 'checkpoint'
  | 'nitroStart'
  | 'turbo'
  | 'counterBoost'
  | 'boosterReady'
  | 'overtake'
  | 'overtaken'
  | 'bump'
  | 'timeWarning'
  | 'finish'
  | 'timeUp';

export interface GameState {
  phase: Phase;
  player: Player;
  rivals: Rival[];
  /** 라이벌을 포함한 지금 순위(1부터). */
  rank: number;
  time: number;
  elapsed: number;
  checkpointsPassed: number;
  lastCheckpointAt: number;
  /** 이어지고 있는 연속 보너스 횟수와, 끊기기까지 남은 시간(초). */
  combo: number;
  comboTime: number;
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
  /** 다리 아래와 여울에 흐르는 것의 색. 없으면 하늘 밝기에 맞춘 물색을 씁니다. */
  liquid?: Color;
}
