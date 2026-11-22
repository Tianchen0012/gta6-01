// Neon Tide — input.js
// Keyboard + mouse, nothing else. The game reads this one object each
// frame; menus and the game itself never touch DOM events directly.

export function createInput(canvas) {
  const input = {
    keys: new Set(),
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,
    clicked: false, // consumed by whoever handles a click this frame
    pressed: new Set(), // keys pressed since the last frame, cleared each frame
    anyKey: false,
  };

  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    if (!e.repeat) input.pressed.add(e.key.toLowerCase());
    input.keys.add(e.key.toLowerCase());
    input.anyKey = true;
  });
  window.addEventListener('keyup', (e) => input.keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => input.keys.clear());

  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    input.mouseX = (e.clientX - r.left) * (canvas.width / r.width);
    input.mouseY = (e.clientY - r.top) * (canvas.height / r.height);
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      input.mouseDown = true;
      input.clicked = true;
    }
  });
  window.addEventListener('mouseup', () => { input.mouseDown = false; });

  input.down = (key) => input.keys.has(key);
  input.wasPressed = (key) => input.pressed.has(key);
  // WASD or arrow keys, as a -1..1 pair.
  input.move = () => ({
    x: (input.down('d') || input.down('arrowright') ? 1 : 0) - (input.down('a') || input.down('arrowleft') ? 1 : 0),
    y: (input.down('s') || input.down('arrowdown') ? 1 : 0) - (input.down('w') || input.down('arrowup') ? 1 : 0),
  });
  input.endFrame = () => { input.pressed.clear(); input.clicked = false; input.anyKey = false; };

  return input;
}
