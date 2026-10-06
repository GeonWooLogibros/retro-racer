import {
  COMBO_GAUGE,
  COMBO_GAUGE_MAX,
  COMBO_WINDOW,
  CRASH_KEEP,
  FALL_KEEP,
  PROP_CRASH_SPEED,
  START_TIME,
  NITRO_DURATION,
  THEME_BLEND_SECONDS,
} from './constants';
import { chargeGauge, crash, createPlayer, hitProp, updatePlayer } from './player';
import { updateRace } from './race';
import { createRivals, finishRankOf, rankOf, updateRivals } from './rivals';
import { FALL_MARGIN, surfaceOf } from './terrain';
import { segmentAt } from './track';
import type { GameEvent, GameState, Input, Track } from './types';

/** 연속 보너스를 쌓는 사건. */
const COMBO_EVENTS: GameEvent[] = ['turbo', 'counterBoost', 'overtake'];

export function createGame(track: Track): GameState {
  const player = createPlayer();
  const rivals = createRivals(track);
  return {
    phase: 'title',
    player,
    rivals,
    rank: rankOf(rivals),
    time: START_TIME,
    elapsed: 0,
    checkpointsPassed: 0,
    lastCheckpointAt: -THEME_BLEND_SECONDS,
    combo: 0,
    comboTime: 0,
    events: [],
  };
}

export function startRace(track: Track): GameState {
  return { ...createGame(track), phase: 'racing' };
}

export function step(state: GameState, input: Input, track: Track, dt: number): GameState {
  if (state.phase !== 'racing') {
    return state.events.length > 0 ? { ...state, events: [] } : state;
  }

  const events: GameEvent[] = [];
  const from = segmentAt(track, state.player.z);
  const surface = surfaceOf(from);
  let player = updatePlayer(state.player, input, from.curve, dt, state.time > 0, surface);
  // 부스터를 쓴 단계에는 남은 시간이 꽉 찬 값으로 돌아갑니다. 앞 부스터가 끝나는 단계에 바로 이어 써도 알아챕니다.
  const fired = player.nitroTime === NITRO_DURATION;
  if (fired) events.push('nitroStart');
  if (state.player.drifting && !player.drifting && player.turbo > state.player.turbo) events.push('turbo');
  if (state.player.counterWindow > 0 && player.counterWindow === 0 && player.turbo > state.player.turbo) {
    events.push('counterBoost');
  }

  if (surface.falls && Math.abs(player.x) > surface.width + FALL_MARGIN) {
    // 다리나 우주의 길에서 벗어나면 떨어졌다가 길 가운데로 돌아옵니다.
    player = { ...crash(player, Math.max(PROP_CRASH_SPEED, player.speed * FALL_KEEP)), x: 0 };
    events.push('fall');
  } else if (Math.abs(player.x) > 1 && player.speed > PROP_CRASH_SPEED * 2) {
    const to = segmentAt(track, player.z).index;
    for (let i = from.index; i <= to; i++) {
      if (hitProp(player, track.segments[i].props)) {
        player = crash(player, Math.max(PROP_CRASH_SPEED, player.speed * CRASH_KEEP));
        events.push('crash');
        break;
      }
    }
  }

  const race = updateRivals(state.rivals, player, track, dt);
  events.push(...race.events);
  player = race.player;
  const rank = rankOf(race.rivals);
  if (rank < state.rank) events.push('overtake');
  else if (rank > state.rank) events.push('overtaken');

  // 잘한 행동이 이어지면 연속 보너스가 쌓이고, 쌓일수록 게이지를 더 채워 줍니다. 부딪히면 끊깁니다.
  let combo = state.combo;
  let comboTime = Math.max(0, state.comboTime - dt);
  if (events.includes('crash') || events.includes('fall')) {
    combo = 0;
    comboTime = 0;
  } else {
    for (const event of events) {
      if (!COMBO_EVENTS.includes(event)) continue;
      combo++;
      comboTime = COMBO_WINDOW;
      player = chargeGauge(player, Math.min(COMBO_GAUGE_MAX, combo * COMBO_GAUGE));
    }
  }
  if (comboTime === 0) combo = 0;

  const used = fired ? 1 : 0;
  if (player.boosters > state.player.boosters - used) events.push('boosterReady');

  const next = updateRace({ ...state, player, rivals: race.rivals, rank, events, combo, comboTime }, track, dt);
  // 결승점에서는 여유 거리 없이 실제 위치로 순위를 정합니다.
  return next.phase === 'finished' ? { ...next, rank: finishRankOf(next.player, next.rivals) } : next;
}
