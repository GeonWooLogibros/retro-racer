# Retro Racer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 브라우저에서 키보드로 플레이하는 유사 3D 체크포인트 타임어택 레이싱 게임을 만듭니다.

**Architecture:** `src/game/`에는 DOM에 의존하지 않는 순수 함수로 게임 규칙을 작성하고 Vitest로 검증합니다. `src/render/`는 상태를 읽어서 Canvas 2D에 그리기만 하며, `src/main.ts`가 1/60초 고정 간격으로 `step`을 호출하고 프레임마다 `render`를 호출합니다.

**Tech Stack:** Vite 7, TypeScript 7, Vitest 3, Canvas 2D, Web Audio. 실행 의존성은 없습니다.

**Spec:** `docs/superpowers/specs/2026-10-02-retro-racer-design.md`

## Global Constraints

- 작업 디렉토리는 `/Users/logibros/development/projects/game-projects/retro-racer`이며, 이 폴더가 독립된 git 저장소입니다. 상위 폴더의 저장소에는 커밋하지 않습니다.
- 개발 의존성은 `typescript ^7.0.2`, `vite ^7.3.6`, `vitest ^3.2.7`만 사용하고, 실행 의존성은 추가하지 않습니다.
- 이미지 파일과 음원 파일을 추가하지 않습니다. 그림은 Canvas 도형으로, 소리는 Web Audio 합성으로 만듭니다.
- `src/game/` 아래의 파일은 `window`, `document`, 캔버스를 참조하지 않습니다.
- 코드 양식은 형제 프로젝트 `powder-lab`을 따릅니다: 세미콜론 사용, 작은따옴표, 들여쓰기 2칸, 테스트 이름은 한국어 문장.
- 캔버스의 내부 해상도는 가로 1024, 세로 576입니다.
- 수치는 모두 `src/game/constants.ts`에 정의하고, 다른 파일에 숫자를 직접 적지 않습니다(그리기용 도형 치수는 예외입니다).
- 커밋 메시지의 마지막 줄에는 `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`을 붙입니다.

## Review Focus

스펙이 명시하지 않았지만 실제 플레이에서 발생하기 쉬운 상황입니다. 각 항목을 검증하는 테스트는 괄호 안의 Task에 포함되어 있습니다.

1. 탭이 비활성화되었다가 돌아오면 프레임 간격이 수 초가 됩니다. 한 프레임에 누적되는 시간은 0.1초를 넘지 않아야 합니다. (Task 5, `accumulate`)
2. 주행 중에 Enter를 누르거나 키가 자동 반복되어도 경주가 처음부터 다시 시작되면 안 됩니다. (Task 5, `requestStart`)
3. 좌우 키 또는 가속·브레이크 키를 동시에 누르는 경우입니다. 좌우는 서로 상쇄되고, 브레이크가 가속보다 우선해야 합니다. (Task 3)
4. `localStorage`에 JSON이 아닌 값, 음수, 문자열이 저장되어 있는 경우입니다. 오류 없이 기본 기록으로 대체해야 합니다. (Task 6)
5. 카메라가 코스 시작 이전이거나 플레이어가 코스 끝을 넘어선 경우입니다. 구간 조회는 배열 범위 안으로 제한되어야 합니다. (Task 2, `segmentAt`)

## File Structure

```
index.html              캔버스 하나만 있는 페이지
package.json, tsconfig.json, .gitignore, README.md
src/
  main.ts               게임 루프와 모듈 연결
  input.ts              키 입력
  audio.ts              엔진음과 효과음
  storage.ts            최고 기록 저장
  format.ts             시간·거리·속도 표시 문자열
  style.css
  game/
    constants.ts        모든 조정값
    types.ts            공용 타입
    random.ts           시드 난수
    themes.ts           테마와 색 보간
    track.ts            코스 생성과 구간 조회
    player.ts           플레이어 차량 물리
    traffic.ts          일반 차량
    race.ts             타이머·체크포인트·기록
    step.ts             한 단계 갱신, 게임 생성, 시작 요청
    loop.ts             프레임 시간 누적
  render/
    projection.ts       투영 계산
    road.ts             보이는 구간 계산과 도로 그리기
    background.ts       하늘과 원경
    sprites.ts          길가 사물, 구조물, 차량
    text.ts             외곽선 글자
    hud.ts              주행 중 정보 표시
    screens.ts          타이틀·결과 화면
    render.ts           한 프레임 전체 그리기
tests/                  src/game, format, storage, projection, road 테스트
```

---

### Task 1: 프로젝트 구성, 상수, 타입, 테마

**Files:**
- Create: `package.json`, `tsconfig.json`, `index.html`, `src/style.css`, `src/main.ts`
- Create: `src/game/constants.ts`, `src/game/types.ts`, `src/game/random.ts`, `src/game/themes.ts`
- Test: `tests/themes.test.ts`, `tests/random.test.ts`

**Interfaces:**
- Produces: `constants.ts`의 모든 상수, `types.ts`의 모든 타입, `mulberry32(seed): () => number`, `THEMES: Theme[]`, `lerpColor(a, b, t): Color`, `lerpTheme(a, b, t): Theme`, `currentTheme(section, sinceCheckpoint): Theme`, `css(color, alpha?): string`, `shade(color, factor): Color`, `luminance(color): number`

- [ ] **Step 1: 설정 파일을 작성합니다**

`package.json`:

```json
{
  "name": "retro-racer",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "devDependencies": {
    "typescript": "^7.0.2",
    "vite": "^7.3.6",
    "vitest": "^3.2.7"
  }
}
```

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vite/client"],
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["src", "tests"]
}
```

`index.html`:

```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Retro Racer</title>
  </head>
  <body>
    <canvas id="game"></canvas>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

`src/style.css`:

```css
html,
body {
  height: 100%;
  margin: 0;
}

body {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #05070f;
  overflow: hidden;
}

#game {
  display: block;
  width: min(100vw, calc(100vh * 16 / 9));
  aspect-ratio: 16 / 9;
}
```

`src/main.ts` (Task 8에서 전체 내용으로 교체합니다):

```ts
import './style.css';
```

- [ ] **Step 2: 의존성을 설치합니다**

Run: `npm install`
Expected: 오류 없이 종료되고 `node_modules`와 `package-lock.json`이 생성됩니다.

- [ ] **Step 3: 상수와 타입을 작성합니다**

`src/game/constants.ts`:

```ts
export const WIDTH = 1024;
export const HEIGHT = 576;
export const STEP = 1 / 60;
export const MAX_FRAME_TIME = 0.1;

export const SEGMENT_LENGTH = 200;
export const ROAD_WIDTH = 2000;
export const RUMBLE_LENGTH = 3;
export const LANES = 3;
export const DRAW_DISTANCE = 200;
export const CAMERA_HEIGHT = 1000;
export const CAMERA_DEPTH = 1 / Math.tan((50 * Math.PI) / 180);
export const PLAYER_DISTANCE = CAMERA_HEIGHT * CAMERA_DEPTH;
export const START_Z = SEGMENT_LENGTH * 10;

export const MAX_SPEED = SEGMENT_LENGTH * 60;
export const ACCEL = MAX_SPEED / 5;
export const BRAKE = -MAX_SPEED;
export const DECEL = -MAX_SPEED / 5;
export const OFFROAD_DECEL = -MAX_SPEED / 2;
export const OFFROAD_LIMIT = MAX_SPEED / 4;
export const STEER_RATE = 2;
export const CENTRIFUGAL = 0.25;
export const MAX_X = 2;

export const NITRO_MAX = 100;
export const NITRO_MIN = 30;
export const NITRO_DRAIN = 33;
export const NITRO_BOOST = 1.3;
export const NITRO_NEAR_GAIN = 25;
export const NITRO_PASS_GAIN = 5;

export const CAR_WIDTH = 560;
export const CAR_LENGTH = 300;
export const CAR_HIT_WIDTH = 0.3;
export const NEAR_MISS_WIDTH = 0.6;
export const CAR_COLOR_COUNT = 5;
export const TRAFFIC_SEED = 20261002;
export const TRAFFIC_ACTIVE_DISTANCE = DRAW_DISTANCE * SEGMENT_LENGTH;

export const PROP_HIT_WIDTH = 0.25;
export const PROP_CRASH_SPEED = MAX_SPEED / 20;

export const START_TIME = 60;
export const CHECKPOINT_BONUS = 30;
export const WARNING_SECONDS = 10;
export const THEME_BLEND_SECONDS = 2;

export const TOP_KMH = 240;
export const UNITS_PER_METER = 180;
```

`src/game/types.ts`:

```ts
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
```

- [ ] **Step 4: 실패하는 테스트를 작성합니다**

`tests/random.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/game/random';

describe('mulberry32', () => {
  it('시드가 같으면 같은 수열을 만듭니다', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('0 이상 1 미만의 값을 만듭니다', () => {
    const rand = mulberry32(7);
    for (let i = 0; i < 1000; i++) {
      const v = rand();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
```

`tests/themes.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { THEMES, css, currentTheme, lerpColor, luminance, shade } from '../src/game/themes';

describe('lerpColor', () => {
  it('양 끝과 중간 값을 계산합니다', () => {
    expect(lerpColor([0, 0, 0], [100, 200, 50], 0)).toEqual([0, 0, 0]);
    expect(lerpColor([0, 0, 0], [100, 200, 50], 1)).toEqual([100, 200, 50]);
    expect(lerpColor([0, 0, 0], [100, 200, 50], 0.5)).toEqual([50, 100, 25]);
  });
});

describe('currentTheme', () => {
  it('테마는 5개입니다', () => {
    expect(THEMES).toHaveLength(5);
  });

  it('첫 구간에서는 첫 테마를 그대로 사용합니다', () => {
    expect(currentTheme(0, 0)).toBe(THEMES[0]);
  });

  it('체크포인트 직후에는 이전 테마의 색으로 시작합니다', () => {
    expect(currentTheme(1, 0).skyTop).toEqual(THEMES[0].skyTop);
  });

  it('2초가 지나면 다음 테마의 색이 됩니다', () => {
    expect(currentTheme(1, 2).skyTop).toEqual(THEMES[1].skyTop);
    expect(currentTheme(1, 99).ground).toEqual(THEMES[1].ground);
  });

  it('전환 도중에는 두 테마의 중간 색입니다', () => {
    expect(currentTheme(1, 1).skyTop).toEqual(lerpColor(THEMES[0].skyTop, THEMES[1].skyTop, 0.5));
  });

  it('구간 번호가 범위를 넘으면 마지막 테마를 사용합니다', () => {
    expect(currentTheme(9, 99).skyTop).toEqual(THEMES[4].skyTop);
  });
});

describe('색 도우미', () => {
  it('css 문자열을 만듭니다', () => {
    expect(css([1, 2, 3])).toBe('rgb(1,2,3)');
    expect(css([1, 2, 3], 0.5)).toBe('rgba(1,2,3,0.5)');
  });

  it('shade는 각 성분에 배율을 곱합니다', () => {
    expect(shade([100, 200, 50], 0.5)).toEqual([50, 100, 25]);
  });

  it('luminance는 밝은 색에서 더 큽니다', () => {
    expect(luminance([255, 255, 255])).toBeGreaterThan(luminance([10, 12, 40]));
  });
});
```

- [ ] **Step 5: 테스트가 실패하는지 확인합니다**

Run: `npm test`
Expected: FAIL. `../src/game/random`과 `../src/game/themes`를 찾을 수 없다는 오류가 출력됩니다.

- [ ] **Step 6: 구현을 작성합니다**

`src/game/random.ts`:

```ts
/** 시드가 같으면 같은 수열을 만드는 난수 생성기입니다. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

`src/game/themes.ts`:

```ts
import { THEME_BLEND_SECONDS } from './constants';
import type { Color, Theme } from './types';

export const THEMES: Theme[] = [
  {
    name: '해변',
    skyTop: [60, 150, 230],
    skyBottom: [170, 220, 250],
    ground: [230, 205, 140],
    road: [105, 105, 110],
    rumble: [220, 60, 60],
    lane: [240, 240, 240],
    fog: [190, 225, 245],
  },
  {
    name: '사막',
    skyTop: [235, 110, 50],
    skyBottom: [250, 200, 120],
    ground: [200, 150, 80],
    road: [115, 100, 90],
    rumble: [200, 80, 30],
    lane: [245, 235, 210],
    fog: [245, 195, 130],
  },
  {
    name: '숲',
    skyTop: [90, 180, 170],
    skyBottom: [190, 230, 215],
    ground: [30, 95, 50],
    road: [90, 95, 95],
    rumble: [230, 230, 60],
    lane: [240, 240, 240],
    fog: [170, 215, 200],
  },
  {
    name: '야간 도시',
    skyTop: [10, 12, 40],
    skyBottom: [45, 35, 90],
    ground: [35, 35, 45],
    road: [55, 55, 65],
    rumble: [60, 200, 230],
    lane: [250, 220, 90],
    fog: [30, 28, 60],
  },
  {
    name: '새벽',
    skyTop: [110, 90, 170],
    skyBottom: [250, 170, 170],
    ground: [130, 190, 110],
    road: [100, 100, 105],
    rumble: [240, 90, 150],
    lane: [240, 240, 240],
    fog: [240, 190, 190],
  },
];

