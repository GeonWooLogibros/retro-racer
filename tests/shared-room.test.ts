import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  HEARTBEAT,
  createSharedLobby,
  makePeerKey,
  sendInterval,
  type ChannelFactory,
  type ChannelLike,
} from '../src/net/shared-room';

/** Supabase 채널 흉내. 보낸 상태와 Presence 기록을 남기고, 다른 사람의 소식을 넣어 볼 수 있습니다. */
class FakeChannel implements ChannelLike {
  sent: { k: string; s: Record<string, unknown> }[] = [];
  tracked: Record<string, unknown>[] = [];
  state: Record<string, unknown[]> = {};
  private sync: () => void = () => undefined;
  private onState: (message: { payload?: unknown }) => void = () => undefined;
  private status: (status: string) => void = () => undefined;
  closed = false;

  constructor(readonly name: string) {}
  on(
    type: 'presence' | 'broadcast',
    _filter: { event: string },
    callback: (message: { payload?: unknown }) => void,
  ): this {
    if (type === 'presence') this.sync = () => callback({});
    else this.onState = callback;
    return this;
  }
  subscribe(callback: (status: string) => void): this {
    this.status = callback;
    return this;
  }
  track(state: Record<string, unknown>): Promise<unknown> {
    this.tracked.push(state);
    return Promise.resolve('ok');
  }
  send(message: { payload: unknown }): Promise<unknown> {
    this.sent.push(message.payload as { k: string; s: Record<string, unknown> });
    return Promise.resolve('ok');
  }
  presenceState(): Record<string, unknown[]> {
    return this.state;
  }
  connect(): void {
    this.status('SUBSCRIBED');
  }
  members(...keys: string[]): void {
    this.state = Object.fromEntries(keys.map((key) => [key, [{ k: key }]]));
    this.sync();
  }
  hear(payload: unknown): void {
    this.onState({ payload });
  }
}

