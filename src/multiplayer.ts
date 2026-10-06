import { formatKm, formatTime } from './format';
import { SEGMENT_LENGTH, START_Z } from './game/constants';
import { MAPS } from './game/maps';
import {
  cleanName,
  extrapolate,
  makeRoomCode,
  parseRoomCode,
  pickHost,
  readRacer,
  roomName,
  standings,
  type Racer,
} from './game/multi';
import { connect } from './net/connect';
import type { LobbyLike, NamedRoomLike } from './net/types';

const NAME_KEY = 'retro-racer.name';
/** 위치를 보내는 간격(밀리초). */
const SEND_INTERVAL = 60;
/** 방장이 출발선에서 이만큼 안에 있으면 막 시작한 경주로 보고 함께 출발합니다. 더 멀리 갔으면 다음 경주를 기다립니다. */
const FRESH_RACE = SEGMENT_LENGTH * 25;
/** 방에 들어온 직후 다른 사람의 상태가 다 도착하기까지 기다리는 시간(밀리초). 그동안은 방장 버튼을 보여 주지 않습니다. */
const SETTLE = 2000;
const RACER_COLORS = 5;

/** 내 경주 상태. 매 화면마다 방에 알립니다. */
export interface LocalRace {
  z: number;
  x: number;
  speed: number;
  boost: boolean;
  done: number | null;
  out: boolean;
}

/** 화면에 그릴 다른 사람. */
export interface RemoteRacer {
  ghost: true;
  name: string;
  z: number;
  x: number;
  boost: number;
  color: number;
}

export interface MultiplayerHooks {
  /** 사용자가 버튼을 눌렀을 때. 소리를 켜는 데 씁니다. */
  onGesture(): void;
  /** 모두가 같은 코스로 출발합니다. 카운트다운은 게임이 맡습니다. */
  onRaceStart(map: number, seed: number): void;
  /** 대기실로 돌아왔습니다. map은 방장이 고른 맵입니다. */
  onWait(map: number): void;
  /** 방을 나가 혼자 하기로 돌아왔습니다. */
  onLeave(): void;
}

export interface Multiplayer {
  /** 방에 들어가 있는지 여부. */
  inRoom(): boolean;
  /** 방을 나가 혼자 하기로 돌아갑니다. */
  leave(): void;
  /** 화면에 방 창이 떠 있어서 게임 키를 막아야 하는지 여부. */
  blocksInput(): boolean;
  remotes(now: number): RemoteRacer[];
  standing(local: LocalRace): { rank: number; total: number } | null;
  /** 매 화면마다 부릅니다. 경주 중이 아니면 local은 null입니다. */
  update(local: LocalRace | null, titleShown: boolean): void;
}