export function lerpColor(a: Color, b: Color, t: number): Color {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

export function lerpTheme(a: Theme, b: Theme, t: number): Theme {
  return {
    name: t < 0.5 ? a.name : b.name,
    skyTop: lerpColor(a.skyTop, b.skyTop, t),
    skyBottom: lerpColor(a.skyBottom, b.skyBottom, t),
    ground: lerpColor(a.ground, b.ground, t),
    road: lerpColor(a.road, b.road, t),
    rumble: lerpColor(a.rumble, b.rumble, t),
    lane: lerpColor(a.lane, b.lane, t),
    fog: lerpColor(a.fog, b.fog, t),
  };
}

/** section은 지금까지 통과한 체크포인트 수, sinceCheckpoint는 마지막 통과 후 지난 시간(초)입니다. */
export function currentTheme(section: number, sinceCheckpoint: number): Theme {
  const index = Math.min(Math.max(section, 0), THEMES.length - 1);
  if (index === 0) return THEMES[0];
  const t = Math.min(1, Math.max(0, sinceCheckpoint / THEME_BLEND_SECONDS));
  return lerpTheme(THEMES[index - 1], THEMES[index], t);
}

export function css(color: Color, alpha = 1): string {
  return alpha >= 1
    ? `rgb(${color[0]},${color[1]},${color[2]})`
    : `rgba(${color[0]},${color[1]},${color[2]},${alpha})`;
}

export function shade(color: Color, factor: number): Color {
  return [Math.round(color[0] * factor), Math.round(color[1] * factor), Math.round(color[2] * factor)];
}

export function luminance(color: Color): number {
  return 0.299 * color[0] + 0.587 * color[1] + 0.114 * color[2];
}
```

- [ ] **Step 7: 테스트와 빌드가 통과하는지 확인합니다**

Run: `npm test && npm run build`
Expected: 테스트가 모두 PASS하고, 빌드가 오류 없이 `dist/`를 생성합니다.

- [ ] **Step 8: 커밋합니다**

```bash
git add -A
git commit -m "feat: scaffold project with constants, types, and themes"
```

---

### Task 2: 코스 생성

**Files:**
- Create: `src/game/track.ts`
- Test: `tests/track.test.ts`

**Interfaces:**
- Consumes: `SEGMENT_LENGTH`, `mulberry32`, `Track`, `Segment`, `Prop`, `PropKind`
- Produces: `buildTrack(): Track`, `segmentAt(track: Track, z: number): Segment`, `heightAt(track: Track, z: number): number`

- [ ] **Step 1: 실패하는 테스트를 작성합니다**

`tests/track.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { MAX_SPEED, SEGMENT_LENGTH } from '../src/game/constants';
import { buildTrack, heightAt, segmentAt } from '../src/game/track';

const track = buildTrack();

describe('buildTrack', () => {
  it('구간 5개와 꼬리 구간으로 구성됩니다', () => {
    expect(track.segments).toHaveLength(5 * 1800 + 300);
    expect(track.length).toBe(track.segments.length * SEGMENT_LENGTH);
  });

  it('체크포인트 4개가 구간 경계에 오름차순으로 있습니다', () => {
    expect(track.checkpoints).toEqual([360000, 720000, 1080000, 1440000]);
    expect(track.finishZ).toBe(1800000);
  });

  it('최고 속도로 달리면 결승점까지 150초가 걸립니다', () => {
    expect(track.finishZ / MAX_SPEED).toBe(150);
  });

  it('구간마다 테마 번호가 지정됩니다', () => {
    expect(track.segments[0].section).toBe(0);
    expect(track.segments[1799].section).toBe(0);
    expect(track.segments[1800].section).toBe(1);
    expect(track.segments[8999].section).toBe(4);
    expect(track.segments[9299].section).toBe(4);
  });

  it('체크포인트와 결승점 구간에 구조물 표시가 있습니다', () => {
    expect(track.segments[1800].gate).toBe('checkpoint');
    expect(track.segments[7200].gate).toBe('checkpoint');
    expect(track.segments[9000].gate).toBe('finish');
    expect(track.segments.filter((s) => s.gate !== null)).toHaveLength(5);
  });

  it('인접한 구간의 높이가 이어집니다', () => {
    for (let i = 1; i < track.segments.length; i++) {
      expect(track.segments[i].y1).toBe(track.segments[i - 1].y2);
    }
  });

  it('길가 사물은 모두 도로 밖에 있습니다', () => {
    const props = track.segments.flatMap((s) => s.props);
    expect(props.length).toBeGreaterThan(1000);
    for (const prop of props) expect(Math.abs(prop.offset)).toBeGreaterThan(1);
  });

  it('커브와 언덕이 있습니다', () => {
    expect(track.segments.some((s) => s.curve > 0)).toBe(true);
    expect(track.segments.some((s) => s.curve < 0)).toBe(true);
    expect(track.segments.some((s) => s.y2 !== 0)).toBe(true);
  });

  it('매번 같은 코스를 만듭니다', () => {
    expect(buildTrack()).toEqual(track);
  });
});

describe('segmentAt', () => {
  it('위치에 해당하는 구간을 반환합니다', () => {
    expect(segmentAt(track, 0).index).toBe(0);
    expect(segmentAt(track, 450).index).toBe(2);
  });

  it('범위를 벗어난 위치는 양 끝 구간으로 제한합니다', () => {
    expect(segmentAt(track, -5000).index).toBe(0);
    expect(segmentAt(track, track.length + 5000).index).toBe(track.segments.length - 1);
    expect(segmentAt(track, Number.NaN).index).toBe(0);
  });
});

describe('heightAt', () => {
  it('구간 안에서 높이를 보간합니다', () => {
    const seg = track.segments.find((s) => s.y1 !== s.y2)!;
    const z = seg.index * SEGMENT_LENGTH + SEGMENT_LENGTH / 2;
    expect(heightAt(track, z)).toBeCloseTo((seg.y1 + seg.y2) / 2, 6);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인합니다**

Run: `npx vitest run tests/track.test.ts`
Expected: FAIL. `../src/game/track`을 찾을 수 없다는 오류가 출력됩니다.

- [ ] **Step 3: 구현을 작성합니다**

`src/game/track.ts`:

```ts
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
```

- [ ] **Step 4: 테스트가 통과하는지 확인합니다**

Run: `npx vitest run tests/track.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋합니다**

```bash
git add -A
git commit -m "feat: build track with sections, checkpoints, and props"
```

---

### Task 3: 플레이어 차량 물리

**Files:**
- Create: `src/game/player.ts`
- Test: `tests/player.test.ts`

**Interfaces:**
- Consumes: `constants.ts`, `Player`, `Input`, `Prop`
- Produces:
  - `createPlayer(): Player`
  - `updatePlayer(p: Player, input: Input, curve: number, dt: number, canAccelerate: boolean): Player`
  - `hitProp(p: Player, props: Prop[]): boolean`
  - `crash(p: Player, speed: number): Player`

- [ ] **Step 1: 실패하는 테스트를 작성합니다**

`tests/player.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { MAX_SPEED, NITRO_BOOST, NITRO_DRAIN, OFFROAD_LIMIT, START_Z, STEP } from '../src/game/constants';
import { crash, createPlayer, hitProp, updatePlayer } from '../src/game/player';
import type { Input, Player } from '../src/game/types';

const idle: Input = { left: false, right: false, accel: false, brake: false, nitro: false };
const key = (over: Partial<Input>): Input => ({ ...idle, ...over });
const make = (over: Partial<Player>): Player => ({ ...createPlayer(), ...over });

function run(p: Player, input: Input, seconds: number, curve = 0, canAccelerate = true): Player {
  let player = p;
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    player = updatePlayer(player, input, curve, STEP, canAccelerate);
  }
  return player;
}

describe('createPlayer', () => {
  it('출발 위치에서 정지한 상태로 시작합니다', () => {
    expect(createPlayer()).toEqual({ z: START_Z, x: 0, speed: 0, nitro: 0, nitroActive: false });
  });
});

describe('가속과 감속', () => {
  it('가속 키를 누르면 1초에 최고 속도의 1/5만큼 빨라집니다', () => {
    expect(run(createPlayer(), key({ accel: true }), 1).speed).toBeCloseTo(MAX_SPEED / 5, 5);
  });

  it('최고 속도를 넘지 않습니다', () => {
    expect(run(createPlayer(), key({ accel: true }), 10).speed).toBe(MAX_SPEED);
  });

  it('키를 누르지 않으면 서서히 감속합니다', () => {
    expect(run(make({ speed: MAX_SPEED }), idle, 1).speed).toBeCloseTo(MAX_SPEED * 0.8, 5);
  });

  it('브레이크는 자연 감속보다 빠르게 속도를 줄입니다', () => {
    expect(run(make({ speed: MAX_SPEED }), key({ brake: true }), 0.5).speed).toBeCloseTo(MAX_SPEED / 2, 5);
  });

  it('가속과 브레이크를 함께 누르면 브레이크가 우선합니다', () => {
    const p = run(make({ speed: MAX_SPEED }), key({ accel: true, brake: true }), 0.5);
    expect(p.speed).toBeCloseTo(MAX_SPEED / 2, 5);
  });

  it('속도는 0 아래로 내려가지 않습니다', () => {
    expect(run(make({ speed: 100 }), key({ brake: true }), 1).speed).toBe(0);
  });

  it('속도만큼 앞으로 이동합니다', () => {
    const p = updatePlayer(make({ speed: MAX_SPEED }), key({ accel: true }), 0, STEP, true);
    expect(p.z).toBeCloseTo(START_Z + MAX_SPEED * STEP, 5);
  });

  it('가속할 수 없는 상태에서는 가속 키를 눌러도 감속합니다', () => {
    const p = run(make({ speed: MAX_SPEED }), key({ accel: true }), 1, 0, false);
    expect(p.speed).toBeCloseTo(MAX_SPEED * 0.8, 5);
  });
});

describe('조향', () => {
  it('정지 상태에서는 좌우로 움직이지 않습니다', () => {
    expect(run(createPlayer(), key({ left: true }), 1).x).toBe(0);
  });

  it('조향 속도는 현재 속도에 비례합니다', () => {
    const fast = updatePlayer(make({ speed: MAX_SPEED }), key({ right: true }), 0, STEP, true);
    const slow = updatePlayer(make({ speed: MAX_SPEED / 2 }), key({ right: true }), 0, STEP, true);
    expect(fast.x).toBeCloseTo(STEP * 2, 8);
    expect(slow.x).toBeCloseTo(STEP, 8);
  });

  it('좌우를 함께 누르면 상쇄됩니다', () => {
    const p = updatePlayer(make({ speed: MAX_SPEED }), key({ left: true, right: true }), 0, STEP, true);
    expect(p.x).toBe(0);
  });

  it('오른쪽 커브에서는 왼쪽(바깥쪽)으로 밀립니다', () => {
    const p = updatePlayer(make({ speed: MAX_SPEED }), idle, 4, STEP, true);
    expect(p.x).toBeCloseTo(-STEP * 2, 8);
  });

  it('속도가 낮으면 커브에서 덜 밀립니다', () => {
    const fast = updatePlayer(make({ speed: MAX_SPEED }), idle, 4, STEP, true);
    const slow = updatePlayer(make({ speed: MAX_SPEED / 2 }), idle, 4, STEP, true);
    expect(Math.abs(slow.x)).toBeLessThan(Math.abs(fast.x));
  });

  it('좌우 위치는 도로 폭의 2배를 넘지 못합니다', () => {
    expect(run(make({ speed: MAX_SPEED, x: 1.99 }), key({ right: true, accel: true }), 1).x).toBe(2);
    expect(run(make({ speed: MAX_SPEED, x: -1.99 }), key({ left: true, accel: true }), 1).x).toBe(-2);
  });
});

describe('도로 이탈', () => {
  it('도로 밖에서는 가속 키를 눌러도 최고 속도의 1/4까지 줄어듭니다', () => {
    const p = run(make({ speed: MAX_SPEED, x: 1.5 }), key({ accel: true }), 3);
    expect(p.speed).toBe(OFFROAD_LIMIT);
  });

  it('도로 안에서는 감속하지 않습니다', () => {
    const p = run(make({ speed: MAX_SPEED, x: 0.9 }), key({ accel: true }), 1);
    expect(p.speed).toBe(MAX_SPEED);
  });
});

describe('니트로', () => {
  it('게이지가 30 미만이면 작동하지 않습니다', () => {
    const p = updatePlayer(make({ speed: MAX_SPEED, nitro: 29 }), key({ nitro: true }), 0, STEP, true);
    expect(p.nitroActive).toBe(false);
    expect(p.nitro).toBe(29);
  });

  it('게이지가 30 이상이면 작동하고 게이지가 줄어듭니다', () => {
    const p = updatePlayer(make({ speed: MAX_SPEED, nitro: 30 }), key({ nitro: true }), 0, STEP, true);
    expect(p.nitroActive).toBe(true);
    expect(p.nitro).toBeCloseTo(30 - NITRO_DRAIN * STEP, 8);
  });

  it('작동하는 동안 최고 속도를 넘어섭니다', () => {
    const p = run(make({ speed: MAX_SPEED, nitro: 100 }), key({ accel: true, nitro: true }), 1);
    expect(p.speed).toBeGreaterThan(MAX_SPEED);
    expect(p.speed).toBeLessThanOrEqual(MAX_SPEED * NITRO_BOOST);
  });

  it('키에서 손을 떼어도 게이지가 0이 될 때까지 유지됩니다', () => {
    const started = updatePlayer(make({ speed: MAX_SPEED, nitro: 100 }), key({ nitro: true }), 0, STEP, true);
    expect(run(started, key({ accel: true }), 1).nitroActive).toBe(true);
  });

  it('게이지가 0이 되면 종료되고 속도가 최고 속도로 돌아옵니다', () => {
    const p = run(make({ speed: MAX_SPEED, nitro: 100 }), key({ accel: true, nitro: true }), 5);
    expect(p.nitroActive).toBe(false);
    expect(p.nitro).toBe(0);
    expect(p.speed).toBe(MAX_SPEED);
  });

  it('가속할 수 없는 상태에서는 작동하지 않습니다', () => {
    const p = updatePlayer(make({ speed: MAX_SPEED, nitro: 100 }), key({ nitro: true }), 0, STEP, false);
    expect(p.nitroActive).toBe(false);
  });
});

describe('길가 사물', () => {
  it('좌우 간격이 좁은 사물이 있으면 충돌로 판정합니다', () => {
    expect(hitProp(make({ x: 1.5 }), [{ offset: 1.6, kind: 'palm' }])).toBe(true);
    expect(hitProp(make({ x: 1.5 }), [{ offset: 1.9, kind: 'palm' }])).toBe(false);
    expect(hitProp(make({ x: 1.5 }), [{ offset: -1.5, kind: 'palm' }])).toBe(false);
    expect(hitProp(make({ x: 1.5 }), [])).toBe(false);
  });

  it('crash는 속도를 지정한 값으로 줄이고 니트로를 종료합니다', () => {
    const p = crash(make({ speed: MAX_SPEED, nitro: 50, nitroActive: true }), 600);
    expect(p.speed).toBe(600);
    expect(p.nitroActive).toBe(false);
    expect(p.nitro).toBe(50);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인합니다**

Run: `npx vitest run tests/player.test.ts`
Expected: FAIL. `../src/game/player`를 찾을 수 없다는 오류가 출력됩니다.

- [ ] **Step 3: 구현을 작성합니다**

`src/game/player.ts`:

```ts
import {
  ACCEL,
  BRAKE,
  CENTRIFUGAL,
  DECEL,
  MAX_SPEED,
  MAX_X,
  NITRO_BOOST,
  NITRO_DRAIN,
  NITRO_MIN,
  OFFROAD_DECEL,
  OFFROAD_LIMIT,
  PROP_HIT_WIDTH,
  START_Z,
  STEER_RATE,
} from './constants';
import type { Input, Player, Prop } from './types';

export function createPlayer(): Player {
  return { z: START_Z, x: 0, speed: 0, nitro: 0, nitroActive: false };
}

export function updatePlayer(
  p: Player,
  input: Input,
  curve: number,
  dt: number,
  canAccelerate: boolean,
): Player {
  let { x, speed, nitro } = p;
  let nitroActive = p.nitroActive && canAccelerate;
  if (!nitroActive && input.nitro && canAccelerate && nitro >= NITRO_MIN) nitroActive = true;

  const boost = nitroActive ? NITRO_BOOST : 1;
  const maxSpeed = MAX_SPEED * boost;
  const ratio = p.speed / MAX_SPEED;
  const dx = dt * STEER_RATE * ratio;

  if (input.left) x -= dx;
  if (input.right) x += dx;
  x -= dx * ratio * curve * CENTRIFUGAL;

  if (input.brake) speed += BRAKE * dt;
  else if (input.accel && canAccelerate) speed += ACCEL * boost * dt;
  else speed += DECEL * dt;

  if (Math.abs(x) > 1 && speed > OFFROAD_LIMIT) {
    speed = Math.max(OFFROAD_LIMIT, speed + OFFROAD_DECEL * dt);
  }
  // 니트로가 끝난 직후처럼 최고 속도를 넘은 상태에서는 급격히 자르지 않고 서서히 낮춥니다.
  if (speed > maxSpeed) speed = Math.min(speed, Math.max(maxSpeed, p.speed + 2 * DECEL * dt));

  speed = Math.max(0, speed);
  x = Math.min(MAX_X, Math.max(-MAX_X, x));

  if (nitroActive) {
    nitro -= NITRO_DRAIN * dt;
    if (nitro <= 0) {
      nitro = 0;
      nitroActive = false;
    }
  }

  return { z: p.z + speed * dt, x, speed, nitro, nitroActive };
}

export function hitProp(p: Player, props: Prop[]): boolean {
  return props.some((prop) => Math.abs(p.x - prop.offset) < PROP_HIT_WIDTH);
}

export function crash(p: Player, speed: number): Player {
  return { ...p, speed, nitroActive: false };
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인합니다**

Run: `npx vitest run tests/player.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋합니다**

```bash
git add -A
git commit -m "feat: add player physics with steering, off-road, and nitro"
```

---

### Task 4: 일반 차량

**Files:**
- Create: `src/game/traffic.ts`
- Test: `tests/traffic.test.ts`

**Interfaces:**
- Consumes: `constants.ts`, `mulberry32`, `Track`, `Car`, `Player`, `GameEvent`
- Produces:
  - `createTraffic(track: Track, seed?: number): Car[]`
  - `updateTraffic(cars: Car[], player: Player, track: Track, dt: number): { cars: Car[]; player: Player; events: GameEvent[] }`

일반 차량은 플레이어 앞쪽으로 `TRAFFIC_ACTIVE_DISTANCE` 이내에 들어온 뒤부터 움직입니다. 이렇게 처리하면 코스 뒤쪽에 배치한 차량이 플레이어가 도착하기 전에 결승점을 지나 사라지는 문제가 생기지 않습니다.

- [ ] **Step 1: 실패하는 테스트를 작성합니다**

`tests/traffic.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CAR_LENGTH, MAX_SPEED, START_Z, STEP, TRAFFIC_ACTIVE_DISTANCE } from '../src/game/constants';
import { createPlayer } from '../src/game/player';
import { buildTrack } from '../src/game/track';
import { createTraffic, updateTraffic } from '../src/game/traffic';
import type { Car, Player } from '../src/game/types';

const track = buildTrack();
const player = (over: Partial<Player>): Player => ({ ...createPlayer(), z: 100000, ...over });
const car = (over: Partial<Car>): Car => ({ z: 0, offset: 0, speed: 3000, passed: false, color: 0, ...over });

describe('createTraffic', () => {
  it('차량 40대를 위치 순서대로 배치합니다', () => {
    const cars = createTraffic(track);
    expect(cars).toHaveLength(40);
    for (let i = 1; i < cars.length; i++) expect(cars[i].z).toBeGreaterThanOrEqual(cars[i - 1].z);
  });

  it('모든 차량은 출발점과 결승점 사이에 있고 플레이어보다 느립니다', () => {
    for (const c of createTraffic(track)) {
      expect(c.z).toBeGreaterThan(START_Z);
      expect(c.z).toBeLessThan(track.finishZ);
      expect(c.speed).toBeLessThan(MAX_SPEED);
      expect(Math.abs(c.offset)).toBeLessThan(1);
      expect(c.passed).toBe(false);
    }
  });

  it('시드가 같으면 배치가 동일합니다', () => {
    expect(createTraffic(track)).toEqual(createTraffic(track));
    expect(createTraffic(track, 1)).not.toEqual(createTraffic(track, 2));
  });

  it('야간 도시 구간에 차량이 더 많습니다', () => {
    const cars = createTraffic(track);
    const count = (from: number, to: number): number => cars.filter((c) => c.z >= from && c.z < to).length;
    expect(count(track.checkpoints[2], track.checkpoints[3])).toBeGreaterThan(
      count(track.checkpoints[0], track.checkpoints[1]),
    );
  });
});

describe('updateTraffic', () => {
  it('가까운 차량만 움직입니다', () => {
    const p = player({});
    const near = car({ z: p.z + 10000 });
    const far = car({ z: p.z + TRAFFIC_ACTIVE_DISTANCE + 1000 });
    const result = updateTraffic([near, far], p, track, STEP);
    expect(result.cars[0].z).toBeCloseTo(near.z + 3000 * STEP, 6);
    expect(result.cars[1].z).toBe(far.z);
  });

  it('뒤를 들이받으면 속도가 그 차량보다 낮아지고 니트로가 종료됩니다', () => {
    const p = player({ speed: MAX_SPEED, nitroActive: true, nitro: 50 });
    const result = updateTraffic([car({ z: p.z + 100 })], p, track, STEP);
    expect(result.events).toEqual(['crash']);
    expect(result.player.speed).toBe(1500);
    expect(result.player.nitroActive).toBe(false);
    expect(result.player.z).toBeCloseTo(result.cars[0].z - CAR_LENGTH, 6);
  });

  it('충돌 직후에는 다시 충돌하지 않습니다', () => {
    const p = player({ speed: MAX_SPEED });
    const first = updateTraffic([car({ z: p.z + 100 })], p, track, STEP);
    const second = updateTraffic(first.cars, first.player, track, STEP);
    expect(second.events).toEqual([]);
  });

  it('좌우 간격이 넓으면 충돌하지 않습니다', () => {
    const p = player({ speed: MAX_SPEED, x: 0.5 });
    const result = updateTraffic([car({ z: p.z + 100 })], p, track, STEP);
    expect(result.events).toEqual([]);
    expect(result.player.speed).toBe(MAX_SPEED);
  });

  it('가깝게 스치며 추월하면 게이지가 25 증가합니다', () => {
    const p = player({ speed: MAX_SPEED, nitro: 10 });
    const result = updateTraffic([car({ z: p.z - 400, offset: 0.4 })], p, track, STEP);
    expect(result.events).toEqual(['nearMiss']);
    expect(result.player.nitro).toBe(35);
    expect(result.cars[0].passed).toBe(true);
  });

  it('간격을 두고 추월하면 게이지가 5 증가합니다', () => {
    const p = player({ speed: MAX_SPEED, x: -0.3, nitro: 10 });
    const result = updateTraffic([car({ z: p.z - 400, offset: 0.6 })], p, track, STEP);
    expect(result.events).toEqual(['pass']);
    expect(result.player.nitro).toBe(15);
  });

  it('같은 차량을 두 번 계산하지 않습니다', () => {
    const p = player({ speed: MAX_SPEED });
    const first = updateTraffic([car({ z: p.z - 400, offset: 0.4 })], p, track, STEP);
    const second = updateTraffic(first.cars, first.player, track, STEP);
    expect(second.events).toEqual([]);
    expect(second.player.nitro).toBe(25);
  });

  it('게이지는 100을 넘지 않습니다', () => {
    const p = player({ speed: MAX_SPEED, nitro: 90 });
    const result = updateTraffic([car({ z: p.z - 400, offset: 0.4 })], p, track, STEP);
    expect(result.player.nitro).toBe(100);
  });

  it('차량은 코스 끝을 넘어가지 않습니다', () => {
    const p = player({ z: track.length - 2000 });
    let cars = [car({ z: track.length - 500, speed: 6000 })];
    for (let i = 0; i < 120; i++) cars = updateTraffic(cars, p, track, STEP).cars;
    expect(cars[0].z).toBeLessThan(track.length);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인합니다**

Run: `npx vitest run tests/traffic.test.ts`
Expected: FAIL. `../src/game/traffic`을 찾을 수 없다는 오류가 출력됩니다.

- [ ] **Step 3: 구현을 작성합니다**

`src/game/traffic.ts`:

```ts
import {
  CAR_COLOR_COUNT,
  CAR_HIT_WIDTH,
  CAR_LENGTH,
  MAX_SPEED,
  NEAR_MISS_WIDTH,
  NITRO_MAX,
  NITRO_NEAR_GAIN,
  NITRO_PASS_GAIN,
  SEGMENT_LENGTH,
  START_Z,
  TRAFFIC_ACTIVE_DISTANCE,
  TRAFFIC_SEED,
} from './constants';
import { mulberry32 } from './random';
import type { Car, GameEvent, Player, Track } from './types';

const LANE_OFFSETS = [-0.6, 0, 0.6];
const BASE_CARS = 28;
const CITY_CARS = 12;
const FIRST_CAR_GAP = SEGMENT_LENGTH * 60;

export function createTraffic(track: Track, seed = TRAFFIC_SEED): Car[] {
  const rand = mulberry32(seed);
  const cars: Car[] = [];
  const add = (from: number, to: number, count: number): void => {
    for (let i = 0; i < count; i++) {
      cars.push({
        z: from + ((to - from) * (i + rand())) / count,
        offset: LANE_OFFSETS[Math.floor(rand() * LANE_OFFSETS.length)],
        speed: MAX_SPEED * (0.25 + rand() * 0.3),
        passed: false,
        color: Math.floor(rand() * CAR_COLOR_COUNT),
      });
    }
  };
  add(START_Z + FIRST_CAR_GAP, track.finishZ, BASE_CARS);
  add(track.checkpoints[2], track.checkpoints[3], CITY_CARS);
  return cars.sort((a, b) => a.z - b.z);
}

export function updateTraffic(
  cars: Car[],
  player: Player,
  track: Track,
  dt: number,
): { cars: Car[]; player: Player; events: GameEvent[] } {
  const events: GameEvent[] = [];
  const maxZ = track.length - SEGMENT_LENGTH;
  let p = player;

  const next = cars.map((car) => {
    let z = car.z;
    if (z - p.z < TRAFFIC_ACTIVE_DISTANCE) z = Math.min(maxZ, z + car.speed * dt);
    let passed = car.passed;
    const gap = Math.abs(p.x - car.offset);
    const ahead = z - p.z;

    if (ahead >= 0 && ahead < CAR_LENGTH && gap < CAR_HIT_WIDTH && p.speed > car.speed) {
      p = { ...p, speed: car.speed * 0.5, z: z - CAR_LENGTH, nitroActive: false };
      events.push('crash');
    } else if (!passed && ahead < 0) {
      passed = true;
      const near = gap < NEAR_MISS_WIDTH;
      const gain = near ? NITRO_NEAR_GAIN : NITRO_PASS_GAIN;
      p = { ...p, nitro: Math.min(NITRO_MAX, p.nitro + gain) };
      events.push(near ? 'nearMiss' : 'pass');
    }

    return z === car.z && passed === car.passed ? car : { ...car, z, passed };
  });

  return { cars: next, player: p, events };
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인합니다**

Run: `npx vitest run tests/traffic.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋합니다**

```bash
git add -A
git commit -m "feat: add traffic with collisions and near-miss nitro gain"
```

---

### Task 5: 경주 규칙과 단계 갱신

**Files:**
- Create: `src/game/race.ts`, `src/game/step.ts`, `src/game/loop.ts`
- Test: `tests/race.test.ts`, `tests/step.test.ts`, `tests/loop.test.ts`

**Interfaces:**
- Consumes: `createPlayer`, `updatePlayer`, `hitProp`, `crash`, `createTraffic`, `updateTraffic`, `segmentAt`
- Produces:
  - `updateRace(state: GameState, track: Track, dt: number): GameState`
  - `distanceOf(player: Player): number`
  - `applyResult(records: Records, state: GameState): { records: Records; isNew: boolean }`
  - `createGame(track: Track): GameState`, `startRace(track: Track): GameState`
  - `requestStart(state: GameState, track: Track): GameState`
  - `step(state: GameState, input: Input, track: Track, dt: number): GameState`
  - `accumulate(acc: number, frameSeconds: number): number`

- [ ] **Step 1: 실패하는 테스트를 작성합니다**

`tests/race.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CHECKPOINT_BONUS, START_TIME, START_Z } from '../src/game/constants';
import { applyResult, distanceOf, updateRace } from '../src/game/race';
import { startRace } from '../src/game/step';
import { buildTrack } from '../src/game/track';
import type { GameState, Player } from '../src/game/types';

const track = buildTrack();

function make(over: Partial<GameState> = {}, playerOver: Partial<Player> = {}): GameState {
  const base = startRace(track);
  return { ...base, cars: [], ...over, player: { ...base.player, speed: 5000, ...playerOver } };
}

describe('updateRace', () => {
  it('남은 시간이 줄고 경과 시간이 늘어납니다', () => {
    const next = updateRace(make(), track, 1);
    expect(next.time).toBe(START_TIME - 1);
    expect(next.elapsed).toBe(1);
    expect(next.phase).toBe('racing');
  });

  it('체크포인트를 통과하면 시간이 30초 추가됩니다', () => {
    const next = updateRace(make({ elapsed: 20 }, { z: track.checkpoints[0] }), track, 1);
    expect(next.checkpointsPassed).toBe(1);
    expect(next.time).toBe(START_TIME - 1 + CHECKPOINT_BONUS);
    expect(next.lastCheckpointAt).toBe(21);
    expect(next.events).toContain('checkpoint');
  });

  it('같은 체크포인트를 두 번 계산하지 않습니다', () => {
    const first = updateRace(make({}, { z: track.checkpoints[0] }), track, 1);
    const second = updateRace({ ...first, events: [] }, track, 1);
    expect(second.checkpointsPassed).toBe(1);
    expect(second.events).not.toContain('checkpoint');
  });

  it('시간이 0이어도 차량이 움직이는 동안에는 끝나지 않습니다', () => {
    const next = updateRace(make({ time: 0 }, { speed: 500 }), track, 1);
    expect(next.time).toBe(0);
    expect(next.phase).toBe('racing');
  });

  it('시간이 0이고 차량이 멈추면 실패로 종료합니다', () => {
    const next = updateRace(make({ time: 0 }, { speed: 0 }), track, 1);
    expect(next.phase).toBe('timeUp');
    expect(next.events).toContain('timeUp');
  });

  it('시간이 0인 상태로 체크포인트에 도달하면 경주가 이어집니다', () => {
    const next = updateRace(make({ time: 0 }, { speed: 0, z: track.checkpoints[0] }), track, 1);
    expect(next.time).toBe(CHECKPOINT_BONUS);
    expect(next.phase).toBe('racing');
  });

  it('결승점을 통과하면 완주로 종료합니다', () => {
    const next = updateRace(make({ checkpointsPassed: 4 }, { z: track.finishZ }), track, 1);
    expect(next.phase).toBe('finished');
    expect(next.events).toContain('finish');
  });

  it('남은 시간이 10초 이하일 때 1초마다 경고를 냅니다', () => {
    expect(updateRace(make({ time: 10.005 }), track, 0.01).events).toContain('timeWarning');
    expect(updateRace(make({ time: 9.5 }), track, 0.01).events).not.toContain('timeWarning');
    expect(updateRace(make({ time: 20.005 }), track, 0.01).events).not.toContain('timeWarning');
  });
});

describe('기록', () => {
  it('도달 거리는 출발 위치를 기준으로 계산합니다', () => {
    expect(distanceOf({ ...make().player, z: START_Z + 500 })).toBe(500);
    expect(distanceOf({ ...make().player, z: 0 })).toBe(0);
  });

  it('첫 완주는 신기록입니다', () => {
    const state = make({ phase: 'finished', elapsed: 140 }, { z: track.finishZ });
    const result = applyResult({ bestTime: null, bestDistance: 0 }, state);
    expect(result.isNew).toBe(true);
    expect(result.records.bestTime).toBe(140);
    expect(result.records.bestDistance).toBe(track.finishZ - START_Z);
  });

  it('완주 시간이 더 짧을 때에만 기록을 갱신합니다', () => {
    const slow = make({ phase: 'finished', elapsed: 150 }, { z: track.finishZ });
    const fast = make({ phase: 'finished', elapsed: 130 }, { z: track.finishZ });
    const records = { bestTime: 140, bestDistance: 0 };
    expect(applyResult(records, slow).isNew).toBe(false);
    expect(applyResult(records, slow).records.bestTime).toBe(140);
    expect(applyResult(records, fast).isNew).toBe(true);
    expect(applyResult(records, fast).records.bestTime).toBe(130);
  });

  it('실패했을 때는 더 멀리 간 경우에만 거리 기록을 갱신합니다', () => {
    const state = make({ phase: 'timeUp' }, { z: START_Z + 5000 });
    const better = applyResult({ bestTime: null, bestDistance: 4000 }, state);
    expect(better.isNew).toBe(true);
    expect(better.records).toEqual({ bestTime: null, bestDistance: 5000 });
    const worse = applyResult({ bestTime: 140, bestDistance: 9000 }, state);
    expect(worse.isNew).toBe(false);
    expect(worse.records).toEqual({ bestTime: 140, bestDistance: 9000 });
  });

  it('경주가 끝나지 않았으면 기록을 바꾸지 않습니다', () => {
    const records = { bestTime: null, bestDistance: 0 };
    expect(applyResult(records, make())).toEqual({ records, isNew: false });
  });
});
```

`tests/step.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { MAX_SPEED, PROP_CRASH_SPEED, SEGMENT_LENGTH, START_TIME, STEP } from '../src/game/constants';
import { createGame, requestStart, startRace, step } from '../src/game/step';
import { buildTrack } from '../src/game/track';
import type { GameState, Input } from '../src/game/types';

const track = buildTrack();
const idle: Input = { left: false, right: false, accel: false, brake: false, nitro: false };
const key = (over: Partial<Input>): Input => ({ ...idle, ...over });

describe('createGame과 startRace', () => {
  it('타이틀 상태로 시작합니다', () => {
    const state = createGame(track);
    expect(state.phase).toBe('title');
    expect(state.time).toBe(START_TIME);
    expect(state.cars).toHaveLength(40);
    expect(state.events).toEqual([]);
  });

  it('startRace는 주행 상태를 만듭니다', () => {
    expect(startRace(track).phase).toBe('racing');
  });
});

describe('requestStart', () => {
  it('주행 중에는 상태를 바꾸지 않습니다', () => {
    const racing = { ...startRace(track), elapsed: 30 };
    expect(requestStart(racing, track)).toBe(racing);
  });

  it('타이틀과 결과 화면에서는 새 경주를 시작합니다', () => {
    expect(requestStart(createGame(track), track).phase).toBe('racing');
    const over: GameState = { ...startRace(track), phase: 'timeUp', time: 0, elapsed: 90 };
    const next = requestStart(over, track);
    expect(next.phase).toBe('racing');
    expect(next.time).toBe(START_TIME);
    expect(next.elapsed).toBe(0);
  });
});

describe('step', () => {
  it('주행 중이 아니면 상태를 그대로 반환합니다', () => {
    const state = createGame(track);
    expect(step(state, key({ accel: true }), track, STEP)).toBe(state);
  });

  it('종료된 뒤 다음 단계에서 사건 목록을 비웁니다', () => {
    const over: GameState = { ...startRace(track), phase: 'finished', events: ['finish'] };
    const next = step(over, idle, track, STEP);
    expect(next.events).toEqual([]);
    expect(next.phase).toBe('finished');
  });

  it('가속하면 앞으로 이동하고 시간이 흐릅니다', () => {
    const start = startRace(track);
    const next = step(start, key({ accel: true }), track, STEP);
    expect(next.player.speed).toBeGreaterThan(0);
    expect(next.player.z).toBeGreaterThan(start.player.z);
    expect(next.time).toBeLessThan(START_TIME);
  });

  it('니트로가 시작되면 사건을 기록합니다', () => {
    const base = startRace(track);
    const state = { ...base, cars: [], player: { ...base.player, speed: MAX_SPEED, nitro: 50 } };
    expect(step(state, key({ nitro: true }), track, STEP).events).toContain('nitroStart');
    const active = step(state, key({ nitro: true }), track, STEP);
    expect(step(active, key({ nitro: true }), track, STEP).events).not.toContain('nitroStart');
  });

  it('길가 사물에 부딪히면 속도가 거의 0으로 줄어듭니다', () => {
    const segment = track.segments.find((s) => s.index > 100 && s.props.some((pr) => Math.abs(pr.offset) < 1.9))!;
    const prop = segment.props[0];
    const base = startRace(track);
    const state = {
      ...base,
      cars: [],
      player: { ...base.player, z: segment.index * SEGMENT_LENGTH + 10, x: prop.offset, speed: MAX_SPEED / 2 },
    };
    const next = step(state, idle, track, STEP);
    expect(next.events).toContain('crash');
    expect(next.player.speed).toBe(PROP_CRASH_SPEED);
  });

  it('도로 안에서는 길가 사물과 충돌하지 않습니다', () => {
    const base = startRace(track);
    let state: GameState = { ...base, cars: [], player: { ...base.player, speed: MAX_SPEED } };
    for (let i = 0; i < 120; i++) state = step(state, key({ accel: true }), track, STEP);
    expect(state.player.speed).toBe(MAX_SPEED);
  });

  it('시간이 0이 되면 차량이 멈춘 뒤 실패로 종료합니다', () => {
    const base = startRace(track);
    let state: GameState = { ...base, cars: [], time: 0.01, player: { ...base.player, speed: MAX_SPEED } };
    for (let i = 0; i < 20 * 60 && state.phase === 'racing'; i++) {
      state = step(state, key({ accel: true }), track, STEP);
    }
    expect(state.phase).toBe('timeUp');
    expect(state.player.speed).toBe(0);
  });

  it('30초 동안 가속만 해도 모든 값이 유한합니다', () => {
    let state = startRace(track);
    for (let i = 0; i < 30 * 60; i++) state = step(state, key({ accel: true }), track, STEP);
    const { player } = state;
    for (const v of [player.z, player.x, player.speed, player.nitro, state.time, state.elapsed]) {
      expect(Number.isFinite(v)).toBe(true);
    }
    expect(player.z).toBeGreaterThan(startRace(track).player.z);
    expect(Math.abs(player.x)).toBeLessThanOrEqual(2);
  });
});
```

`tests/loop.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { MAX_FRAME_TIME } from '../src/game/constants';
import { accumulate } from '../src/game/loop';

describe('accumulate', () => {
  it('프레임 시간을 누적합니다', () => {
    expect(accumulate(0.01, 0.016)).toBeCloseTo(0.026, 8);
  });

  it('탭이 오래 멈춰 있었어도 누적 시간을 제한합니다', () => {
    expect(accumulate(0, 30)).toBe(MAX_FRAME_TIME);
  });

  it('음수이거나 유효하지 않은 프레임 시간은 무시합니다', () => {
    expect(accumulate(0.02, -1)).toBe(0.02);
    expect(accumulate(0.02, Number.NaN)).toBe(0.02);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인합니다**

Run: `npx vitest run tests/race.test.ts tests/step.test.ts tests/loop.test.ts`
Expected: FAIL. `race`, `step`, `loop` 모듈을 찾을 수 없다는 오류가 출력됩니다.

- [ ] **Step 3: 구현을 작성합니다**

`src/game/race.ts`:

```ts
import { CHECKPOINT_BONUS, START_Z, WARNING_SECONDS } from './constants';
import type { GameState, Player, Records, Track } from './types';

/** 이동이 끝난 상태를 받아서 시간, 체크포인트, 종료 여부를 갱신합니다. */
export function updateRace(state: GameState, track: Track, dt: number): GameState {
  const events = [...state.events];
  const before = state.time;
  const elapsed = state.elapsed + dt;
  let time = Math.max(0, state.time - dt);
  let { checkpointsPassed, lastCheckpointAt, phase } = state;

  while (
    checkpointsPassed < track.checkpoints.length &&
    state.player.z >= track.checkpoints[checkpointsPassed]
  ) {
    checkpointsPassed++;
    time += CHECKPOINT_BONUS;
    lastCheckpointAt = elapsed;
    events.push('checkpoint');
  }

  if (state.player.z >= track.finishZ) {
    phase = 'finished';
    events.push('finish');
  } else if (time <= 0 && state.player.speed <= 0) {
    phase = 'timeUp';
    events.push('timeUp');
  } else if (time > 0 && time <= WARNING_SECONDS && Math.ceil(time) < Math.ceil(before)) {
    events.push('timeWarning');
  }

  return { ...state, phase, time, elapsed, checkpointsPassed, lastCheckpointAt, events };
}

export function distanceOf(player: Player): number {
  return Math.max(0, player.z - START_Z);
}

export function applyResult(records: Records, state: GameState): { records: Records; isNew: boolean } {
  const distance = distanceOf(state.player);
  if (state.phase === 'finished') {
    const isNew = records.bestTime === null || state.elapsed < records.bestTime;
    return {
      records: {
        bestTime: isNew ? state.elapsed : records.bestTime,
        bestDistance: Math.max(records.bestDistance, distance),
      },
      isNew,
    };
  }
  if (state.phase === 'timeUp') {
    const isNew = distance > records.bestDistance;
    return { records: isNew ? { ...records, bestDistance: distance } : records, isNew };
  }
  return { records, isNew: false };
}
```

`src/game/step.ts`:

```ts
import { PROP_CRASH_SPEED, START_TIME, THEME_BLEND_SECONDS } from './constants';
import { crash, createPlayer, hitProp, updatePlayer } from './player';
import { updateRace } from './race';
import { segmentAt } from './track';
import { createTraffic, updateTraffic } from './traffic';
import type { GameEvent, GameState, Input, Track } from './types';

export function createGame(track: Track): GameState {
  return {
    phase: 'title',
    player: createPlayer(),
    cars: createTraffic(track),
    time: START_TIME,
    elapsed: 0,
    checkpointsPassed: 0,
    lastCheckpointAt: -THEME_BLEND_SECONDS,
    events: [],
  };
}

export function startRace(track: Track): GameState {
  return { ...createGame(track), phase: 'racing' };
}

/** 시작 키 입력을 처리합니다. 주행 중에는 무시합니다. */
export function requestStart(state: GameState, track: Track): GameState {
  return state.phase === 'racing' ? state : startRace(track);
}

export function step(state: GameState, input: Input, track: Track, dt: number): GameState {
  if (state.phase !== 'racing') {
    return state.events.length > 0 ? { ...state, events: [] } : state;
  }

  const events: GameEvent[] = [];
  const from = segmentAt(track, state.player.z);
  let player = updatePlayer(state.player, input, from.curve, dt, state.time > 0);
  if (player.nitroActive && !state.player.nitroActive) events.push('nitroStart');

  if (Math.abs(player.x) > 1 && player.speed > PROP_CRASH_SPEED * 2) {
    const to = segmentAt(track, player.z).index;
    for (let i = from.index; i <= to; i++) {
      if (hitProp(player, track.segments[i].props)) {
        player = crash(player, PROP_CRASH_SPEED);
        events.push('crash');
        break;
      }
    }
  }

  const traffic = updateTraffic(state.cars, player, track, dt);
  events.push(...traffic.events);

  return updateRace({ ...state, player: traffic.player, cars: traffic.cars, events }, track, dt);
}
```

`src/game/loop.ts`:

```ts
import { MAX_FRAME_TIME } from './constants';

/** 프레임 사이에 지난 시간을 누적하되, 한 번에 처리할 양을 제한합니다. */
export function accumulate(acc: number, frameSeconds: number): number {
  if (!Number.isFinite(frameSeconds) || frameSeconds <= 0) return acc;
  return Math.min(MAX_FRAME_TIME, acc + frameSeconds);
}
```

- [ ] **Step 4: 전체 테스트가 통과하는지 확인합니다**

Run: `npm test`
Expected: 모든 테스트가 PASS합니다.

- [ ] **Step 5: 커밋합니다**

```bash
git add -A
git commit -m "feat: add race rules, step function, and frame accumulator"
```

---

### Task 6: 기록 저장과 표시 문자열

**Files:**
- Create: `src/storage.ts`, `src/format.ts`
- Test: `tests/storage.test.ts`, `tests/format.test.ts`

**Interfaces:**
- Consumes: `Records`, `MAX_SPEED`, `TOP_KMH`, `UNITS_PER_METER`
- Produces:
  - `type RecordStore = Pick<Storage, 'getItem' | 'setItem'>`
  - `browserStorage(): RecordStore | null`
  - `loadRecords(store: RecordStore | null): Records`
  - `saveRecords(store: RecordStore | null, records: Records): void`
  - `formatTime(seconds: number): string`, `formatKm(units: number): string`, `speedKmh(speed: number): number`

- [ ] **Step 1: 실패하는 테스트를 작성합니다**

`tests/storage.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { browserStorage, loadRecords, saveRecords, type RecordStore } from '../src/storage';

function fakeStore(initial?: string): RecordStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set('retro-racer.records', initial);
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

const EMPTY = { bestTime: null, bestDistance: 0 };

describe('기록 저장', () => {
  it('저장한 기록을 다시 불러옵니다', () => {
    const store = fakeStore();
    saveRecords(store, { bestTime: 141.5, bestDistance: 900000 });
    expect(loadRecords(store)).toEqual({ bestTime: 141.5, bestDistance: 900000 });
  });

  it('저장된 값이 없으면 기본값을 반환합니다', () => {
    expect(loadRecords(fakeStore())).toEqual(EMPTY);
  });

  it('손상된 값은 기본값으로 대체합니다', () => {
    expect(loadRecords(fakeStore('not json'))).toEqual(EMPTY);
    expect(loadRecords(fakeStore('null'))).toEqual(EMPTY);
    expect(loadRecords(fakeStore('[1,2]'))).toEqual(EMPTY);
    expect(loadRecords(fakeStore('{"bestTime":"빠름","bestDistance":"멀리"}'))).toEqual(EMPTY);
    expect(loadRecords(fakeStore('{"bestTime":-5,"bestDistance":-100}'))).toEqual(EMPTY);
  });

  it('유효한 항목만 받아들입니다', () => {
    expect(loadRecords(fakeStore('{"bestTime":"x","bestDistance":1200}'))).toEqual({
      bestTime: null,
      bestDistance: 1200,
    });
  });

  it('저장소가 없으면 오류 없이 기본값을 반환합니다', () => {
    expect(loadRecords(null)).toEqual(EMPTY);
    expect(() => saveRecords(null, EMPTY)).not.toThrow();
  });

  it('저장소가 예외를 던져도 오류를 내지 않습니다', () => {
    const broken: RecordStore = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('quota');
      },
    };
    expect(loadRecords(broken)).toEqual(EMPTY);
    expect(() => saveRecords(broken, EMPTY)).not.toThrow();
  });

  it('브라우저가 아닌 환경에서는 저장소가 없습니다', () => {
    expect(browserStorage()).toBeNull();
  });
});
```

`tests/format.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { formatKm, formatTime, speedKmh } from '../src/format';
import { MAX_SPEED } from '../src/game/constants';

describe('표시 문자열', () => {
  it('시간을 분:초.백분의 일초 형식으로 표시합니다', () => {
    expect(formatTime(83.456)).toBe('1:23.45');
    expect(formatTime(5)).toBe('0:05.00');
    expect(formatTime(0)).toBe('0:00.00');
    expect(formatTime(-3)).toBe('0:00.00');
  });

  it('거리를 km 단위로 표시합니다', () => {
    expect(formatKm(1800000)).toBe('10.00 km');
    expect(formatKm(0)).toBe('0.00 km');
  });

  it('최고 속도는 시속 240km로 표시합니다', () => {
    expect(speedKmh(MAX_SPEED)).toBe(240);
    expect(speedKmh(0)).toBe(0);
    expect(speedKmh(MAX_SPEED / 2)).toBe(120);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인합니다**

Run: `npx vitest run tests/storage.test.ts tests/format.test.ts`
Expected: FAIL. `../src/storage`와 `../src/format`을 찾을 수 없다는 오류가 출력됩니다.

- [ ] **Step 3: 구현을 작성합니다**

`src/storage.ts`:

```ts
import type { Records } from './game/types';

export type RecordStore = Pick<Storage, 'getItem' | 'setItem'>;

const KEY = 'retro-racer.records';

const empty = (): Records => ({ bestTime: null, bestDistance: 0 });

export function browserStorage(): RecordStore | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadRecords(store: RecordStore | null): Records {
  if (!store) return empty();
  try {
    const raw = store.getItem(KEY);
    if (!raw) return empty();
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) return empty();
    const { bestTime, bestDistance } = value as Record<string, unknown>;
    return {
      bestTime: typeof bestTime === 'number' && Number.isFinite(bestTime) && bestTime > 0 ? bestTime : null,
      bestDistance:
        typeof bestDistance === 'number' && Number.isFinite(bestDistance) && bestDistance > 0 ? bestDistance : 0,
    };
  } catch {
    return empty();
  }
}

export function saveRecords(store: RecordStore | null, records: Records): void {
  if (!store) return;
  try {
    store.setItem(KEY, JSON.stringify(records));
  } catch {
    // 저장할 수 없는 환경에서는 기록 저장만 생략합니다.
  }
}
```

`src/format.ts`:

```ts
import { MAX_SPEED, TOP_KMH, UNITS_PER_METER } from './game/constants';

export function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds * 100));
  const minutes = Math.floor(total / 6000);
  const secs = Math.floor((total % 6000) / 100);
  const centis = total % 100;
  return `${minutes}:${String(secs).padStart(2, '0')}.${String(centis).padStart(2, '0')}`;
}

export function formatKm(units: number): string {
  return `${(units / UNITS_PER_METER / 1000).toFixed(2)} km`;
}

export function speedKmh(speed: number): number {
  return Math.round((speed / MAX_SPEED) * TOP_KMH);
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인합니다**

Run: `npx vitest run tests/storage.test.ts tests/format.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋합니다**

```bash
git add -A
git commit -m "feat: add record storage and display formatting"
```

---

### Task 7: 화면 그리기

**Files:**
- Create: `src/render/projection.ts`, `src/render/road.ts`, `src/render/background.ts`, `src/render/sprites.ts`, `src/render/text.ts`, `src/render/hud.ts`, `src/render/screens.ts`, `src/render/render.ts`
- Test: `tests/projection.test.ts`, `tests/road.test.ts`

**Interfaces:**
- Consumes: `constants.ts`, `themes.ts`, `segmentAt`, `heightAt`, `distanceOf`, `format.ts`, 모든 타입
- Produces:
  - `project(worldX, worldY, worldZ, cameraX, cameraY, cameraZ): Projected` (`Projected = { x, y, w, scale }`)
  - `computeVisible(track: Track, player: Player): VisibleSegment[]`
  - `interface View { records: Records; newRecord: boolean; steer: number; muted: boolean }`
  - `render(ctx: CanvasRenderingContext2D, state: GameState, track: Track, view: View): void`

투영 계산과 보이는 구간 계산은 캔버스 없이 검증할 수 있으므로 테스트를 먼저 작성합니다. 도형을 그리는 코드는 자동 테스트 대상이 아니며, Task 8에서 브라우저로 확인합니다.

- [ ] **Step 1: 실패하는 테스트를 작성합니다**

`tests/projection.test.ts`:

```ts
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
```

`tests/road.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DRAW_DISTANCE, HEIGHT, MAX_SPEED } from '../src/game/constants';
import { createPlayer } from '../src/game/player';
import { buildTrack } from '../src/game/track';
import { computeVisible } from '../src/render/road';

const track = buildTrack();

describe('computeVisible', () => {
  it('출발 위치에서 그릴 구간을 가까운 순서대로 반환합니다', () => {
    const visible = computeVisible(track, createPlayer());
    expect(visible.length).toBeGreaterThan(100);
    expect(visible.length).toBeLessThanOrEqual(DRAW_DISTANCE);
    for (let i = 1; i < visible.length; i++) {
      expect(visible[i].segment.index).toBe(visible[i - 1].segment.index + 1);
    }
  });

  it('그리는 구간은 화면에서 위쪽으로 이어집니다', () => {
    const visible = computeVisible(track, createPlayer());
    const drawn = visible.filter((v) => v.drawn);
    expect(drawn.length).toBeGreaterThan(50);
    for (const v of drawn) expect(v.p2.y).toBeLessThan(v.p1.y);
    expect(drawn[0].p1.y).toBeGreaterThanOrEqual(HEIGHT);
  });

  it('가림 높이는 멀어질수록 작아지거나 같습니다', () => {
    const visible = computeVisible(track, { ...createPlayer(), z: 400000 });
    expect(visible[0].clip).toBe(HEIGHT);
    for (let i = 1; i < visible.length; i++) {
      expect(visible[i].clip).toBeLessThanOrEqual(visible[i - 1].clip);
    }
  });

  it('안개 농도는 0과 1 사이에서 멀어질수록 커집니다', () => {
    const visible = computeVisible(track, createPlayer());
    for (const v of visible) {
      expect(v.fog).toBeGreaterThanOrEqual(0);
      expect(v.fog).toBeLessThan(1);
    }
    expect(visible[visible.length - 1].fog).toBeGreaterThan(visible[0].fog);
  });

  it('코스 끝에서도 오류 없이 남은 구간만 반환합니다', () => {
    const visible = computeVisible(track, { ...createPlayer(), z: track.length - 1000, speed: MAX_SPEED });
    expect(visible.length).toBeGreaterThan(0);
    expect(visible.length).toBeLessThan(DRAW_DISTANCE);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인합니다**

Run: `npx vitest run tests/projection.test.ts tests/road.test.ts`
Expected: FAIL. `../src/render/projection`과 `../src/render/road`를 찾을 수 없다는 오류가 출력됩니다.

- [ ] **Step 3: 투영과 도로를 구현합니다**

`src/render/projection.ts`:

```ts
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
): Projected {
  const scale = CAMERA_DEPTH / (worldZ - cameraZ);
  return {
    x: WIDTH / 2 + (scale * (worldX - cameraX) * WIDTH) / 2,
    y: HEIGHT / 2 - (scale * (worldY - cameraY) * HEIGHT) / 2,
    w: (scale * ROAD_WIDTH * WIDTH) / 2,
    scale,
  };
}
```

`src/render/road.ts`:

```ts
import {
  CAMERA_HEIGHT,
  DRAW_DISTANCE,
  HEIGHT,
  LANES,
  PLAYER_DISTANCE,
  ROAD_WIDTH,
  RUMBLE_LENGTH,
  SEGMENT_LENGTH,
  WIDTH,
} from '../game/constants';
import { css, shade } from '../game/themes';
import { heightAt, segmentAt } from '../game/track';
import type { Player, Segment, Theme, Track } from '../game/types';
import { project, type Projected } from './projection';

export interface VisibleSegment {
  segment: Segment;
  p1: Projected;
  p2: Projected;
  /** 이 구간의 사물을 그릴 때 이 높이보다 아래쪽은 잘라냅니다. */
  clip: number;
  fog: number;
  drawn: boolean;
}

const MAX_FOG = 0.9;

export function computeVisible(track: Track, player: Player): VisibleSegment[] {
  const cameraZ = player.z - PLAYER_DISTANCE;
  const base = segmentAt(track, cameraZ);
  const basePercent = Math.min(1, Math.max(0, (cameraZ - base.index * SEGMENT_LENGTH) / SEGMENT_LENGTH));
  const cameraY = heightAt(track, player.z) + CAMERA_HEIGHT;
  const cameraX = player.x * ROAD_WIDTH;

  const visible: VisibleSegment[] = [];
  let x = 0;
  let dx = -base.curve * basePercent;
  let maxY = HEIGHT;

  for (let n = 0; n < DRAW_DISTANCE; n++) {
    const segment = track.segments[base.index + n];
    if (!segment) break;
    const z1 = segment.index * SEGMENT_LENGTH;
    const shift = x;
    x += dx;
    dx += segment.curve;
    if (z1 <= cameraZ) continue;

    const p1 = project(0, segment.y1, z1, cameraX - shift, cameraY, cameraZ);
    const p2 = project(0, segment.y2, z1 + SEGMENT_LENGTH, cameraX - x, cameraY, cameraZ);
    const drawn = p2.y < p1.y && p2.y < maxY;
    visible.push({ segment, p1, p2, clip: maxY, fog: Math.pow(n / DRAW_DISTANCE, 3) * MAX_FOG, drawn });
    if (drawn) maxY = p2.y;
  }
  return visible;
}

function quad(
  ctx: CanvasRenderingContext2D,
  color: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  x4: number,
  y4: number,
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineTo(x3, y3);
  ctx.lineTo(x4, y4);
  ctx.closePath();
  ctx.fill();
}

export function drawRoad(ctx: CanvasRenderingContext2D, visible: VisibleSegment[], theme: Theme): void {
  const ground = [css(theme.ground), css(shade(theme.ground, 0.93))];
  const road = [css(theme.road), css(shade(theme.road, 0.94))];
  const rumble = [css(theme.rumble), css([245, 245, 245])];
  const lane = css(theme.lane);

  // 먼 구간부터 그려서 가까운 구간이 경계선의 틈을 덮도록 합니다.
  for (let i = visible.length - 1; i >= 0; i--) {
    const v = visible[i];
    if (!v.drawn) continue;
    const { p1, p2 } = v;
    const alt = Math.floor(v.segment.index / RUMBLE_LENGTH) % 2;
    const height = p1.y - p2.y + 1;

    ctx.fillStyle = ground[alt];
    ctx.fillRect(0, p2.y, WIDTH, height);

    const r1 = p1.w / 6;
    const r2 = p2.w / 6;
    quad(ctx, rumble[alt], p1.x - p1.w - r1, p1.y, p1.x - p1.w, p1.y, p2.x - p2.w, p2.y, p2.x - p2.w - r2, p2.y);
    quad(ctx, rumble[alt], p1.x + p1.w + r1, p1.y, p1.x + p1.w, p1.y, p2.x + p2.w, p2.y, p2.x + p2.w + r2, p2.y);
    quad(ctx, road[alt], p1.x - p1.w, p1.y, p1.x + p1.w, p1.y, p2.x + p2.w, p2.y, p2.x - p2.w, p2.y);

    if (alt === 0) {
      const l1 = p1.w / 32;
      const l2 = p2.w / 32;
      for (let n = 1; n < LANES; n++) {
        const c1 = p1.x - p1.w + (2 * p1.w * n) / LANES;
        const c2 = p2.x - p2.w + (2 * p2.w * n) / LANES;
        quad(ctx, lane, c1 - l1, p1.y, c1 + l1, p1.y, c2 + l2, p2.y, c2 - l2, p2.y);
      }
    }

    if (v.fog > 0.01) {
      ctx.fillStyle = css(theme.fog, v.fog);
      ctx.fillRect(0, p2.y, WIDTH, height);
    }
  }
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인합니다**

Run: `npx vitest run tests/projection.test.ts tests/road.test.ts`
Expected: PASS

- [ ] **Step 5: 배경, 사물, 글자를 구현합니다**

`src/render/background.ts`:

```ts
import { HEIGHT, WIDTH } from '../game/constants';
import { css, lerpColor, luminance } from '../game/themes';
import type { Theme } from '../game/types';

const mod = (value: number, size: number): number => ((value % size) + size) % size;

function hills(
  ctx: CanvasRenderingContext2D,
  color: string,
  shift: number,
  base: number,
  amplitude: number,
  frequency: number,
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, HEIGHT);
  for (let x = 0; x <= WIDTH; x += 8) {
    const a = (x + shift) * frequency;
    ctx.lineTo(x, base - amplitude * (0.6 + 0.4 * Math.sin(a) + 0.25 * Math.sin(a * 2.7 + 1.3)));
  }
  ctx.lineTo(WIDTH, HEIGHT);
  ctx.closePath();
  ctx.fill();
}

/** heading은 현재 구간까지 누적된 커브 값이며, 커브를 돌 때 원경을 좌우로 움직이는 데 사용합니다. */
export function drawBackground(ctx: CanvasRenderingContext2D, theme: Theme, heading: number): void {
  const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT * 0.6);
  sky.addColorStop(0, css(theme.skyTop));
  sky.addColorStop(1, css(theme.skyBottom));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const night = Math.max(0, 1 - luminance(theme.skyTop) / 90);
  if (night > 0) {
    ctx.fillStyle = css([255, 255, 255], night * 0.9);
    for (let i = 0; i < 70; i++) {
      ctx.fillRect(mod(i * 197.3 - heading * 0.05, WIDTH), (i * 89.7) % (HEIGHT * 0.45), 2, 2);
    }
  }

  const sunX = mod(WIDTH * 0.72 - heading * 0.1, WIDTH * 1.4) - WIDTH * 0.2;
  const sunY = HEIGHT * 0.24;
  const sun = lerpColor([255, 244, 190], [225, 230, 245], night);
  ctx.fillStyle = css(sun, 0.25);
  ctx.beginPath();
  ctx.arc(sunX, sunY, 58, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = css(sun);
  ctx.beginPath();
  ctx.arc(sunX, sunY, 36, 0, Math.PI * 2);
  ctx.fill();

  hills(ctx, css(lerpColor(theme.ground, theme.skyBottom, 0.65)), heading * 0.2, HEIGHT * 0.5, 46, 0.006);
  hills(ctx, css(lerpColor(theme.ground, theme.skyBottom, 0.35)), heading * 0.4, HEIGHT * 0.5 + 14, 26, 0.013);
}
```

`src/render/text.ts`:

```ts
const FONT = "'Apple SD Gothic Neo', 'Malgun Gothic', system-ui, sans-serif";

/** 어두운 외곽선이 있는 글자를 그립니다. y는 글자의 위쪽 끝입니다. */
export function drawText(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  size: number,
  align: CanvasTextAlign = 'left',
  color = '#ffffff',
): void {
  ctx.font = `bold ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2, size / 7);
  ctx.strokeStyle = 'rgba(0,0,0,0.65)';
  ctx.strokeText(value, x, y);
  ctx.fillStyle = color;
  ctx.fillText(value, x, y);
}
```

`src/render/sprites.ts`:

```ts
import { CAMERA_HEIGHT, CAR_WIDTH, HEIGHT, MAX_SPEED, WIDTH } from '../game/constants';
import { css, shade } from '../game/themes';
import type { Color, GateKind, Player, Prop } from '../game/types';

type Ctx = CanvasRenderingContext2D;

export const CAR_COLORS: Color[] = [
  [40, 110, 220],
  [240, 200, 40],
  [60, 170, 90],
  [230, 230, 235],
  [150, 80, 200],
];

const PLAYER_COLOR: Color = [225, 45, 45];

/** 가로 중심이 cx이고 아래쪽 끝이 bottom인 사각형을 그립니다. */
function box(ctx: Ctx, color: string, cx: number, bottom: number, w: number, h: number): void {
  ctx.fillStyle = color;
  ctx.fillRect(cx - w / 2, bottom - h, w, h);
}

function tri(ctx: Ctx, color: string, cx: number, bottom: number, w: number, h: number): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, bottom);
  ctx.lineTo(cx + w / 2, bottom);
  ctx.lineTo(cx, bottom - h);
  ctx.closePath();
  ctx.fill();
}

function disc(ctx: Ctx, color: string, cx: number, cy: number, r: number): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}

const PALM_LEAVES = [
  [-260, 960],
  [260, 960],
  [-140, 1090],
  [140, 1090],
  [0, 1150],
];

/**
 * 길가 사물을 그립니다. (x, y)는 사물이 지면에 닿는 위치이고,
 * s는 월드 단위 1이 차지하는 화면 픽셀 수입니다.
 */
export function drawProp(ctx: Ctx, prop: Prop, x: number, y: number, s: number, variant: number): void {
  const toRoad = prop.offset > 0 ? -1 : 1;
  switch (prop.kind) {
    case 'palm':
      box(ctx, '#8a5a2b', x, y, 90 * s, 1000 * s);
      for (const [dx, up] of PALM_LEAVES) disc(ctx, '#2f9e44', x + dx * s, y - up * s, 220 * s);
      break;
    case 'cactus':
      box(ctx, '#3a8f4a', x, y, 150 * s, 700 * s);
      box(ctx, '#3a8f4a', x - 190 * s, y - 300 * s, 90 * s, 280 * s);
      box(ctx, '#3a8f4a', x - 120 * s, y - 300 * s, 150 * s, 80 * s);
      box(ctx, '#3a8f4a', x + 190 * s, y - 400 * s, 90 * s, 240 * s);
      box(ctx, '#3a8f4a', x + 120 * s, y - 400 * s, 150 * s, 80 * s);
      break;
    case 'rock':
      ctx.fillStyle = '#8d8478';
      ctx.beginPath();
      ctx.moveTo(x - 260 * s, y);
      ctx.lineTo(x - 180 * s, y - 200 * s);
      ctx.lineTo(x + 20 * s, y - 280 * s);
      ctx.lineTo(x + 220 * s, y - 160 * s);
      ctx.lineTo(x + 280 * s, y);
      ctx.closePath();
      ctx.fill();
      break;
    case 'pine':
      box(ctx, '#5b3a1e', x, y, 90 * s, 260 * s);
      tri(ctx, '#1f5d34', x, y - 200 * s, 640 * s, 520 * s);
      tri(ctx, '#256b3c', x, y - 520 * s, 500 * s, 440 * s);
      tri(ctx, '#2c7a45', x, y - 820 * s, 340 * s, 360 * s);
      break;
    case 'lamp':
      box(ctx, '#9aa0aa', x, y, 40 * s, 1100 * s);
      box(ctx, '#9aa0aa', x + toRoad * 150 * s, y - 1060 * s, 300 * s, 40 * s);
      disc(ctx, 'rgba(255,230,140,0.25)', x + toRoad * 300 * s, y - 1040 * s, 160 * s);
      disc(ctx, '#ffe68c', x + toRoad * 300 * s, y - 1040 * s, 55 * s);
      break;
    case 'building': {
      const w = 1500 * s;
      const h = (2200 + (variant % 5) * 450) * s;
      box(ctx, '#191a2e', x, y, w, h);
      if (w > 14) {
        const rows = Math.floor(h / (300 * s));
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < 4; c++) {
            if ((variant * 7 + r * 3 + c * 5) % 4 === 0) continue;
            box(ctx, '#f2d16b', x - w / 2 + ((c + 0.5) * w) / 4, y - (r * 300 + 140) * s, w / 8, 130 * s);
          }
        }
      }
      break;
    }
    case 'sign':
      box(ctx, '#cfd3da', x, y, 40 * s, 520 * s);
      box(ctx, '#f4f4f4', x, y - 520 * s, 520 * s, 320 * s);
      box(ctx, '#e03131', x, y - 600 * s, 360 * s, 160 * s);
      break;
    case 'flag':
      box(ctx, '#e9ecef', x, y, 30 * s, 900 * s);
      ctx.fillStyle = '#f03e3e';
      ctx.beginPath();
      ctx.moveTo(x, y - 900 * s);
      ctx.lineTo(x + toRoad * 360 * s, y - 780 * s);
      ctx.lineTo(x, y - 660 * s);
      ctx.closePath();
      ctx.fill();
      break;
  }
}

/** 도로를 가로지르는 아치형 구조물을 그립니다. w는 도로 반폭의 화면 픽셀 수입니다. */
export function drawGate(ctx: Ctx, kind: GateKind, x: number, y: number, w: number, s: number): void {
  const half = w * 1.25;
  const pillarHeight = 1800 * s;
  const bannerHeight = 420 * s;
  box(ctx, '#dfe3e8', x - half, y, 160 * s, pillarHeight);
  box(ctx, '#dfe3e8', x + half, y, 160 * s, pillarHeight);

  const top = y - pillarHeight;
  if (kind === 'checkpoint') {
    ctx.fillStyle = '#f7b500';
    ctx.fillRect(x - half, top, half * 2, bannerHeight);
    if (bannerHeight > 12) {
      ctx.fillStyle = '#1a1a1a';
      ctx.font = `bold ${bannerHeight * 0.6}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('CHECKPOINT', x, top + bannerHeight / 2);
    }
    return;
  }

  const columns = 16;
  const cell = (half * 2) / columns;
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < columns; col++) {
      ctx.fillStyle = (row + col) % 2 === 0 ? '#111111' : '#f5f5f5';
      ctx.fillRect(x - half + col * cell, top + (row * bannerHeight) / 2, cell + 0.5, bannerHeight / 2 + 0.5);
    }
  }
}

/** 차량의 뒷모습을 그립니다. (x, y)는 차량 뒤쪽 가운데가 지면에 닿는 위치입니다. */
export function drawCar(ctx: Ctx, x: number, y: number, s: number, color: Color, flames: boolean): void {
  const w = CAR_WIDTH * s;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(x - w * 0.52, y - 14 * s, w * 1.04, 28 * s);
  box(ctx, '#111111', x - w * 0.38, y, w * 0.18, 70 * s);
  box(ctx, '#111111', x + w * 0.38, y, w * 0.18, 70 * s);
  box(ctx, css(color), x, y - 30 * s, w, 150 * s);
  box(ctx, css(shade(color, 0.8)), x, y - 180 * s, w * 0.72, 110 * s);
  box(ctx, '#1c2733', x, y - 190 * s, w * 0.6, 80 * s);
  box(ctx, '#ff3b30', x - w * 0.36, y - 110 * s, w * 0.16, 36 * s);
  box(ctx, '#ff3b30', x + w * 0.36, y - 110 * s, w * 0.16, 36 * s);
  box(ctx, '#eeeeee', x, y - 60 * s, w * 0.2, 34 * s);
  if (flames) {
    for (const side of [-1, 1]) {
      disc(ctx, '#ff922b', x + side * w * 0.2, y - 40 * s, 42 * s);
      disc(ctx, '#ffe066', x + side * w * 0.2, y - 40 * s, 22 * s);
    }
  }
}

export function drawPlayer(ctx: Ctx, player: Player, steer: number, elapsed: number): void {
  const s = WIDTH / 2 / CAMERA_HEIGHT;
  const bounce = Math.sin(elapsed * 40) * (player.speed / MAX_SPEED) * 1.5;
  drawCar(ctx, WIDTH / 2 + steer * 14, HEIGHT - 6 + bounce, s, PLAYER_COLOR, player.nitroActive);
}
```

- [ ] **Step 6: HUD, 화면, 전체 그리기를 구현합니다**

`src/render/hud.ts`:

```ts
import { formatKm, speedKmh } from '../format';
import {
  CHECKPOINT_BONUS,
  HEIGHT,
  NITRO_MAX,
  NITRO_MIN,
  START_Z,
  THEME_BLEND_SECONDS,
  WARNING_SECONDS,
  WIDTH,
} from '../game/constants';
import { distanceOf } from '../game/race';
import { THEMES } from '../game/themes';
import type { GameState, Track } from '../game/types';
import { drawText } from './text';

export function drawHud(ctx: CanvasRenderingContext2D, state: GameState, track: Track, muted: boolean): void {
  const { player } = state;

  drawText(ctx, String(speedKmh(player.speed)), 28, 16, 46);
  drawText(ctx, 'km/h', 30, 66, 16);

  const low = state.time <= WARNING_SECONDS;
  drawText(ctx, String(Math.ceil(state.time)), WIDTH / 2, 10, 58, 'center', low ? '#ff5252' : '#ffe066');
  const section = Math.min(state.checkpointsPassed, THEMES.length - 1);
  drawText(ctx, `구간 ${section + 1}/${THEMES.length} · ${THEMES[section].name}`, WIDTH / 2, 76, 16, 'center');

  // 진행도
  const barX = WIDTH - 248;
  const barW = 220;
  const total = track.finishZ - START_Z;
  const progress = Math.min(1, distanceOf(player) / total);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(barX, 24, barW, 10);
  ctx.fillStyle = '#ffe066';
  ctx.fillRect(barX, 24, barW * progress, 10);
  ctx.fillStyle = '#ffffff';
  for (const z of track.checkpoints) ctx.fillRect(barX + (barW * (z - START_Z)) / total - 1, 20, 2, 18);
  drawText(ctx, formatKm(distanceOf(player)), WIDTH - 28, 42, 16, 'right');

  // 니트로 게이지
  const nitroX = 28;
  const nitroY = HEIGHT - 38;
  const nitroW = 200;
  drawText(ctx, 'NITRO', nitroX, nitroY - 24, 16);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(nitroX, nitroY, nitroW, 14);
  ctx.fillStyle = player.nitroActive ? '#ff922b' : player.nitro >= NITRO_MIN ? '#4dabf7' : '#6c7a89';
  ctx.fillRect(nitroX, nitroY, (nitroW * player.nitro) / NITRO_MAX, 14);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(nitroX + (nitroW * NITRO_MIN) / NITRO_MAX - 1, nitroY - 3, 2, 20);

  const sinceCheckpoint = state.elapsed - state.lastCheckpointAt;
  if (state.checkpointsPassed > 0 && sinceCheckpoint < THEME_BLEND_SECONDS) {
    drawText(ctx, `CHECKPOINT  +${CHECKPOINT_BONUS}초`, WIDTH / 2, 130, 34, 'center', '#ffe066');
  } else if (state.phase === 'racing' && state.time <= 0) {
    drawText(ctx, '시간 종료', WIDTH / 2, 130, 34, 'center', '#ff5252');
  }

  if (muted) drawText(ctx, '음소거 (M)', WIDTH - 28, HEIGHT - 34, 14, 'right');
}
```

`src/render/screens.ts`:

```ts
import { formatKm, formatTime } from '../format';
import { HEIGHT, WIDTH } from '../game/constants';
import { distanceOf } from '../game/race';
import type { GameState, Records } from '../game/types';
import { drawText } from './text';

function dim(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
}

function bestLine(records: Records): string {
  if (records.bestTime !== null) return `최고 기록  ${formatTime(records.bestTime)}`;
  if (records.bestDistance > 0) return `최장 거리  ${formatKm(records.bestDistance)}`;
  return '';
}

export function drawTitle(ctx: CanvasRenderingContext2D, records: Records): void {
  dim(ctx);
  const cx = WIDTH / 2;
  drawText(ctx, 'RETRO RACER', cx, 110, 84, 'center', '#ffe066');
  drawText(ctx, 'ENTER 키를 눌러 시작', cx, 240, 30, 'center');
  drawText(ctx, '← → 조향    ↑ 가속    ↓ 브레이크    SPACE 니트로    M 소리', cx, 320, 18, 'center');
  drawText(ctx, '제한 시간 안에 체크포인트를 통과해 결승점까지 달리세요', cx, 354, 18, 'center');
  drawText(ctx, '다른 차를 아슬아슬하게 추월하면 니트로 게이지가 빠르게 찹니다', cx, 384, 18, 'center');
  const best = bestLine(records);
  if (best) drawText(ctx, best, cx, 450, 24, 'center', '#4dabf7');
}

export function drawResult(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  records: Records,
  newRecord: boolean,
): void {
  dim(ctx);
  const cx = WIDTH / 2;
  if (state.phase === 'finished') {
    drawText(ctx, '완주!', cx, 110, 80, 'center', '#ffe066');
    drawText(ctx, `기록  ${formatTime(state.elapsed)}`, cx, 230, 36, 'center');
    drawText(ctx, `남은 시간  ${state.time.toFixed(1)}초`, cx, 282, 20, 'center');
  } else {
    drawText(ctx, '시간 종료', cx, 110, 80, 'center', '#ff5252');
    drawText(ctx, `도달 거리  ${formatKm(distanceOf(state.player))}`, cx, 230, 36, 'center');
    drawText(ctx, `통과한 체크포인트  ${state.checkpointsPassed}개`, cx, 282, 20, 'center');
  }
  if (newRecord) drawText(ctx, '신기록!', cx, 330, 30, 'center', '#ff922b');
  const best = bestLine(records);
  if (best) drawText(ctx, best, cx, 390, 22, 'center', '#4dabf7');
  drawText(ctx, 'ENTER 키를 눌러 다시 시작', cx, 460, 26, 'center');
}
```

`src/render/render.ts`:

```ts
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
```

- [ ] **Step 7: 테스트와 타입 검사가 통과하는지 확인합니다**

Run: `npm test && npx tsc --noEmit`
Expected: 모든 테스트가 PASS하고, 타입 오류가 없습니다.

- [ ] **Step 8: 커밋합니다**

```bash
git add -A
git commit -m "feat: add pseudo-3D renderer with road, scenery, HUD, and screens"
```

---

### Task 8: 입력, 소리, 게임 루프, README

**Files:**
- Create: `src/input.ts`, `src/audio.ts`, `README.md`
- Modify: `src/main.ts` (전체 교체)

**Interfaces:**
- Consumes: `createGame`, `requestStart`, `step`, `accumulate`, `applyResult`, `buildTrack`, `render`, `browserStorage`, `loadRecords`, `saveRecords`
- Produces:
  - `createInput(target: Window, handlers: { onStart(): void; onMute(): void }): () => Input`
  - `createAudio(): GameAudio` (`GameAudio = { start(): void; update(state: GameState): void; toggleMute(): boolean }`)

- [ ] **Step 1: 키 입력을 구현합니다**

`src/input.ts`:

```ts
import type { Input } from './game/types';

const KEYS: Record<string, keyof Input> = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowUp: 'accel',
  KeyW: 'accel',
  ArrowDown: 'brake',
  KeyS: 'brake',
  Space: 'nitro',
};

export interface InputHandlers {
  onStart(): void;
  onMute(): void;
}

/** 키 입력을 추적하고, 현재 입력 상태를 반환하는 함수를 돌려줍니다. */
export function createInput(target: Window, handlers: InputHandlers): () => Input {
  const state: Input = { left: false, right: false, accel: false, brake: false, nitro: false };

  target.addEventListener('keydown', (event) => {
    const mapped = KEYS[event.code];
    if (mapped) {
      state[mapped] = true;
      event.preventDefault();
      return;
    }
    if (event.repeat) return;
    if (event.code === 'Enter' || event.code === 'NumpadEnter') handlers.onStart();
    else if (event.code === 'KeyM') handlers.onMute();
  });

  target.addEventListener('keyup', (event) => {
    const mapped = KEYS[event.code];
    if (mapped) state[mapped] = false;
  });

  // 창이 포커스를 잃으면 keyup을 받지 못하므로 모든 키를 뗀 상태로 되돌립니다.
  target.addEventListener('blur', () => {
    state.left = state.right = state.accel = state.brake = state.nitro = false;
  });

  return () => ({ ...state });
}
```

- [ ] **Step 2: 소리를 구현합니다**

`src/audio.ts`:

```ts
import { MAX_SPEED } from './game/constants';
import type { GameEvent, GameState } from './game/types';

export interface GameAudio {
  /** 사용자 입력 이후에 호출해야 합니다. 브라우저가 자동 재생을 제한하기 때문입니다. */
  start(): void;
  update(state: GameState): void;
  /** 음소거 여부를 바꾸고, 바뀐 뒤의 음소거 여부를 반환합니다. */
  toggleMute(): boolean;
}

interface Engine {
  ctx: AudioContext;
  master: GainNode;
  gain: GainNode;
  oscA: OscillatorNode;
  oscB: OscillatorNode;
}

export function createAudio(): GameAudio {
  let engine: Engine | null = null;
  let muted = false;

  function start(): void {
    if (engine) {
      void engine.ctx.resume();
      return;
    }
    try {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      const ctx = new Ctor();
      const master = ctx.createGain();
      master.gain.value = muted ? 0 : 1;
      master.connect(ctx.destination);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 900;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      const oscA = ctx.createOscillator();
      const oscB = ctx.createOscillator();
      oscA.type = 'sawtooth';
      oscB.type = 'sawtooth';
      oscA.connect(filter);
      oscB.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      oscA.start();
      oscB.start();

      engine = { ctx, master, gain, oscA, oscB };
    } catch {
      engine = null;
    }
  }

  function tone(
    e: Engine,
    frequency: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    delay = 0,
    slideTo?: number,
  ): void {
    const at = e.ctx.currentTime + delay;
    const osc = e.ctx.createOscillator();
    const gain = e.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, at);
    if (slideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(slideTo, at + duration);
    gain.gain.setValueAtTime(volume, at);
    gain.gain.exponentialRampToValueAtTime(0.001, at + duration);
    osc.connect(gain);
    gain.connect(e.master);
    osc.start(at);
    osc.stop(at + duration + 0.02);
  }

  function noise(e: Engine, duration: number, volume: number): void {
    const length = Math.floor(e.ctx.sampleRate * duration);
    const buffer = e.ctx.createBuffer(1, length, e.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    const source = e.ctx.createBufferSource();
    source.buffer = buffer;
    const gain = e.ctx.createGain();
    gain.gain.setValueAtTime(volume, e.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, e.ctx.currentTime + duration);
    source.connect(gain);
    gain.connect(e.master);
    source.start();
  }

  function play(e: Engine, event: GameEvent): void {
    switch (event) {
      case 'crash':
        noise(e, 0.35, 0.35);
        tone(e, 110, 0.3, 'square', 0.15, 0, 40);
        break;
      case 'checkpoint':
        tone(e, 660, 0.12, 'square', 0.12);
        tone(e, 880, 0.12, 'square', 0.12, 0.12);
        tone(e, 1320, 0.25, 'square', 0.12, 0.24);
        break;
      case 'nearMiss':
        tone(e, 1200, 0.08, 'triangle', 0.14, 0, 1800);
        break;
      case 'nitroStart':
        tone(e, 200, 0.5, 'sawtooth', 0.14, 0, 1200);
        noise(e, 0.4, 0.1);
        break;
      case 'timeWarning':
        tone(e, 990, 0.1, 'square', 0.1);
        break;
      case 'finish':
        [523, 659, 784, 1047].forEach((f, i) => tone(e, f, 0.22, 'square', 0.13, i * 0.15));
        break;
      case 'timeUp':
        tone(e, 440, 0.8, 'sawtooth', 0.14, 0, 110);
        break;
      case 'pass':
        break;
    }
  }

  function update(state: GameState): void {
    if (!engine) return;
    const now = engine.ctx.currentTime;
    const ratio = state.player.speed / MAX_SPEED;
    const frequency = 55 + ratio * 150 + (state.player.nitroActive ? 25 : 0);
    engine.oscA.frequency.setTargetAtTime(frequency, now, 0.05);
    engine.oscB.frequency.setTargetAtTime(frequency * 1.51, now, 0.05);
    engine.gain.gain.setTargetAtTime(state.phase === 'racing' ? 0.05 + 0.06 * ratio : 0, now, 0.08);
    for (const event of state.events) play(engine, event);
  }

  function toggleMute(): boolean {
    muted = !muted;
    if (engine) engine.master.gain.value = muted ? 0 : 1;
    return muted;
  }

  return { start, update, toggleMute };
}
```

- [ ] **Step 3: 게임 루프를 구현합니다**

`src/main.ts` (전체 교체):

```ts
import './style.css';
import { createAudio } from './audio';
import { HEIGHT, STEP, WIDTH } from './game/constants';
import { accumulate } from './game/loop';
import { applyResult } from './game/race';
import { createGame, requestStart, step } from './game/step';
import { buildTrack } from './game/track';
import { createInput } from './input';
import { render } from './render/render';
import { browserStorage, loadRecords, saveRecords } from './storage';

const canvas = document.querySelector<HTMLCanvasElement>('#game');
const ctx = canvas?.getContext('2d');
if (!canvas || !ctx) throw new Error('캔버스를 초기화할 수 없습니다.');

canvas.width = WIDTH;
canvas.height = HEIGHT;

const track = buildTrack();
const store = browserStorage();
const audio = createAudio();

let records = loadRecords(store);
let state = createGame(track);
let newRecord = false;
let muted = false;

const readInput = createInput(window, {
  onStart() {
    audio.start();
    const next = requestStart(state, track);
    if (next !== state) newRecord = false;
    state = next;
  },
  onMute() {
    muted = audio.toggleMute();
  },
});

let last = performance.now();
let acc = 0;

function frame(now: number): void {
  acc = accumulate(acc, (now - last) / 1000);
  last = now;
  const input = readInput();

  while (acc >= STEP) {
    const before = state.phase;
    state = step(state, input, track, STEP);
    audio.update(state);
    if (before === 'racing' && state.phase !== 'racing') {
      const result = applyResult(records, state);
      records = result.records;
      newRecord = result.isNew;
      saveRecords(store, records);
    }
    acc -= STEP;
  }

  const steer = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  render(ctx!, state, track, { records, newRecord, steer, muted });
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
```

- [ ] **Step 4: README를 작성합니다**

`README.md`:

```markdown
# Retro Racer

브라우저에서 실행하는 유사 3D 아케이드 레이싱 게임입니다. 제한 시간 안에 체크포인트를 통과하면서 결승점까지 달립니다.

## 실행 방법

    npm install
    npm run dev

터미널에 출력되는 주소를 브라우저에서 엽니다.

## 조작

| 키 | 동작 |
|---|---|
| ← / → (A / D) | 좌우 조향 |
| ↑ (W) | 가속 |
| ↓ (S) | 브레이크 |
| Space | 니트로 사용 |
| Enter | 시작, 다시 시작 |
| M | 소리 켜기·끄기 |

## 규칙

- 60초로 시작하며, 체크포인트를 통과할 때마다 30초가 추가됩니다.
- 시간이 0이 되면 가속할 수 없고, 차량이 멈추면 경주가 끝납니다.
- 도로 밖으로 나가면 속도가 줄어들고, 길가 사물이나 다른 차량에 부딪히면 속도를 크게 잃습니다.
- 다른 차량을 가깝게 스치면서 추월하면 니트로 게이지가 빠르게 찹니다. 게이지가 30 이상일 때 니트로를 사용할 수 있습니다.
- 완주 시간과 도달 거리의 최고 기록은 브라우저에 저장됩니다.

## 개발

    npm test        # 단위 테스트
    npm run build   # 타입 검사와 빌드

게임 규칙은 `src/game/`에, 화면 그리기는 `src/render/`에 있습니다. 속도·시간과 같은 조정값은 `src/game/constants.ts`에 모여 있습니다.
```

- [ ] **Step 5: 테스트와 빌드가 통과하는지 확인합니다**

Run: `npm test && npm run build`
Expected: 모든 테스트가 PASS하고, 빌드가 오류 없이 `dist/`를 생성합니다.

- [ ] **Step 6: 브라우저에서 직접 확인합니다**

Run: `npm run dev`

브라우저에서 출력된 주소를 열고 다음 항목을 확인합니다. 콘솔에 오류가 없어야 합니다.

1. 타이틀 화면에 도로, 플레이어 차량, 조작 안내가 보입니다.
2. Enter를 누르면 주행이 시작되고, ↑ 키로 가속하면 도로와 길가 사물이 다가옵니다.
3. 커브에서 차량이 바깥쪽으로 밀리고, 언덕에서 도로가 위아래로 움직입니다.
4. 도로 밖으로 나가면 속도가 줄어들고, 일반 차량의 뒤를 들이받으면 속도가 크게 줄어듭니다.
5. 일반 차량을 가깝게 스치면 니트로 게이지가 차고, Space를 누르면 속도가 240km/h를 넘습니다.
6. 첫 체크포인트를 통과하면 남은 시간이 30초 늘어나고, 배경이 해변에서 사막으로 전환됩니다.
7. 가속하지 않고 시간이 0이 되도록 기다리면 "시간 종료" 화면이 표시되고, Enter로 다시 시작할 수 있습니다.
8. 페이지를 새로 고쳐도 타이틀 화면에 최고 기록이 표시됩니다.
9. 엔진음이 속도에 따라 달라지고, M 키로 소리가 꺼집니다.

확인 중에 문제를 발견하면 원인을 수정하고 Step 5부터 다시 진행합니다.

- [ ] **Step 7: 커밋합니다**

```bash
git add -A
git commit -m "feat: wire input, audio, and game loop; add README"
```
