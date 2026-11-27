// Keyboard, mouse and touch input, read as a plain state object each frame.
// Arrow keys / WASD fly the plane; Space is the action key (drop parcel, confirm);
// P or Escape pauses; Enter or click confirms on menus.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_DROP = 4;

const KEYMAP = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowUp: 'climb',
  KeyW: 'climb',
  ArrowDown: 'descend',
  KeyS: 'descend',
  ShiftLeft: 'throttleUp',
  ShiftRight: 'throttleUp',
  KeyE: 'throttleUp',
  ControlLeft: 'throttleDown',
  KeyQ: 'throttleDown',
  Space: 'drop',
  Enter: 'confirm',
  KeyP: 'pause',
  Escape: 'pause',
};

export function createInput(canvas) {
  const held = {
    left: false,
    right: false,
    climb: false,
    descend: false,
    throttleUp: false,
    throttleDown: false,
  };
  let actions = 0;
  /** Pointer steering: -1..1 across the canvas while the pointer is down. */
  let pointerSteer = 0;
  let pointerDown = false;

  function onKeyDown(event) {
    const name = KEYMAP[event.code];
    if (!name) return;
    if (name === 'drop') {
      if (!event.repeat) actions |= ACTION_DROP;
      event.preventDefault();
      return;
    }
    if (name === 'confirm') {
      if (!event.repeat) actions |= ACTION_CONFIRM;
      event.preventDefault();
      return;
    }
    if (name === 'pause') {
      if (!event.repeat) actions |= ACTION_PAUSE;
      event.preventDefault();
      return;
    }
    held[name] = true;
    if (name === 'left' || name === 'right' || name === 'climb' || name === 'descend') event.preventDefault();
  }

  function onKeyUp(event) {
    const name = KEYMAP[event.code];
    if (name && name in held) held[name] = false;
  }

  function steerFromEvent(event) {
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) / Math.max(1, rect.width);
    pointerSteer = Math.max(-1, Math.min(1, (x - 0.5) * 2));
  }

  function onPointerDown(event) {
    pointerDown = true;
    steerFromEvent(event);
    actions |= ACTION_CONFIRM;
  }
  function onPointerMove(event) {
    if (pointerDown) steerFromEvent(event);
  }
  function onPointerUp() {
    pointerDown = false;
    pointerSteer = 0;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    /** -1 (bank left) .. 1 (bank right), from keys or pointer. */
    steer() {
      if (pointerDown && pointerSteer !== 0) return pointerSteer;
      if (held.left && !held.right) return -1;
      if (held.right && !held.left) return 1;
      return 0;
    },
    /** -1 (descend) .. 1 (climb). */
    pitch() {
      if (held.climb && !held.descend) return 1;
      if (held.descend && !held.climb) return -1;
      return 0;
    },
    /** -1 (throttle down) .. 1 (throttle up). */
    throttle() {
      if (held.throttleUp && !held.throttleDown) return 1;
      if (held.throttleDown && !held.throttleUp) return -1;
      return 0;
    },
    /** Actions pressed since the last read; reading clears them. */
    takeActions() {
      const value = actions;
      actions = 0;
      return value;
    },
  };
}
