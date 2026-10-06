import type { LobbyLike } from './types';

/** claude.ai에 게시한 게임 링크. 그 안에서 열었을 때 초대 링크는 이 주소 뒤에 #방코드를 붙입니다. */
const CLAUDE_GAME_URL = 'https://claude.ai/artifact/3Z8M66LLC7xUnhqm9aLUjD';
/** 이 시간 안에 연결되지 않으면 혼자 하기로 둡니다(밀리초). */
const CONNECT_TIMEOUT = 10000;

export interface Connection {
  lobby: LobbyLike | null;
  /** 초대 링크의 앞부분. 이 뒤에 #방코드를 붙입니다. */
  inviteBase: string;
  /** 어떤 방식으로 연결했는지. 'claude'는 claude.ai의 room 기능, 'supabase'는 공개 사이트입니다. */
  via: 'claude' | 'p2p' | 'supabase' | 'none';
}

function withTimeout<T>(promise: Promise<T>): Promise<T | null> {
  return Promise.race([promise, new Promise<null>((resolve) => setTimeout(() => resolve(null), CONNECT_TIMEOUT))]);
}

/**
 * 방 기능에 연결합니다. claude.ai 안에서 열었으면 그 room 기능을 쓰고,
 * Supabase 설정을 넣어 빌드한 공개 사이트에서는 Supabase Realtime을 씁니다. 둘 다 아니면 혼자 하기만 됩니다.
 */
export async function connect(): Promise<Connection> {
  const claude = (window as unknown as { claude?: { use(name: string): Promise<unknown> } }).claude;
  if (claude?.use) {
    const lobby = (await claude.use('room').catch(() => null)) as LobbyLike | null;
    return { lobby, inviteBase: CLAUDE_GAME_URL, via: lobby ? 'claude' : 'none' };
  }

  const inviteBaseHere = `${window.location.origin}${window.location.pathname}`;
  if (import.meta.env.VITE_NET === 'p2p') {
    try {
      const [{ Peer }, { createP2PLobby }, { makePeerKey }] = await Promise.all([
        import('peerjs'),
        import('./p2p-room'),
        import('./shared-room'),
      ]);
      const make = (id?: string) => (id ? new Peer(id) : new Peer()) as unknown as import('./p2p-room').NodeLike;
      return { lobby: createP2PLobby(make, makePeerKey()), inviteBase: inviteBaseHere, via: 'p2p' };
    } catch {
      return { lobby: null, inviteBase: inviteBaseHere, via: 'none' };
    }
  }

  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_KEY as string | undefined;
  const inviteBase = `${window.location.origin}${window.location.pathname}`;
  if (url && key) {
    try {
      const [{ createClient }, { createSharedLobby, makePeerKey }] = await Promise.all([
        import('@supabase/supabase-js'),
        import('./shared-room'),
      ]);
      const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
      const factory = {
        open: (name: string, presenceKey: string) =>
          client.channel(name, {
            config: { presence: { key: presenceKey }, broadcast: { self: false, ack: false } },
          }) as unknown as import('./shared-room').ChannelLike,
        close: (channel: import('./shared-room').ChannelLike) => {
          void client.removeChannel(channel as unknown as Parameters<typeof client.removeChannel>[0]);
        },
      };
      const lobby = await withTimeout(createSharedLobby(factory, makePeerKey()));
      return { lobby, inviteBase, via: lobby ? 'supabase' : 'none' };
    } catch {
      return { lobby: null, inviteBase, via: 'none' };
    }
  }
  return { lobby: null, inviteBase, via: 'none' };
}
