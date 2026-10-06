import type { Input } from './game/types';

const KEYS: Record<string, keyof Input> = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowUp: 'accel',
  KeyW: 'accel',
  ArrowDown: 'brake',
  KeyS: 'brake',
  Space: 'nitro',
  ShiftLeft: 'drift',
  ShiftRight: 'drift',
};

export interface InputHandlers {
  onStart(): void;
  onMute(): void;
  /** 좌우 키를 새로 눌렀을 때 호출합니다. 왼쪽이 -1, 오른쪽이 1입니다. */
  onSelect(direction: -1 | 1): void;
  onBack(): void;
}

/** 키 입력을 추적하고, 현재 입력 상태를 반환하는 함수를 돌려줍니다. */
export function createInput(target: Window, handlers: InputHandlers): () => Input {
  const state: Input = {
    left: false,
    right: false,
    accel: false,
    brake: false,
    nitro: false,
    drift: false,
  };

  target.addEventListener('keydown', (event) => {
    // 닉네임이나 방 코드를 입력하거나 방 창의 버튼에 초점이 있을 때는 게임 키로 쓰지 않습니다.
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLButtonElement) return;
    const mapped = KEYS[event.code];
    if (mapped) {
      state[mapped] = true;
      event.preventDefault();
      if (!event.repeat && mapped === 'left') handlers.onSelect(-1);
      else if (!event.repeat && mapped === 'right') handlers.onSelect(1);
      return;
    }
    if (event.repeat) return;
    if (event.code === 'Enter' || event.code === 'NumpadEnter') handlers.onStart();
    else if (event.code === 'KeyM') handlers.onMute();
    else if (event.code === 'Escape') handlers.onBack();
  });

  target.addEventListener('keyup', (event) => {
    if (event.target instanceof HTMLInputElement) return;
    const mapped = KEYS[event.code];
    if (mapped) state[mapped] = false;
  });

  // 창이 포커스를 잃으면 keyup을 받지 못하므로 모든 키를 뗀 상태로 되돌립니다.
  target.addEventListener('blur', () => {
    state.left = state.right = state.accel = state.brake = state.nitro = state.drift = false;
  });

  return () => ({ ...state });
}
