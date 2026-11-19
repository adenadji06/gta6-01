// Harbor Heat — keyboard + mouse input (WASD/arrows drive & walk, E enter/exit,
// R restock at the safehouse, P pause, M mute, mouse aim + click to shoot).
export function createInput(canvas) {
  const keys = new Set();
  const pressedSet = new Set();
  const state = {
    keys,
    mouse: { x: 0, y: 0, down: false, clicked: false },
    anyKey: false,
  };

  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (!e.repeat) { state.anyKey = true; pressedSet.add(e.code); }
    keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    state.mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
    state.mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) { state.mouse.down = true; state.mouse.clicked = true; }
  });
  window.addEventListener('mouseup', () => { state.mouse.down = false; });

  state.axis = function () {
    let x = 0; let y = 0;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
    return { x, y };
  };
  state.pressed = function (code) {
    if (pressedSet.has(code)) { pressedSet.delete(code); return true; }
    return false;
  };
  state.consumeClick = function () {
    const c = state.mouse.clicked;
    state.mouse.clicked = false;
    return c;
  };
  return state;
}
