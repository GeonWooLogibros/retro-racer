import { describe, expect, it } from 'vitest';
import {
  ROOM_CODE_LENGTH,
  cleanName,
  extrapolate,
  makeRoomCode,
  parseRoomCode,
  pickHost,
  readRacer,
  roomName,
  standings,
} from '../src/game/multi';
import { mulberry32 } from '../src/game/random';

describe('방 코드', () => {
  it('헷갈리는 글자 없이 다섯 글자로 만들고, 만든 코드는 다시 읽힙니다', () => {
    const rand = mulberry32(3);
    for (let i = 0; i < 50; i++) {
      const code = makeRoomCode(rand);
      expect(code).toHaveLength(ROOM_CODE_LENGTH);
      expect(code).not.toMatch(/[01oil]/);
      expect(parseRoomCode(code)).toBe(code);
    }
  });

  it('대문자, 앞뒤 공백, 초대 링크에서도 코드를 꺼냅니다', () => {
    expect(parseRoomCode('  AB2CD ')).toBe('ab2cd');
    expect(parseRoomCode('https://claude.ai/artifact/xyz#ab2cd')).toBe('ab2cd');
    expect(parseRoomCode('#ab2cd')).toBe('ab2cd');
  });

  it('형식이 다르면 null입니다', () => {
    for (const text of ['', 'abcd', 'abcdef', 'ab0cd', 'ab cd', '#']) expect(parseRoomCode(text)).toBeNull();
  });

  it('방 이름은 코드 앞에 rr-를 붙입니다', () => {
    expect(roomName('ab2cd')).toBe('rr-ab2cd');
  });
});

describe('cleanName', () => {
  it('제어 문자와 보이지 않는 글자를 지우고 12글자로 줄입니다', () => {
    expect(cleanName('가나\u200b다\n라')).toBe('가나다라');
    expect(cleanName('가'.repeat(20))).toBe('가'.repeat(12));
  });

  it('글자가 아니거나 비어 있으면 기본 이름을 씁니다', () => {
    expect(cleanName(42)).toBe('레이서');
    expect(cleanName('   ')).toBe('레이서');
  });
});

describe('readRacer', () => {
  it('올바른 값을 그대로 읽습니다', () => {
    const r = readRacer('p1', {
      name: '번개',
      owner: true,
      since: 5,
      map: 2,
      seed: 9,
      phase: 'race',
      race: 'r1',
      z: 100,
      x: 0.5,
      speed: 3000,
      boost: true,
      done: 151.2,
      out: false,
    });
    expect(r).toEqual({
      peer: 'p1',
      name: '번개',
      owner: true,
      since: 5,
      map: 2,
      seed: 9,
      phase: 'race',
      race: 'r1',
      z: 100,
      x: 0.5,
      speed: 3000,
      boost: true,
      done: 151.2,
      out: false,
    });
  });

  it('형식이 틀리거나 범위를 벗어난 값은 안전한 값으로 바꿉니다', () => {
    const r = readRacer('p2', {
      since: 'x',
      map: -3,
      phase: 'hack',
      race: 7,
      z: 'far',
      x: 99,
      speed: -5,
      boost: 'yes',
      done: -1,
    });
    expect(r).toMatchObject({
      owner: false,
      since: Number.MAX_SAFE_INTEGER,
      map: 0,
      phase: 'wait',
      race: null,
      z: 0,
      x: 2,
      speed: 0,
      boost: false,
      done: null,
      out: false,
    });
  });
});

describe('pickHost', () => {
  it('방을 만든 사람이 있으면 시계와 상관없이 그 사람이 방장입니다', () => {
    expect(
      pickHost([
        { peer: 'early-clock', since: 5, owner: false },
        { peer: 'maker', since: 99, owner: true },
      ]),
    ).toBe('maker');
  });

  it('방을 만든 사람이 없으면 가장 먼저 들어온 사람이고, 시각이 같으면 이름표 순서로 정합니다', () => {
    expect(
      pickHost([
        { peer: 'b', since: 20, owner: false },
        { peer: 'a', since: 30, owner: false },
        { peer: 'c', since: 10, owner: false },
      ]),
    ).toBe('c');
    expect(
      pickHost([
        { peer: 'b', since: 10, owner: false },
        { peer: 'a', since: 10, owner: false },
      ]),
    ).toBe('a');
    expect(pickHost([])).toBeNull();
  });
});

describe('standings', () => {
  it('완주한 사람은 기록 순, 달리는 사람은 거리 순, 시간이 끝난 사람은 맨 뒤입니다', () => {
    const racers = [
      { id: 'running-far', z: 900, done: null, out: false },
      { id: 'out', z: 950, done: null, out: true },
      { id: 'slow-finish', z: 1000, done: 160, out: false },
      { id: 'running-near', z: 300, done: null, out: false },
      { id: 'fast-finish', z: 1000, done: 150, out: false },
    ];
    expect(standings(racers).map((r) => r.id)).toEqual([
      'fast-finish',
      'slow-finish',
      'running-far',
      'running-near',
      'out',
    ]);
  });
});

describe('extrapolate', () => {
  it('받은 뒤 지난 시간만큼 앞으로 밀되, 0.5초까지만 밉니다', () => {
    expect(extrapolate(1000, 2000, 250)).toBe(1500);
    expect(extrapolate(1000, 2000, 5000)).toBe(2000);
    expect(extrapolate(1000, 2000, -10)).toBe(1000);
  });
});
