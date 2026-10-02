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
