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
