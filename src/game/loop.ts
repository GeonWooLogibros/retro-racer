import { MAX_FRAME_TIME } from './constants';

/** 프레임 사이에 지난 시간을 누적하되, 한 번에 처리할 양을 제한합니다. */
export function accumulate(acc: number, frameSeconds: number): number {
  if (!Number.isFinite(frameSeconds) || frameSeconds <= 0) return acc;
  return Math.min(MAX_FRAME_TIME, acc + frameSeconds);
}
