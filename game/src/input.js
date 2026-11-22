// Keyboard and mouse input: held keys as a set, one-shot actions consumed per frame,
// and the mouse position in screen and (via the camera) world coordinates.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER_CAR = 4;
export const ACTION_RELOAD = 8;
export const ACTION_MUTE = 16;
export const ACTION_SHOOT = 32;

export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;
  let mouseClicked = false;

  function keyName(event) {
    return event.key.length === 1 ? event.key.toLowerCase() : event.key;
  }

  window.addEventListener('keydown', (event) => {
    const key = keyName(event);
    if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) event.preventDefault();
    if (!keys.has(key)) pressed.add(key);
    keys.add(key);
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(keyName(event));
  });
  window.addEventListener('blur', () => {
    keys.clear();
  });
  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button !== 0) return;
    mouseDown = true;
    mouseClicked = true;
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) mouseDown = false;
  });

  function take(key) {
    if (!pressed.has(key)) return false;
    pressed.delete(key);
    return true;
  }

  return {
    /** -1, 0 or 1 for left/right and up/down from WASD or the arrow keys. */
    axis() {
      const left = keys.has('a') || keys.has('ArrowLeft');
      const right = keys.has('d') || keys.has('ArrowRight');
      const up = keys.has('w') || keys.has('ArrowUp');
      const down = keys.has('s') || keys.has('ArrowDown');
      return {
        x: (right ? 1 : 0) - (left ? 1 : 0),
        y: (down ? 1 : 0) - (up ? 1 : 0),
      };
    },
    get sprint() {
      return keys.has('Shift') || keys.has(' ');
    },
    get mouse() {
      return { x: mouseX, y: mouseY, down: mouseDown, clicked: mouseClicked };
    },
    consumeClick() {
      const clicked = mouseClicked;
      mouseClicked = false;
      return clicked;
    },
    /** One-shot actions since the last call; consuming them here keeps menus snappy. */
    takeActions() {
      let actions = 0;
      if (take('Enter') || take(' ')) actions |= ACTION_CONFIRM;
      if (take('Escape') || take('p') || take('P')) actions |= ACTION_PAUSE;
      if (take('e') || take('E')) actions |= ACTION_ENTER_CAR;
      if (take('r') || take('R')) actions |= ACTION_RELOAD;
      if (take('m') || take('M')) actions |= ACTION_MUTE;
      if (mouseDown) actions |= ACTION_SHOOT;
      return actions;
    },
    clearPressed() {
      pressed.clear();
      mouseClicked = false;
    },
  };
}
