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