const STYLE = `
.mp-open{position:fixed;top:16px;right:16px;z-index:5;font:600 15px/1.2 system-ui,'Apple SD Gothic Neo',sans-serif;
  padding:12px 18px;border-radius:999px;border:2px solid #ffe066;background:#141a33;color:#ffe066;cursor:pointer}
.mp-open:hover,.mp-open:focus-visible{background:#ffe066;color:#141a33;outline:none}
.mp-layer{position:fixed;inset:0;z-index:6;display:flex;align-items:center;justify-content:center;padding:16px;
  background:rgba(5,7,15,.55);font:15px/1.5 system-ui,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;color:#eef1ff}
.mp-layer[data-side]{justify-content:flex-end;background:transparent;pointer-events:none}
.mp-card{width:min(420px,100%);max-height:100%;overflow:auto;background:#141a33;border:2px solid #2b3566;border-radius:14px;
  padding:20px;box-shadow:0 18px 48px rgba(0,0,0,.45);pointer-events:auto;display:flex;flex-direction:column;gap:12px}
.mp-card h2{margin:0;font-size:22px;color:#ffe066;letter-spacing:.02em}
.mp-card h3{margin:4px 0 0;font-size:13px;color:#9aa6d6;letter-spacing:.06em}
.mp-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.mp-row>input{flex:1;min-width:0}
.mp-card input{font:inherit;padding:10px 12px;border-radius:8px;border:1px solid #3a4680;background:#0b1024;color:#eef1ff}
.mp-card input:focus-visible{outline:2px solid #ffe066;outline-offset:1px}
.mp-card button{font-family:inherit;font-weight:600;font-size:15px;line-height:1.2;padding:11px 14px;border-radius:8px;border:1px solid #3a4680;
  background:#1f2850;color:#eef1ff;cursor:pointer}
.mp-card button:hover:not(:disabled),.mp-card button:focus-visible{border-color:#ffe066;outline:none}
.mp-card button:disabled{opacity:.45;cursor:default}
.mp-card button.mp-main{background:#ffe066;border-color:#ffe066;color:#141a33}
.mp-code{font:700 34px/1 ui-monospace,Menlo,monospace;letter-spacing:.18em;color:#ffe066}
.mp-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
.mp-list li{display:flex;justify-content:space-between;gap:10px;padding:8px 10px;border-radius:8px;background:#0b1024}
.mp-list li span:last-child{color:#9aa6d6;font-variant-numeric:tabular-nums;white-space:nowrap}
.mp-list li.mp-me{outline:1px solid #ffe066}
.mp-list button{width:100%;text-align:left}
.mp-note{margin:0;color:#9aa6d6;font-size:14px}
.mp-note.mp-warn{color:#ffb3a7}
.mp-open[hidden],.mp-layer[hidden]{display:none}
`;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function button(label: string, onClick: () => void, className = ''): HTMLButtonElement {
  const node = el('button', label, className);
  node.type = 'button';
  node.addEventListener('click', onClick);
  return node;
}

function stars(difficulty: number): string {
  return '★'.repeat(difficulty) + '☆'.repeat(5 - difficulty);
}

function loadName(): string {
  try {
    const saved = window.localStorage.getItem(NAME_KEY);
    if (saved) return cleanName(saved);
  } catch {
    // 저장소를 쓸 수 없으면 새 이름을 씁니다.
  }
  return `레이서${String(Math.floor(Math.random() * 90) + 10)}`;
}

function saveName(name: string): void {
  try {
    window.localStorage.setItem(NAME_KEY, name);
  } catch {
    // 저장하지 못해도 이번 접속에서는 그대로 씁니다.
  }
}

/** 이름표마다 늘 같은 색을 고릅니다. */
function colorOf(peer: string): number {
  let hash = 0;
  for (const char of peer) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash % RACER_COLORS;
}

