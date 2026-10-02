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