function setup(): { factory: ChannelFactory; channels: Map<string, FakeChannel> } {
  const channels = new Map<string, FakeChannel>();
  const factory: ChannelFactory = {
    open(name) {
      const channel = new FakeChannel(name);
      channels.set(name, channel);
      queueMicrotask(() => channel.connect());
      return channel;
    },
    close(channel) {
      (channel as FakeChannel).closed = true;
    },
  };
  return { factory, channels };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('sendInterval', () => {
  it('두세 명일 때는 0.2초마다 보내고, 인원이 늘면 메시지 예산에 맞춰 간격을 늘립니다', () => {
    expect(sendInterval(1)).toBe(200);
    expect(sendInterval(3)).toBe(200);
    expect(sendInterval(6)).toBeGreaterThan(500);
    // 한 사람이 보낸 상태는 나머지 모두에게 하나씩 세어지므로, 인원 n명이면 초당 n×n×(1000/간격)개입니다.
    for (const n of [2, 4, 6, 8]) expect((n * n * 1000) / sendInterval(n)).toBeLessThanOrEqual(80);
  });
});

describe('makePeerKey', () => {
  it('16글자 영문 소문자와 숫자로 만듭니다', () => {
    expect(makePeerKey()).toMatch(/^[a-z0-9]{16}$/);
  });
});

describe('공유 방', () => {
  it('Presence는 들어올 때 한 번만 쓰고, 상태는 Broadcast로 보냅니다', async () => {
    const { factory, channels } = setup();
    const lobby = await createSharedLobby(factory, 'me');
    const room = await lobby.join('rr-ab2cd');
    const channel = channels.get('rr-ab2cd')!;
    for (let i = 0; i < 30; i++) {
      await room.presence({ z: i * 100, x: 0.1, speed: 9000 });
      await vi.advanceTimersByTimeAsync(60);
    }
    expect(channel.tracked).toEqual([{ k: 'me' }]);
    expect(channel.sent.length).toBeGreaterThan(3);
    expect(channel.sent.at(-1)).toEqual({ k: 'me', s: { z: 2900, x: 0.1, speed: 9000 } });
  });

  it('위치만 바뀌면 정해진 간격을 지키고, 다른 값이 바뀌면 바로 보냅니다', async () => {
    const { factory, channels } = setup();
    const lobby = await createSharedLobby(factory, 'me');
    const room = await lobby.join('rr-ab2cd');
    const channel = channels.get('rr-ab2cd')!;
    await vi.advanceTimersByTimeAsync(500);
    const before = channel.sent.length;
    for (let i = 0; i < 10; i++) {
      await room.presence({ z: i });
      await vi.advanceTimersByTimeAsync(20);
    }
    // 0.2초 동안 위치를 열 번 바꿔도 많아야 한두 번만 보냅니다.
    expect(channel.sent.length - before).toBeLessThanOrEqual(2);
    await room.presence({ phase: 'race', race: 'r1' });
    await vi.advanceTimersByTimeAsync(110);
    expect(channel.sent.at(-1)?.s).toMatchObject({ phase: 'race', race: 'r1' });
  });

  it('바뀐 것이 없어도 2초마다 다시 보내서 나중에 들어온 사람도 받게 합니다', async () => {
    const { factory, channels } = setup();
    const lobby = await createSharedLobby(factory, 'me');
    const room = await lobby.join('rr-ab2cd');
    const channel = channels.get('rr-ab2cd')!;
    await room.presence({ name: '나' });
    await vi.advanceTimersByTimeAsync(300);
    const before = channel.sent.length;
    await vi.advanceTimersByTimeAsync(HEARTBEAT * 3 + 10);
    expect(channel.sent.length - before).toBe(3);
  });

  it('다른 사람의 상태를 받아 peers에 보여 주고, 나도 함께 들어 있습니다', async () => {
    const { factory, channels } = setup();
    const lobby = await createSharedLobby(factory, 'me');
    const room = await lobby.join('rr-ab2cd');
    const channel = channels.get('rr-ab2cd')!;
    const changes = vi.fn();
    room.onPeers(changes);
    await room.presence({ name: '나' });
    channel.members('me', 'friend');
    channel.hear({ k: 'friend', s: { name: '친구', z: 500 } });
    await vi.advanceTimersByTimeAsync(1);
    const peers = room.peers();
    expect(peers.map((p) => [p.peer, p.sameTab, p.presence.name])).toEqual([
      ['me', true, '나'],
      ['friend', false, '친구'],
    ]);
    expect(changes).toHaveBeenCalled();
  });

  it('형식이 틀린 소식과 내 이름표로 온 소식은 무시합니다', async () => {
    const { factory, channels } = setup();
    const lobby = await createSharedLobby(factory, 'me');
    const room = await lobby.join('rr-ab2cd');
    const channel = channels.get('rr-ab2cd')!;
    channel.hear('nonsense');
    channel.hear({ k: 5, s: {} });
    channel.hear({ k: 'x', s: [1, 2] });
    channel.hear({ k: 'me', s: { name: '가짜 나' } });
    expect(room.peers().map((p) => p.peer)).toEqual(['me']);
  });

  it('Presence에서 빠진 사람은 바로 목록에서 빠집니다', async () => {
    const { factory, channels } = setup();
    const lobby = await createSharedLobby(factory, 'me');
    const room = await lobby.join('rr-ab2cd');
    const channel = channels.get('rr-ab2cd')!;
    channel.members('me', 'friend');
    channel.hear({ k: 'friend', s: { name: '친구' } });
    channel.members('me');
    expect(room.peers().map((p) => p.peer)).toEqual(['me']);
  });

  it('새 사람이 들어오면 내 상태를 바로 다시 보냅니다', async () => {
    const { factory, channels } = setup();
    const lobby = await createSharedLobby(factory, 'me');
    const room = await lobby.join('rr-ab2cd');
    const channel = channels.get('rr-ab2cd')!;
    await room.presence({ name: '나' });
    await vi.advanceTimersByTimeAsync(300);
    const before = channel.sent.length;
    channel.members('me', 'newcomer');
    await vi.advanceTimersByTimeAsync(110);
    expect(channel.sent.length).toBe(before + 1);
  });

  it('방을 나가면 채널을 닫고 더는 보내지 않습니다', async () => {
    const { factory, channels } = setup();
    const lobby = await createSharedLobby(factory, 'me');
    const room = await lobby.join('rr-ab2cd');
    const channel = channels.get('rr-ab2cd')!;
    await room.leave();
    const before = channel.sent.length;
    await room.presence({ z: 1 });
    await vi.advanceTimersByTimeAsync(HEARTBEAT * 2);
    expect(channel.closed).toBe(true);
    expect(channel.sent.length).toBe(before);
  });
});
