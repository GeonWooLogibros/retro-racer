import './style.css';
import { createAudio } from './audio';
import { HEIGHT, MAX_FRAME_TIME, MAX_SPEED, STEP, WIDTH } from './game/constants';
import { accumulate } from './game/loop';
import { applyResult } from './game/race';
import { createGame, startRace, step } from './game/step';
import type { GameState } from './game/types';
import { MAPS } from './game/maps';
import { buildTrack } from './game/track';
import type { Track } from './game/types';
import { createInput } from './input';
import { createMultiplayer } from './multiplayer';
import { render } from './render/render';
import { mergePopups, popupsFor, type Popup } from './render/effects';
import { advanceRun } from './render/runner';
import { browserStorage, loadRecords, recordsOf, saveRecords } from './storage';

const canvas = document.querySelector<HTMLCanvasElement>('#game');
const ctx = canvas?.getContext('2d');
if (!canvas || !ctx) throw new Error('캔버스를 초기화할 수 없습니다.');

canvas.width = WIDTH;
canvas.height = HEIGHT;

let mapIndex = 0;

/** 고른 맵으로 새 코스를 만듭니다. 조각의 순서와 좌우, 사물과 차량 배치가 매번 달라집니다. */
function freshTrack(): Track {
  return buildTrack(MAPS[mapIndex], 1 + Math.floor(Math.random() * 0x7fffffff));
}

let track = freshTrack();
const store = browserStorage();
const audio = createAudio();

let book = loadRecords(store);
let state = createGame(track);
let newRecord = false;
let muted = false;

/** 출발 카운트다운이 끝나는 시각. 카운트다운 중이 아니면 null입니다. */
let countdownEnd: number | null = null;
/** 함께 달릴 때의 출발 대기 시간(초). */
const COUNTDOWN = 3;

/** 함께 달릴 때는 AI 라이벌 없이, 같은 방 사람들끼리만 순위를 겨룹니다. */
function withoutRivals(game: GameState): GameState {
  return { ...game, rivals: [], rank: 1 };
}

const multi = createMultiplayer({
  onGesture: () => audio.start(),
  onRaceStart(map, seed) {
    mapIndex = Math.min(MAPS.length - 1, map);
    track = buildTrack(MAPS[mapIndex], seed);
    state = withoutRivals(createGame(track));
    newRecord = false;
    countdownEnd = clock + COUNTDOWN;
  },
  onWait(map) {
    countdownEnd = null;
    mapIndex = Math.min(MAPS.length - 1, map);
    track = freshTrack();
    state = createGame(track);
  },
  onLeave() {
    countdownEnd = null;
    track = freshTrack();
    state = createGame(track);
  },
});

const readInput = createInput(window, {
  onStart() {
    audio.start();
    if (multi.inRoom() || multi.blocksInput()) return;
    if (state.phase === 'racing') return;
    // 타이틀 화면에서는 미리 보여준 코스로, 결과 화면에서는 새로 만든 코스로 시작합니다.
    if (state.phase !== 'title') track = freshTrack();
    state = startRace(track);
    newRecord = false;
  },
  onMute() {
    muted = audio.toggleMute();
  },
  onSelect(direction) {
    if (multi.inRoom() || multi.blocksInput() || state.phase !== 'title') return;
    mapIndex = (mapIndex + direction + MAPS.length) % MAPS.length;
    track = freshTrack();
    state = createGame(track);
  },
  onBack() {
    // 함께 달리는 중에 Esc를 누르면 방을 나갑니다.
    if (multi.inRoom()) {
      if (state.phase === 'racing' || countdownEnd !== null) multi.leave();
      return;
    }
    if (state.phase !== 'finished' && state.phase !== 'timeUp') return;
    track = freshTrack();
    state = createGame(track);
  },
});

const STEER_VIEW_RATE = 9;
const DRIFT_VIEW_TURN = 1.8;
const BOOST_IN_RATE = 5;
const BOOST_OUT_RATE = 4;
const SPEED_VIEW_RATE = 4;
/** 터보가 붙어 있을 때의 카메라 연출 정도. 부스터보다 약하게 둡니다. */
const TURBO_VIEW = 0.55;

