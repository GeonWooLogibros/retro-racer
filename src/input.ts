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
};

export interface InputHandlers {
  onStart(): void;
  onMute(): void;
}

/** 키 입력을 추적하고, 현재 입력 상태를 반환하는 함수를 돌려줍니다. */
export function createInput(target: Window, handlers: InputHandlers): () => Input {
  const state: Input = { left: false, right: false, accel: false, brake: false, nitro: false };

  target.addEventListener('keydown', (event) => {
    const mapped = KEYS[event.code];
    if (mapped) {
      state[mapped] = true;
      event.preventDefault();
      return;
    }
    if (event.repeat) return;
    if (event.code === 'Enter' || event.code === 'NumpadEnter') handlers.onStart();
    else if (event.code === 'KeyM') handlers.onMute();
  });

  target.addEventListener('keyup', (event) => {
    const mapped = KEYS[event.code];
    if (mapped) state[mapped] = false;
  });

  // 창이 포커스를 잃으면 keyup을 받지 못하므로 모든 키를 뗀 상태로 되돌립니다.
  target.addEventListener('blur', () => {
    state.left = state.right = state.accel = state.brake = state.nitro = false;
  });

  return () => ({ ...state });
}
