/** 여럿이 함께 달리기 위한 규칙. 방 코드, 방장 정하기, 다른 사람의 상태 읽기, 순위 계산을 맡습니다. */

const CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
export const ROOM_CODE_LENGTH = 5;
const CODE_PATTERN = new RegExp(`^[${CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`);
export const NAME_LIMIT = 12;
/** 다른 사람의 위치를 받은 뒤 이 시간까지만 앞으로 밀어서 그립니다(밀리초). */
const EXTRAPOLATE_LIMIT = 500;

/** 헷갈리는 글자(0, o, 1, l, i)를 뺀 다섯 글자 방 코드를 만듭니다. */
export function makeRoomCode(rand: () => number): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) code += CODE_ALPHABET[Math.floor(rand() * CODE_ALPHABET.length)];
  return code;
}

/** 입력한 글자나 초대 링크에서 방 코드를 꺼냅니다. 올바른 코드가 없으면 null입니다. */
export function parseRoomCode(text: string): string | null {
  const tail = text.trim().toLowerCase().split('#').pop() ?? '';
  return CODE_PATTERN.test(tail) ? tail : null;
}

export function roomName(code: string): string {
  return `rr-${code}`;
}

/** 다른 사람이 보낸 이름을 화면에 쓸 수 있게 다듬습니다. 제어 문자를 지우고 길이를 줄입니다. */
export function cleanName(value: unknown, fallback = '레이서'): string {
  if (typeof value !== 'string') return fallback;
  // eslint-disable-next-line no-control-regex
  const text = value.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u206f]/g, '').trim();
  return text ? Array.from(text).slice(0, NAME_LIMIT).join('') : fallback;
}

/** 방 안에서 한 사람이 알리는 상태. */
export interface Racer {
  peer: string;
  name: string;
  /** 방을 만든 사람인지 여부. 방을 만든 사람이 있으면 그 사람이 방장입니다. */
  owner: boolean;
  /** 방에 들어온 시각(그 사람의 시계). 방을 만든 사람이 나가면 가장 먼저 들어온 사람이 방장입니다. */
  since: number;
  /** 방장이 고른 맵과 코스 시드. 방장의 값만 씁니다. */
  map: number;
  seed: number;
  /** 'wait'는 대기실, 'race'는 경주 중입니다. */
  phase: 'wait' | 'race';
  /** 대기실에서 준비를 마쳤는지 여부. 방장은 준비할 필요가 없습니다. */
  ready: boolean;
  /** 지금 달리고 있는 경주의 이름. 경주를 시작할 때마다 방장이 새로 정합니다. */
  race: string | null;
  z: number;
  x: number;
  speed: number;
  boost: boolean;
  /** 완주한 기록(초). 완주하지 않았으면 null입니다. */
  done: number | null;
  /** 시간이 끝나 경주를 마쳤는지 여부. */
  out: boolean;
}

const num = (value: unknown, fallback = 0): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

/** 다른 사람이 보낸 상태를 믿지 않고, 값마다 형식과 범위를 확인해서 읽습니다. */
export function readRacer(peer: string, presence: Readonly<Record<string, unknown>>): Racer {
  const done = presence.done;
  return {
    peer,
    name: cleanName(presence.name),
    owner: presence.owner === true,
    since: num(presence.since, Number.MAX_SAFE_INTEGER),
    map: Math.max(0, Math.floor(num(presence.map))),
    seed: Math.max(0, Math.floor(num(presence.seed))),
    phase: presence.phase === 'race' ? 'race' : 'wait',
    ready: presence.ready === true,
    race: typeof presence.race === 'string' ? presence.race.slice(0, 32) : null,
    z: num(presence.z),
    x: Math.max(-2, Math.min(2, num(presence.x))),
    speed: Math.max(0, num(presence.speed)),
    boost: presence.boost === true,
    done: typeof done === 'number' && Number.isFinite(done) && done > 0 ? done : null,
    out: presence.out === true,
  };
}

/**
 * 방장을 정합니다. 방을 만든 사람이 있으면 그 사람이고, 없으면 가장 먼저 들어온 사람입니다.
 * 기기마다 시계가 조금씩 달라서, 들어온 시각은 방을 만든 사람이 나갔을 때만 씁니다.
 * 시각이 같으면 이름표 순서로 정해서, 모두가 같은 사람을 고릅니다.
 */
export function pickHost(racers: readonly Pick<Racer, 'peer' | 'since' | 'owner'>[]): string | null {
  const before = (a: Pick<Racer, 'peer' | 'since' | 'owner'>, b: Pick<Racer, 'peer' | 'since' | 'owner'>): boolean => {
    if (a.owner !== b.owner) return a.owner;
    if (a.since !== b.since) return a.since < b.since;
    return a.peer < b.peer;
  };
  let host: Pick<Racer, 'peer' | 'since' | 'owner'> | null = null;
  for (const racer of racers) if (!host || before(racer, host)) host = racer;
  return host?.peer ?? null;
}

/** 순위. 완주한 사람은 기록 순서로 앞에, 달리는 사람은 많이 간 순서로, 시간이 끝난 사람은 맨 뒤에 둡니다. */
export function standings<T extends Pick<Racer, 'z' | 'done' | 'out'>>(racers: readonly T[]): T[] {
  const group = (r: T): number => (r.done !== null ? 0 : r.out ? 2 : 1);
  return [...racers].sort((a, b) => {
    const ga = group(a);
    const gb = group(b);
    if (ga !== gb) return ga - gb;
    if (ga === 0) return (a.done ?? 0) - (b.done ?? 0);
    return b.z - a.z;
  });
}

/** 마지막으로 받은 위치에서 속도만큼 앞으로 밀어서, 받는 사이사이에도 부드럽게 움직이게 합니다. */
export function extrapolate(z: number, speed: number, ageMs: number): number {
  return z + (speed * Math.min(EXTRAPOLATE_LIMIT, Math.max(0, ageMs))) / 1000;
}

/** 방에 들어올 수 있는 최대 인원. 대기실에 이만큼 자리를 보여 줍니다. */
export const MAX_PLAYERS = 8;

/** 대기실의 준비 상황. 방장을 뺀 사람 가운데 몇 명이 준비했는지와, 방장이 시작할 수 있는지를 알려 줍니다. */
export function readiness(
  racers: readonly Pick<Racer, 'peer' | 'ready'>[],
  host: string | null,
): {
  ready: number;
  needed: number;
  canStart: boolean;
} {
  const guests = racers.filter((racer) => racer.peer !== host);
  const ready = guests.filter((racer) => racer.ready).length;
  return { ready, needed: guests.length, canStart: ready === guests.length };
}