export function createMultiplayer(hooks: MultiplayerHooks): Multiplayer {
  const style = el('style');
  style.textContent = STYLE;
  document.head.append(style);

  const openButton = button(
    '같이 하기',
    () => {
      hooks.onGesture();
      showMenu();
    },
    'mp-open',
  );
  const layer = el('div', '', 'mp-layer');
  layer.hidden = true;
  document.body.append(openButton, layer);

  let lobby: LobbyLike | null = null;
  let lobbyChecked = false;
  let room: NamedRoomLike | null = null;
  let code: string | null = null;
  let since = 0;
  let joinedAt = 0;
  let name = loadName();
  let pickedMap = 0;
  /** 지금 달리는 경주. by는 이 경주를 시작한 방장의 이름표입니다. */
  let race: { id: string; map: number; seed: number; by: string | null } | null = null;
  let owner = false;
  let joining = false;
  let sentFinish = false;
  /** 순위표에서 다시 그리지 않고 줄만 바꿀 목록과, 그 목록을 그린 경주와 방장 여부. */
  let resultsList: HTMLOListElement | null = null;
  let resultsFrame = '';
  let seenRace: string | null = null;
  let panel: 'closed' | 'menu' | 'room' | 'results' = 'closed';
  let note = '';
  let lastSent = 0;
  let lastResults = 0;
  let pendingCode = parseRoomCode(window.location.hash) ?? '';
  /** 마지막으로 그린 창과 로비에 알린 내용. 바뀌지 않았으면 다시 그리거나 보내지 않습니다. */
  let shownKey = '';
  let advertised = '';

  let inviteBase = '';
  void connect().then((connection) => {
    lobby = connection.lobby;
    inviteBase = connection.inviteBase;
    lobbyChecked = true;
    lobby?.onPeers(() => {
      if (panel === 'menu') refreshRooms();
    });
    if (panel === 'menu') {
      shownKey = '';
      showMenu();
    }
  });
  // 초대 링크로 들어왔으면 바로 참가 창을 엽니다.
  if (pendingCode) queueMicrotask(showMenu);

  function others(): Racer[] {
    if (!room) return [];
    return room
      .peers()
      .filter((peer) => peer.kind === 'viewer' && !peer.sameTab)
      .map((peer) => readRacer(peer.peer, peer.presence));
  }

  function everyone(): { racer: Racer; me: boolean; updatedAt: number }[] {
    if (!room) return [];
    return room
      .peers()
      .filter((peer) => peer.kind === 'viewer')
      .map((peer) => ({ racer: readRacer(peer.peer, peer.presence), me: peer.sameTab, updatedAt: peer.updatedAt }));
  }

  function hostRacer(): { racer: Racer; me: boolean } | null {
    const all = everyone();
    const host = pickHost(all.map((entry) => entry.racer));
    return all.find((entry) => entry.racer.peer === host) ?? null;
  }

  function isHost(): boolean {
    const host = hostRacer();
    if (!host) return owner;
    // 방을 만들지 않은 사람은 다른 사람의 상태가 도착할 때까지 방장으로 치지 않습니다.
    if (host.me && !owner && Date.now() - joinedAt < SETTLE) return false;
    return host.me;
  }

  function send(patch: Record<string, unknown>): void {
    room?.presence(patch).catch(() => undefined);
  }

  function advertise(): void {
    if (!lobby) return;
    const patch = { name, hosting: room && isHost() ? code : null };
    const key = JSON.stringify(patch);
    if (key === advertised) return;
    advertised = key;
    lobby.presence(patch).catch(() => undefined);
  }

  /** 같은 창을 같은 내용으로 다시 그리지 않습니다. 입력 중인 칸과 누르려던 버튼이 사라지지 않게 합니다. */
  function unchanged(mode: typeof panel, key: string): boolean {
    const full = `${mode}|${key}`;
    if (panel === mode && shownKey === full) return true;
    shownKey = full;
    return false;
  }

  function show(mode: typeof panel, card: HTMLElement): void {
    panel = mode;
    layer.replaceChildren(card);
    layer.hidden = false;
    if (mode === 'results') layer.dataset.side = '';
    else delete layer.dataset.side;
  }

  function hide(): void {
    panel = 'closed';
    shownKey = '';
    layer.hidden = true;
    layer.replaceChildren();
  }

  function nameInput(): HTMLInputElement {
    const input = el('input');
    input.id = 'mp-name';
    input.maxLength = 24;
    input.value = name;
    input.setAttribute('aria-label', '닉네임');
    input.addEventListener('input', () => {
      name = cleanName(input.value, name);
    });
    input.addEventListener('change', () => {
      input.value = name;
      saveName(name);
      advertise();
      send({ name });
    });
    return input;
  }

  function openRooms(): { code: string; host: string }[] {
    if (!lobby) return [];
    return lobby
      .peers()
      .filter((peer) => !peer.sameTab && typeof peer.presence.hosting === 'string')
      .map((peer) => ({ code: parseRoomCode(String(peer.presence.hosting)), host: cleanName(peer.presence.name) }))
      .filter((entry): entry is { code: string; host: string } => entry.code !== null);
  }

  /** 메뉴의 열린 방 목록만 바꿉니다. 메뉴 전체를 다시 그리면 입력 중인 칸이 사라지기 때문입니다. */
  let roomsBox: HTMLElement | null = null;
  let roomsKey = '';
  function refreshRooms(): void {
    if (!roomsBox) return;
    const open = openRooms();
    const key = JSON.stringify(open);
    if (key === roomsKey) return;
    roomsKey = key;
    if (open.length === 0) {
      roomsBox.replaceChildren(el('p', '아직 열린 방이 없어요. 방을 만들고 친구를 초대해 보세요.', 'mp-note'));
      return;
    }
    const list = el('ul', '', 'mp-list');
    for (const entry of open) {
      const item = el('li');
      item.append(
        button(`${entry.host}의 방 · ${entry.code.toUpperCase()}`, () => {
          hooks.onGesture();
          void enter(entry.code);
        }),
      );
      list.append(item);
    }
    roomsBox.replaceChildren(list);
  }

  function showMenu(): void {
    if (unchanged('menu', JSON.stringify([lobbyChecked, lobby !== null, note]))) return;
    roomsBox = null;
    roomsKey = '';
    const card = el('div', '', 'mp-card');
    card.append(el('h2', '같이 하기'));
    if (!lobbyChecked) {
      card.append(el('p', '연결하는 중이에요…', 'mp-note'));
    } else if (!lobby) {
      card.append(
        el(
          'p',
          '지금은 같이 하기 서버에 연결할 수 없어요. claude.ai 링크라면 로그인한 상태로 열어 주세요. 지금은 혼자 하기만 할 수 있어요.',
          'mp-note mp-warn',
        ),
      );
    } else {
      card.append(el('h3', '닉네임'), nameInput());
      card.append(
        button(
          '방 만들기',
          () => {
            hooks.onGesture();
            void enter(makeRoomCode(Math.random), true);
          },
          'mp-main',
        ),
      );

      card.append(el('h3', '방 코드로 참가'));
      const row = el('div', '', 'mp-row');
      const codeInput = el('input');
      codeInput.id = 'mp-code';
      codeInput.placeholder = '방 코드 5글자';
      codeInput.maxLength = 64;
      codeInput.value = pendingCode;
      codeInput.setAttribute('aria-label', '방 코드');
      codeInput.addEventListener('input', () => {
        pendingCode = codeInput.value;
      });
      const join = (): void => {
        hooks.onGesture();
        const parsed = parseRoomCode(codeInput.value);
        if (!parsed) {
          note = '방 코드는 영문과 숫자 5글자예요.';
          showMenu();
          return;
        }
        void enter(parsed);
      };
      codeInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') join();
      });
      row.append(codeInput, button('참가하기', join));
      card.append(row);

      if (lobby.listsRooms !== false) {
        card.append(el('h3', '열린 방'));
        roomsBox = el('div');
        card.append(roomsBox);
        refreshRooms();
      } else {
        card.append(el('p', '친구에게 방 코드나 초대 링크를 보내서 같은 방에 들어오게 하세요.', 'mp-note'));
      }
    }
    if (note) card.append(el('p', note, 'mp-note mp-warn'));
    card.append(
      button('혼자 하기', () => {
        note = '';
        hide();
      }),
    );
    show('menu', card);
  }

  async function enter(target: string, asOwner = false): Promise<void> {
    // 버튼을 여러 번 눌러도 방에는 한 번만 들어갑니다.
    if (!lobby || joining || room) return;
    joining = true;
    note = '';
    try {
      room = await lobby.join(roomName(target));
    } catch {
      note = '방에 들어가지 못했어요. 잠시 뒤에 다시 해 보세요.';
      room = null;
      showMenu();
      return;
    } finally {
      joining = false;
    }
    owner = asOwner;
    code = target;
    pendingCode = '';
    since = Date.now();
    joinedAt = since;
    race = null;
    seenRace = null;
    send({
      name,
      owner,
      since,
      phase: 'wait',
      race: null,
      map: pickedMap,
      seed: 0,
      z: START_Z,
      x: 0,
      speed: 0,
      boost: false,
      done: null,
      out: false,
    });
    room.onPeers(() => sync());
    advertise();
    showRoom();
    // 다른 사람의 상태가 다 도착한 뒤에 방장 여부를 다시 확인합니다.
    if (!owner) window.setTimeout(sync, SETTLE + 50);
  }

  async function leave(): Promise<void> {
    const leaving = room;
    room = null;
    code = null;
    race = null;
    advertise();
    hide();
    hooks.onLeave();
    await leaving?.leave().catch(() => undefined);
  }

  function startRace(): void {
    const id = Date.now().toString(36);
    const seed = 1 + Math.floor(Math.random() * 0x7fffffff);
    seenRace = id;
    beginRace(id, pickedMap, seed, null);
  }

  function beginRace(id: string, map: number, seed: number, by: string | null): void {
    race = { id, map, seed, by };
    sentFinish = false;
    send({ phase: 'race', race: id, map, seed, z: START_Z, x: 0, speed: 0, boost: false, done: null, out: false });
    hide();
    hooks.onRaceStart(map, seed);
  }

  function backToWait(map: number): void {
    race = null;
    send({ phase: 'wait', race: null });
    hooks.onWait(map);
    showRoom();
  }

  /** 방 안의 변화에 따라 경주를 시작하거나 대기실로 돌아갑니다. 방장의 상태만 따릅니다. */
  function sync(): void {
    if (!room) return;
    const host = hostRacer();
    if (host && !host.me) {
      const h = host.racer;
      if (h.phase === 'race' && h.race && h.race !== seenRace) {
        seenRace = h.race;
        // 방장이 아직 출발선 근처에 있으면 함께 출발하고, 이미 멀리 갔으면 다음 경주를 기다립니다.
        if (h.z - START_Z <= FRESH_RACE && h.map < MAPS.length) beginRace(h.race, h.map, h.seed, h.peer);
      } else if (h.phase === 'wait' && race && race.by === h.peer) {
        // 내 경주를 시작한 방장이 대기실로 돌아갔을 때만 따라갑니다. 방장이 바뀐 것만으로는 경주를 끝내지 않습니다.
        backToWait(h.map);
        return;
      }
    }
    advertise();
    if (panel === 'room') showRoom();
  }

  function showRoom(): void {
    if (!room || !code) return;
    const host = isHost();
    const hostEntry = hostRacer();
    const map = host ? pickedMap : Math.min(MAPS.length - 1, hostEntry?.racer.map ?? 0);
    const roster = everyone().map((entry) => [entry.racer.peer, entry.racer.name, entry.me]);
    if (unchanged('room', JSON.stringify([code, host, map, hostEntry?.racer.peer, roster]))) return;
    const card = el('div', '', 'mp-card');
    card.append(el('h3', '방 코드'), el('div', code.toUpperCase(), 'mp-code'));

    const link = `${inviteBase}#${code}`;
    const linkRow = el('div', '', 'mp-row');
    const linkInput = el('input');
    linkInput.readOnly = true;
    linkInput.value = link;
    linkInput.setAttribute('aria-label', '초대 링크');
    const copy = button('초대 링크 복사', () => {
      navigator.clipboard.writeText(link).then(
        () => {
          copy.textContent = '복사했어요';
        },
        () => {
          linkInput.select();
          copy.textContent = '선택했어요. 복사해 주세요';
        },
      );
    });
    linkRow.append(linkInput, copy);
    card.append(linkRow);

    const all = everyone();
    const hostPeer = pickHost(all.map((entry) => entry.racer));
    card.append(el('h3', `참가자 ${all.length}명`));
    const list = el('ul', '', 'mp-list');
    for (const entry of all) {
      const item = el('li', '', entry.me ? 'mp-me' : '');
      const tags = [entry.racer.peer === hostPeer ? '방장' : '', entry.me ? '나' : ''].filter(Boolean).join(' · ');
      item.append(el('span', entry.me ? name : entry.racer.name), el('span', tags));
      list.append(item);
    }
    card.append(list);

    card.append(el('h3', '맵'));
    const mapRow = el('div', '', 'mp-row');
    const label = el('span', `${MAPS[map].name}  ${stars(MAPS[map].difficulty)}`);
    label.style.flex = '1';
    if (host) {
      const move = (direction: number): void => {
        pickedMap = (pickedMap + direction + MAPS.length) % MAPS.length;
        send({ map: pickedMap });
        hooks.onWait(pickedMap);
        showRoom();
      };
      mapRow.append(
        button('◀', () => move(-1)),
        label,
        button('▶', () => move(1)),
      );
      card.append(
        mapRow,
        button(
          '출발하기',
          () => {
            hooks.onGesture();
            startRace();
          },
          'mp-main',
        ),
      );
    } else {
      mapRow.append(label);
      card.append(mapRow, el('p', '방장이 맵을 고르고 출발하기를 누르면 시작해요.', 'mp-note'));
    }
    card.append(button('방 나가기', () => void leave()));
    show('room', card);
  }

  function showResults(): void {
    if (!room || !race) return;
    const id = race.id;
    const racers = everyone().filter((entry) => entry.racer.race === id);
    const ranked = standings(racers.map((entry) => ({ ...entry.racer, me: entry.me })));
    const host = isHost();
    const frame = JSON.stringify([id, host]);
    const list = el('ol', '', 'mp-list');
    ranked.forEach((racer, i) => {
      const status =
        racer.done !== null
          ? formatTime(racer.done)
          : racer.out
            ? `시간 종료 · ${formatKm(Math.max(0, racer.z - START_Z))}`
            : `달리는 중 · ${formatKm(Math.max(0, racer.z - START_Z))}`;
      const item = el('li', '', racer.me ? 'mp-me' : '');
      item.append(el('span', `${i + 1}위  ${racer.me ? name : racer.name}`), el('span', status));
      list.append(item);
    });
    // 같은 경주의 순위표가 이미 떠 있으면 목록만 바꿔서, 누르려던 버튼이 사라지지 않게 합니다.
    if (panel === 'results' && resultsFrame === frame && resultsList) {
      resultsList.replaceChildren(...list.children);
      return;
    }
    resultsFrame = frame;
    resultsList = list;
    const card = el('div', '', 'mp-card');
    card.append(el('h2', '순위'), list);
    if (host) {
      card.append(
        button(
          '다시 출발하기',
          () => {
            hooks.onGesture();
            startRace();
          },
          'mp-main',
        ),
        button('대기실로', () => backToWait(pickedMap)),
      );
    } else {
      card.append(el('p', '방장이 다음 경주를 정할 때까지 기다려 주세요.', 'mp-note'));
    }
    card.append(button('방 나가기', () => void leave()));
    show('results', card);
  }

  return {
    inRoom: () => room !== null,
    leave: () => void leave(),
    blocksInput: () => panel === 'menu' || panel === 'room',
    remotes(now) {
      if (!room || !race) return [];
      const id = race.id;
      return room
        .peers()
        .filter((peer) => peer.kind === 'viewer' && !peer.sameTab)
        .map((peer) => ({ peer, racer: readRacer(peer.peer, peer.presence) }))
        .filter(({ racer }) => racer.race === id && racer.done === null && !racer.out)
        .map(({ peer, racer }) => ({
          name: racer.name,
          z: extrapolate(racer.z, racer.speed, now - peer.updatedAt),
          x: racer.x,
          boost: racer.boost ? 1 : 0,
          color: colorOf(peer.peer),
          ghost: true,
        }));
    },
    standing(local) {
      if (!room || !race) return null;
      const id = race.id;
      const field = [
        ...others()
          .filter((racer) => racer.race === id)
          .map((racer) => ({ me: false, z: racer.z, done: racer.done, out: racer.out })),
        { me: true, z: local.z, done: local.done, out: local.out },
      ];
      const ranked = standings(field);
      return { rank: ranked.findIndex((entry) => entry.me) + 1, total: ranked.length };
    },
    update(local, titleShown) {
      openButton.hidden = !titleShown || room !== null || panel !== 'closed';
      if (!room || !race || !local) return;
      const now = Date.now();
      const finished = local.done !== null || local.out;
      // 경주를 마친 순간에는 바로 알리고, 그 뒤로는 다른 때처럼 간격을 둡니다.
      if (now - lastSent >= SEND_INTERVAL || (finished && !sentFinish)) {
        lastSent = now;
        sentFinish = finished;
        send({
          z: Math.round(local.z),
          x: Math.round(local.x * 1000) / 1000,
          speed: Math.round(local.speed),
          boost: local.boost,
          done: local.done,
          out: local.out,
        });
      }
      if (finished && (panel === 'closed' || (panel === 'results' && now - lastResults > 500))) {
        lastResults = now;
        showResults();
      }
    },
  };
}
