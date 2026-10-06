import { formatKm, formatTime } from './format';
import { SEGMENT_LENGTH, START_Z } from './game/constants';
import { MAPS } from './game/maps';
import { css } from './game/themes';
import { buildTrack } from './game/track';
import type { Track } from './game/types';
import { drawCourse } from './render/minimap';
import { RIVAL_COLORS } from './render/sprites';
import {
  cleanName,
  extrapolate,
  makeRoomCode,
  parseRoomCode,
  pickHost,
  MAX_PLAYERS,
  readRacer,
  readiness,
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
.mp-card.mp-room{width:min(880px,100%);gap:16px}
.mp-room-head{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap}
.mp-room-head .mp-code{font-size:40px}
.mp-room-body{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.35fr);gap:16px}
@media (max-width:720px){.mp-room-body{grid-template-columns:minmax(0,1fr)}}
.mp-panel{background:#0b1024;border:1px solid #2b3566;border-radius:12px;padding:14px;display:flex;flex-direction:column;gap:10px;min-width:0}
.mp-map-picker{display:flex;align-items:center;gap:10px}
.mp-map-picker canvas{flex:1;min-width:0;width:100%;max-width:180px;aspect-ratio:1;margin:0 auto;display:block}
.mp-map-picker button{font-size:20px;padding:14px 12px}
.mp-map-name{margin:0;font-size:22px;font-weight:700;text-align:center}
.mp-map-stars{margin:0;text-align:center;color:#ffe066;letter-spacing:.1em}
.mp-map-route{margin:0;text-align:center;color:#9aa6d6;font-size:13px}
.mp-slots{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
@media (max-width:420px){.mp-slots{grid-template-columns:minmax(0,1fr)}}
.mp-slot{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;background:#141a33;border:1px solid #2b3566;min-height:56px}
.mp-slot.mp-me{border-color:#ffe066}
.mp-slot.mp-empty{background:transparent;border-style:dashed;color:#5d6896;justify-content:center;font-size:14px}
.mp-swatch{width:14px;height:34px;border-radius:4px;flex:none}
.mp-slot-text{display:flex;flex-direction:column;min-width:0;flex:1}
.mp-slot-name{font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mp-slot-tag{font-size:12px;color:#9aa6d6}
.mp-badge{flex:none;font-size:12px;font-weight:700;padding:4px 8px;border-radius:999px;background:#1f2850;color:#9aa6d6;letter-spacing:.04em}
.mp-badge.mp-on{background:#2f9e44;color:#fff}
.mp-badge.mp-host{background:#ffe066;color:#141a33}
.mp-room-foot{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.mp-room-foot .mp-note{flex:1;min-width:200px}
.mp-room-foot .mp-main{min-width:180px;padding:15px 18px;font-size:17px}
.mp-card button.mp-ready{background:#2f9e44;border-color:#2f9e44;color:#fff}
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
  // 대기실에서는 Enter로 준비하거나 시작하고, 방장은 ← →로 맵을 바꿉니다.
  window.addEventListener('keydown', (event) => {
    if (panel !== 'room' || event.repeat || event.target instanceof HTMLInputElement) return;
    // 버튼에 초점이 있으면 Enter는 그 버튼을 누르는 것으로 처리되므로 여기서는 맵 바꾸기만 받습니다.
    if ((event.code === 'Enter' || event.code === 'NumpadEnter') && !(event.target instanceof HTMLButtonElement)) {
      event.preventDefault();
      primaryAction();
    } else if (event.code === 'ArrowLeft' || event.code === 'ArrowRight') {
      event.preventDefault();
      moveMap(event.code === 'ArrowLeft' ? -1 : 1);
    }
  });
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
  /** 대기실에서 내가 준비를 마쳤는지 여부. */
  let myReady = false;
  /** 방장이 마지막으로 고른 맵. 바뀌면 내 화면 뒤의 코스도 바꿉니다. */
  let lastHostMap = -1;
  const previews = new Map<number, Track>();
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
    myReady = false;
    lastHostMap = -1;
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
      ready: false,
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
    // 참가자가 모두 준비해야 시작합니다.
    const all = everyone().map((entry) => entry.racer);
    if (!readiness(all, pickHost(all)).canStart) return;
    const id = Date.now().toString(36);
    const seed = 1 + Math.floor(Math.random() * 0x7fffffff);
    seenRace = id;
    beginRace(id, pickedMap, seed, null);
  }

  function beginRace(id: string, map: number, seed: number, by: string | null): void {
    race = { id, map, seed, by };
    sentFinish = false;
    myReady = false;
    send({
      phase: 'race',
      race: id,
      map,
      seed,
      ready: false,
      z: START_Z,
      x: 0,
      speed: 0,
      boost: false,
      done: null,
      out: false,
    });
    hide();
    hooks.onRaceStart(map, seed);
  }

  function backToWait(map: number): void {
    race = null;
    myReady = false;
    send({ phase: 'wait', race: null, ready: false });
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
      // 대기실에서 방장이 맵을 바꾸면 내 화면 뒤의 코스도 같은 맵으로 바꿉니다.
      if (!race && h.map !== lastHostMap && h.map < MAPS.length) {
        lastHostMap = h.map;
        hooks.onWait(h.map);
      }
    }
    advertise();
    if (panel === 'room') showRoom();
  }

  function previewOf(map: number): Track {
    let track = previews.get(map);
    if (!track) {
      track = buildTrack(MAPS[map]);
      previews.set(map, track);
    }
    return track;
  }

  function moveMap(direction: number): void {
    if (!isHost()) return;
    pickedMap = (pickedMap + direction + MAPS.length) % MAPS.length;
    send({ map: pickedMap });
    hooks.onWait(pickedMap);
    showRoom();
  }

  function toggleReady(): void {
    myReady = !myReady;
    send({ ready: myReady });
    showRoom();
  }

  /** 대기실의 주 버튼. 방장은 시작하고, 참가자는 준비하거나 준비를 풉니다. */
  function primaryAction(): void {
    hooks.onGesture();
    if (isHost()) startRace();
    else toggleReady();
  }

  /** 실제 게임의 대기실처럼, 방 코드와 초대, 맵 고르기, 참가자 자리와 준비 상태를 한 화면에 보여 줍니다. */
  function showRoom(): void {
    if (!room || !code) return;
    const host = isHost();
    const all = everyone();
    const hostPeer = pickHost(all.map((entry) => entry.racer));
    const hostEntry = all.find((entry) => entry.racer.peer === hostPeer);
    const map = host ? pickedMap : Math.min(MAPS.length - 1, hostEntry?.racer.map ?? 0);
    const state = readiness(
      all.map((entry) => ({ peer: entry.racer.peer, ready: entry.me ? myReady : entry.racer.ready })),
      hostPeer,
    );
    const roster = all.map((entry) => [entry.racer.peer, entry.racer.name, entry.me, entry.racer.ready]);
    if (unchanged('room', JSON.stringify([code, host, map, hostPeer, roster, myReady]))) return;

    const card = el('div', '', 'mp-card mp-room');

    // 위쪽: 방 코드와 초대
    const head = el('div', '', 'mp-room-head');
    const codeBox = el('div');
    codeBox.append(el('h3', '방 코드'), el('div', code.toUpperCase(), 'mp-code'));
    const link = `${inviteBase}#${code}`;
    const invite = el('div', '', 'mp-row');
    invite.style.flex = '1';
    invite.style.minWidth = '260px';
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
    invite.append(linkInput, copy);
    head.append(codeBox, invite);
    card.append(head);

    const body = el('div', '', 'mp-room-body');

    // 왼쪽: 맵 고르기
    const mapPanel = el('section', '', 'mp-panel');
    mapPanel.append(el('h3', host ? '맵 고르기' : '맵'));
    const picker = el('div', '', 'mp-map-picker');
    const preview = el('canvas');
    preview.width = 180;
    preview.height = 180;
    preview.setAttribute('aria-label', `${MAPS[map].name} 코스 모양`);
    const pctx = preview.getContext('2d');
    if (pctx) drawCourse(pctx, previewOf(map), 0, 0, 180, START_Z);
    if (host) {
      const prev = button('◀', () => moveMap(-1));
      const next = button('▶', () => moveMap(1));
      prev.setAttribute('aria-label', '이전 맵');
      next.setAttribute('aria-label', '다음 맵');
      picker.append(prev, preview, next);
    } else {
      picker.append(preview);
    }
    mapPanel.append(
      picker,
      el('p', MAPS[map].name, 'mp-map-name'),
      el('p', stars(MAPS[map].difficulty), 'mp-map-stars'),
      el('p', MAPS[map].sections.map((section) => section.theme.name).join(' → '), 'mp-map-route'),
      el('p', host ? '← → 키나 화살표 버튼으로 맵을 바꿀 수 있어요.' : '방장이 맵을 고르고 있어요.', 'mp-note'),
    );

    // 오른쪽: 참가자 자리
    const slotPanel = el('section', '', 'mp-panel');
    slotPanel.append(el('h3', `참가자 ${all.length}/${MAX_PLAYERS}`));
    const slots = el('div', '', 'mp-slots');
    for (const entry of all) {
      const isHostSlot = entry.racer.peer === hostPeer;
      const ready = entry.me ? myReady : entry.racer.ready;
      const slot = el('div', '', `mp-slot${entry.me ? ' mp-me' : ''}`);
      const swatch = el('span', '', 'mp-swatch');
      swatch.style.background = css(RIVAL_COLORS[colorOf(entry.racer.peer) % RIVAL_COLORS.length]);
      const text = el('div', '', 'mp-slot-text');
      text.append(
        el('span', entry.me ? name : entry.racer.name, 'mp-slot-name'),
        el('span', entry.me ? '나' : '', 'mp-slot-tag'),
      );
      const badge = isHostSlot
        ? el('span', '방장', 'mp-badge mp-host')
        : el('span', ready ? '준비 완료' : '준비 중', `mp-badge${ready ? ' mp-on' : ''}`);
      slot.append(swatch, text, badge);
      slots.append(slot);
    }
    for (let i = all.length; i < MAX_PLAYERS; i++) slots.append(el('div', '초대 대기 중', 'mp-slot mp-empty'));
    slotPanel.append(slots);

    body.append(mapPanel, slotPanel);
    card.append(body);

    // 아래쪽: 준비와 시작
    const foot = el('div', '', 'mp-room-foot');
    let status: string;
    let main: HTMLButtonElement;
    if (host) {
      status =
        state.needed === 0
          ? '혼자서도 시작할 수 있어요. 초대 링크를 보내 친구를 불러 보세요.'
          : state.canStart
            ? '모두 준비됐어요. 시작하기를 누르세요.'
            : `참가자가 모두 준비하면 시작할 수 있어요 (${state.ready}/${state.needed} 준비).`;
      main = button('시작하기', primaryAction, 'mp-main');
      main.disabled = !state.canStart;
    } else {
      status = myReady ? '준비 완료! 방장이 시작하기를 기다려요.' : '준비하기를 누르면 방장이 시작할 수 있어요.';
      main = button(myReady ? '준비 취소' : '준비하기', primaryAction, myReady ? 'mp-ready' : 'mp-main');
    }
    foot.append(
      el('p', status, 'mp-note'),
      button('방 나가기', () => void leave()),
      main,
    );
    card.append(foot);

    show('room', card);
    main.focus({ preventScroll: true });
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
