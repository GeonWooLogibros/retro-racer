import type { LobbyLike, NamedRoomLike, PeerLike } from './types';

/**
 * Supabase Realtime 채널 위에 방 기능을 만듭니다.
 *
 * Supabase 무료 요금제는 Presence를 한 사람당 30초에 5번까지만 바꿀 수 있고, 프로젝트 전체 메시지가
 * 초당 100개(받는 사람마다 하나씩 셈)로 제한됩니다. 그래서 Presence는 방에 누가 있는지만 알리는 데 한 번 쓰고,
 * 각자의 상태는 Broadcast로 보냅니다. 보내는 간격은 방 인원에 맞춰 늘려서 전체 메시지 수를 예산 안에 둡니다.
 */

/** Supabase 채널 가운데 이 연결이 쓰는 부분. */
export interface ChannelLike {
  on(type: 'presence', filter: { event: 'sync' }, callback: () => void): ChannelLike;
  on(type: 'broadcast', filter: { event: string }, callback: (message: { payload?: unknown }) => void): ChannelLike;
  subscribe(callback: (status: string) => void): ChannelLike;
  track(state: Record<string, unknown>): Promise<unknown>;
  send(message: { type: 'broadcast'; event: string; payload: unknown }): Promise<unknown>;
  presenceState(): Record<string, unknown[]>;
}

export interface ChannelFactory {
  open(name: string, presenceKey: string): ChannelLike;
  close(channel: ChannelLike): void;
}

/** 상태를 보내는 가장 짧은 간격과, 방 하나가 쓸 수 있는 초당 메시지 수. */
const MIN_INTERVAL = 200;
const URGENT_INTERVAL = 100;
const EVENT_BUDGET = 70;
/** 바뀐 것이 없어도 이 간격마다 상태를 다시 보내서, 나중에 들어온 사람도 받게 합니다. */
export const HEARTBEAT = 2000;
/** 이 시간 동안 아무 소식이 없으면 방을 떠난 것으로 봅니다. */
const STALE = 6000;
/** 자주 바뀌는 위치 값. 이 값만 바뀌었을 때는 서두르지 않고 정해진 간격에 맞춰 보냅니다. */
const MOTION_KEYS = new Set(['z', 'x', 'speed', 'boost']);
const STATE_EVENT = 'state';