let last = performance.now();
let acc = 0;
let steer = 0;
/** 니트로 연출의 정도. 켤 때는 빠르게, 끌 때는 천천히 따라가서 카메라가 늦게 따라오는 느낌을 냅니다. */
let boost = 0;
let speedView = 0;
let clock = 0;
let runPhase = 0;
/** 마지막으로 부딪히거나 떨어진 시각. 캐릭터의 막힌 자세에 씁니다. */
let lastHitAt = -Infinity;
let flashAt = -Infinity;
let turboAt = -Infinity;
let popups: Popup[] = [];
/** 부딪힌 순간 화면을 잠깐 멈추는 시간(초). */
const HIT_STOP = 0.07;

function frame(now: number): void {
  const elapsed = Math.min(MAX_FRAME_TIME, Math.max(0, (now - last) / 1000));
  acc = accumulate(acc, (now - last) / 1000);
  last = now;
  const input = readInput();

  if (countdownEnd !== null && clock >= countdownEnd) {
    countdownEnd = null;
    state = withoutRivals(startRace(track));
  }

  // 부딪힌 직후에는 아주 잠깐 시간을 멈춰서 충격이 느껴지게 합니다.
  if (clock - lastHitAt < HIT_STOP) acc = 0;

  while (acc >= STEP) {
    const before = state.phase;
    state = step(state, input, track, STEP);
    if (state.events.includes('crash') || state.events.includes('fall')) lastHitAt = clock;
    if (state.events.includes('nitroStart')) flashAt = clock;
    if (state.events.includes('turbo') || state.events.includes('counterBoost')) turboAt = clock;
    popups = mergePopups(popups, popupsFor(state.events, state.combo, clock, state.rank), clock);
    audio.update(state);
    if (before === 'racing' && state.phase !== 'racing') {
      const result = applyResult(recordsOf(book, track.map.id), state);
      book = { ...book, [track.map.id]: result.records };
      newRecord = result.isNew;
      saveRecords(store, book);
    }
    acc -= STEP;
  }

  // 차체가 입력을 따라 서서히 돌아가도록 합니다. 멈춰 있을 때는 돌지 않습니다.
  const moving = state.phase === 'racing' && state.player.speed > 0;
  const direction = moving ? (input.right ? 1 : 0) - (input.left ? 1 : 0) : 0;
  const target = direction * (state.player.drifting ? DRIFT_VIEW_TURN : 1);
  steer += (target - steer) * Math.min(1, elapsed * STEER_VIEW_RATE);

  const racing = state.phase === 'racing';
  const boostTarget = racing && state.player.nitroActive ? 1 : racing && state.player.turbo > 0 ? TURBO_VIEW : 0;
  const boostRate = boostTarget > boost ? BOOST_IN_RATE : BOOST_OUT_RATE;
  boost += (boostTarget - boost) * Math.min(1, elapsed * boostRate);
  popups = mergePopups(popups, [], clock);
  speedView += (state.player.speed / MAX_SPEED - speedView) * Math.min(1, elapsed * SPEED_VIEW_RATE);
  clock += elapsed;
  runPhase = advanceRun(runPhase, state.phase === 'racing' ? state.player.speed / MAX_SPEED : 0, elapsed);
  const records = recordsOf(book, track.map.id);
  const inRace = multi.inRoom() && state.phase !== 'title';
  const local = inRace
    ? {
        z: state.player.z,
        x: state.player.x,
        speed: state.player.speed,
        boost: state.player.nitroActive || state.player.turbo > 0,
        done: state.phase === 'finished' ? state.elapsed : null,
        out: state.phase === 'timeUp',
      }
    : null;
  multi.update(local, state.phase === 'title' && countdownEnd === null);
  render(ctx!, state, track, {
    boost,
    speed: speedView,
    clock,
    runPhase,
    hitAgo: clock - lastHitAt,
    popups,
    flashAgo: clock - flashAt,
    turboAgo: clock - turboAt,
    records,
    newRecord,
    steer,
    muted,
    mapIndex,
    mapCount: MAPS.length,
    others: inRace ? multi.remotes(Date.now()) : [],
    standing: local ? multi.standing(local) : null,
    countdown: countdownEnd === null ? null : Math.max(0, countdownEnd - clock),
  });
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
