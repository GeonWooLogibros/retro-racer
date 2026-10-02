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