/** 방 인원이 늘수록 보내는 간격을 늘립니다. 한 사람이 보낸 상태는 나머지 모두에게 하나씩 세어지기 때문입니다. */
export function sendInterval(members: number): number {
  const n = Math.max(1, members);
  return Math.max(MIN_INTERVAL, Math.ceil((n * n * 1000) / EVENT_BUDGET));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

class SharedRoom implements NamedRoomLike {
  private readonly channel: ChannelLike;
  private mine: Record<string, unknown> = {};
  private mineAt = Date.now();
  private readonly received = new Map<string, { state: Record<string, unknown>; at: number }>();
  private members = new Set<string>();
  private readonly listeners = new Set<() => void>();
  private subscribed = false;
  private closed = false;
  private dirty = false;
  private urgent = false;
  private lastSent = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private notifyQueued = false;
  readonly ready: Promise<void>;

  constructor(
    private readonly factory: ChannelFactory,
    name: string,
    private readonly key: string,
  ) {
    this.channel = factory.open(name, key);
    let resolveReady: () => void = () => undefined;
    let rejectReady: (error: Error) => void = () => undefined;
    this.ready = new Promise((resolve, reject) => {
      resolveReady = resolve;
      rejectReady = reject;
    });
    this.channel
      .on('presence', { event: 'sync' }, () => this.onSync())
      .on('broadcast', { event: STATE_EVENT }, (message) => this.onState(message.payload))
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          this.subscribed = true;
          // Presence는 방에 들어왔다는 것만 한 번 알립니다.
          this.channel.track({ k: this.key }).catch(() => undefined);
          this.dirty = true;
          this.urgent = true;
          this.schedule();
          resolveReady();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          rejectReady(new Error(status));
        }
      });
  }

  private onSync(): void {
    const next = new Set(Object.keys(this.channel.presenceState()));
    let joined = false;
    for (const member of next) if (!this.members.has(member) && member !== this.key) joined = true;
    for (const member of this.members) if (!next.has(member)) this.received.delete(member);
    this.members = next;
    // 새로 들어온 사람이 있으면 내 상태를 바로 보내서, 기다리지 않고 받게 합니다.
    if (joined) {
      this.dirty = true;
      this.urgent = true;
      this.schedule();
    }
    this.notify();
  }

  private onState(payload: unknown): void {
    if (!isRecord(payload) || typeof payload.k !== 'string' || payload.k === this.key || !isRecord(payload.s)) return;
    this.received.set(payload.k.slice(0, 64), { state: payload.s, at: Date.now() });
    this.notify();
  }

  private notify(): void {
    if (this.notifyQueued || this.closed) return;
    this.notifyQueued = true;
    setTimeout(() => {
      this.notifyQueued = false;
      if (!this.closed) for (const listener of this.listeners) listener();
    }, 0);
  }

  private memberCount(): number {
    return this.peers().length;
  }

  private schedule(): void {
    if (this.closed || !this.subscribed) return;
    if (this.timer !== null) clearTimeout(this.timer);
    const gap = this.urgent ? URGENT_INTERVAL : sendInterval(this.memberCount());
    const due = this.dirty ? this.lastSent + gap : this.lastSent + HEARTBEAT;
    this.timer = setTimeout(() => this.flush(), Math.max(0, due - Date.now()));
  }

  private flush(): void {
    this.timer = null;
    if (this.closed || !this.subscribed) return;
    this.lastSent = Date.now();
    this.dirty = false;
    this.urgent = false;
    this.channel
      .send({ type: 'broadcast', event: STATE_EVENT, payload: { k: this.key, s: this.mine } })
      .catch(() => undefined);
    this.schedule();
  }

  presence(patch: Record<string, unknown>): Promise<void> {
    const next = { ...this.mine };
    for (const [field, value] of Object.entries(patch)) {
      if (value === null) delete next[field];
      else next[field] = value;
      if (!MOTION_KEYS.has(field)) this.urgent = true;
    }
    this.mine = next;
    this.mineAt = Date.now();
    this.dirty = true;
    this.schedule();
    this.notify();
    return Promise.resolve();
  }

  peers(): readonly PeerLike[] {
    const now = Date.now();
    const keys = new Set<string>([this.key, ...this.members]);
    // Presence가 늦게 도착해도 최근에 상태를 보낸 사람은 보이게 합니다.
    for (const [peer, entry] of this.received) if (now - entry.at < STALE) keys.add(peer);
    const list: PeerLike[] = [];
    for (const peer of keys) {
      if (peer === this.key) {
        list.push({ peer, sameTab: true, kind: 'viewer', presence: this.mine, updatedAt: this.mineAt });
        continue;
      }
      const entry = this.received.get(peer);
      if (!entry && !this.members.has(peer)) continue;
      if (entry && !this.members.has(peer) && now - entry.at >= STALE) continue;
      list.push({ peer, sameTab: false, kind: 'viewer', presence: entry?.state ?? {}, updatedAt: entry?.at ?? 0 });
    }
    return list;
  }

  onPeers(handler: () => void): () => void {
    this.listeners.add(handler);
    this.notify();
    return () => this.listeners.delete(handler);
  }

  leave(): Promise<void> {
    if (this.closed) return Promise.resolve();
    this.closed = true;
    if (this.timer !== null) clearTimeout(this.timer);
    this.listeners.clear();
    this.factory.close(this.channel);
    return Promise.resolve();
  }
}

/** 브라우저 탭마다 하나씩 쓰는 이름표. */
export function makePeerKey(rand: () => number = Math.random): string {
  let key = '';
  for (let i = 0; i < 16; i++) key += 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(rand() * 36)];
  return key;
}

/** 로비 채널에 들어가고, 이름을 붙인 방은 각자의 채널로 엽니다. */
export async function createSharedLobby(factory: ChannelFactory, key: string): Promise<LobbyLike> {
  const lobby = new SharedRoom(factory, 'rr-lobby', key);
  await lobby.ready;
  return {
    presence: (patch) => lobby.presence(patch),
    peers: () => lobby.peers(),
    onPeers: (handler) => lobby.onPeers(handler),
    async join(name) {
      const room = new SharedRoom(factory, name, key);
      try {
        await room.ready;
      } catch (error) {
        await room.leave();
        throw error;
      }
      return room;
    },
  };
}
