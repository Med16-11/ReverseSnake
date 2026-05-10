# ReverseSnake

ReverseSnake flips the classic Snake premise on its head. Instead of *being* the snake and eating food, **you are the food** — a small dot trying to survive against one or more snakes that hunt you down. The longer you survive, the higher your score, and the harder the game gets.

It's built entirely with vanilla JavaScript and HTML5 Canvas, bundled with Vite, and wrapped in a React shell for the UI. There's no game engine library — everything from rendering to physics to collision detection is written from scratch.

---

## Project Structure

```
src/
├── game/
│   ├── engine.js    ← Game loop, scoring, level management, rendering
│   ├── snake.js     ← Enemy snake logic and movement
│   └── player.js    ← Player movement and input handling
├── main.js          ← UI wiring, touch controls, service worker
├── App.jsx          ← React shell
└── style.css        ← Styling
```

---

## The Game Loop

The heartbeat of any real-time game is the **game loop**, a function that runs continuously, updating state and redrawing the screen many times per second.

```js
function loop(now) {
  if (!running || paused) return;
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  update(dt);
  render();

  requestAnimationFrame(loop);
}
```

### What's happening here:

**`requestAnimationFrame(loop)`** — This is the browser's built-in mechanism for smooth animation. It calls `loop` before the next screen repaint, typically 60 times per second. Crucially, it syncs with the monitor's refresh rate and pauses when the tab is in the background, saving battery.

**Delta time (`dt`)** — Rather than moving things by a fixed number of pixels per frame, the game calculates how many *seconds* have passed since the last frame and multiplies all movement by that value. This is called **delta-time-based movement**.

Why does it matter? Without it, the game would run faster on a 144Hz monitor than on a 60Hz one. With `dt`, a snake moving at 70 units/second will travel the same distance regardless of frame rate.

**`Math.min(0.05, ...)`** — This caps `dt` at 50ms. If the tab freezes for a second (say, due to garbage collection), without this cap, everything would teleport. The cap prevents those huge jumps.

---

## Player Movement

The player is a dot that moves around the canvas using keyboard arrow keys or WASD, plus an on-screen D-pad for mobile.

```js
export const player = {
  x: 0, y: 0,
  vx: 0, vy: 0,
  speed: 220,
  radius: 8
};
```

The player has a **velocity** (`vx`, `vy`) rather than just a position. This gives movement a natural "feel" with momentum:

```js
if (len > 0) {
  dx /= len; dy /= len;
  player.vx = dx * player.speed;
  player.vy = dy * player.speed;
} else {
  player.vx *= 0.86;
  player.vy *= 0.86;
}
player.x += player.vx * dt;
player.y += player.vy * dt;
```

---

## Enemy Snake Logic

This is the most interesting part of the codebase. Each snake is an array of segments, where the head (index 0) actively chases the player, and the body segments follow behind.

```js
function createSnake(x, y, length = 6) {
  const segs = [];
  for (let i = 0; i < length; i++) {
    segs.push({ x: x - i * 16, y: y + (Math.random() * 6 - 3) });
  }
  return { segments: segs, baseSpeed: 70, aggro: 0.18, predictT: 0.34 };
}
```

A snake is just an object with:
- `segments` — array of `{x, y}` points, index 0 is the head
- `baseSpeed` — how fast the head moves
- `aggro` — how tightly the body follows the head
- `predictT` — how many seconds ahead the snake tries to predict the player's position

### Predictive Pursuit

This is the core of the enemy "intelligence." Most naive chase algorithms just move toward the player's *current* position. This snake instead aims at where the player will *be* in the near future:

```js
const targetX = player.x + player.vx * predictT;
const targetY = player.y + player.vy * predictT;
let dx = targetX - head.x, dy = targetY - head.y;
const len = Math.hypot(dx, dy) || 1;
dx /= len; dy /= len;

head.x += dx * speed * dt;
head.y += dy * speed * dt;
```

**How it works:** The snake takes the player's current velocity and projects it forward by `predictT` seconds (initially 0.34s). This gives an intercept point ahead of the player. The snake's head then moves toward *that* point instead of the player's feet.

The effect is that the snake "cuts you off" rather than trailing behind you, making it feel far more threatening than a basic chaser.

### Body Following (Chain Physics)

After the head moves, each body segment catches up to the one in front of it:

```js
for (let i = 1; i < s.segments.length; i++) {
  const prev = s.segments[i - 1];
  const seg = s.segments[i];
  seg.x += (prev.x - seg.x) * aggro;
  seg.y += (prev.y - seg.y) * aggro;
}
```

This is a simple **spring/lerp (linear interpolation)** system. Each segment moves a fraction (`aggro = 0.18`) of the distance toward the segment ahead of it per frame. The result is a smooth, fluid snake tail that flows naturally without any complex rope physics.

### Natural Growth

Occasionally, snakes grow a segment longer on their own:

```js
if (Math.random() < 0.002 + level * 0.0006) {
  const tail = s.segments[s.segments.length - 1];
  s.segments.push({ x: tail.x - 6, y: tail.y + 2 });
}
```

This is checked every frame, giving a small random probability of growing. Higher levels increase that probability, so snakes grow faster as the game progresses.

---

## Difficulty Scaling

The game gets harder through several levers that all scale with `level`:

| Parameter | Effect | Formula |
|---|---|---|
| Speed | Snake head moves faster | `baseSpeed * (1 + (level - 1) * 0.12)` |
| Prediction | Snake anticipates farther ahead | `predictT - (level - 1) * 0.015` (decreasing, more precise) |
| Aggression | Body follows head tighter | `Math.min(0.36, aggro + (level - 1) * 0.01)` |
| Snake count | More snakes spawn | `1 + Math.floor(level / 6)` |
| Body length | New snakes are longer | `6 + Math.floor(level / 3)` segments |
| Growth rate | Snakes grow faster | `0.002 + level * 0.0006` per frame |

Each level lasts 20 seconds (`LEVEL_DURATION = 20`). On level-up, the player gets a 60-point bonus and teleports reset to 3.

---

## Collision Detection

The game uses **circle-based collision detection** — the simplest and most performant form for this type of game. Both the player and the snake's head are treated as circles.

```js
for (const s of snakes) {
  const head = s.segments[0];
  if (Math.hypot(head.x - player.x, head.y - player.y) < 16 + player.radius) {
    running = false;
    showGameOver();
    return;
  }
}
```

`Math.hypot` computes the Euclidean distance between the two centers. If that distance is less than the sum of their radii (snake head radius ≈ 12, player radius = 8, so threshold = ~20), a collision is detected and the game ends.

This runs every frame during `update(dt)`, but only if the invincibility timer is at zero.

---

## The Teleport & Invincibility System

The teleport is a strategic escape mechanic. You get 3 per level, and each one:

1. Tries up to 30 random positions to find one that's at least 70 units away from any snake segment
2. Places the player there instantly
3. Deducts 6 points as a cost
4. Triggers a **0.6-second invincibility window**

```js
invincibleTimer = seconds;
// in update():
if (invincibleTimer > 0) {
  invincibleTimer = Math.max(0, invincibleTimer - dt);
}
// collision check only runs when:
if (invincibleTimer <= 0) { /* check collision */ }
```

The invincibility timer counts down using delta time, making it frame-rate independent. While active, the player visually pulses with a flicker effect rendered on the canvas.

**Revive mechanic:** If you've already died but still have teleports left, clicking teleport acts as a revive — spawning you at a random position with a 1-second invincibility window, at a cost of 12 points.

---

## Rendering

The renderer runs every frame and redraws the entire canvas from scratch (no partial updates). The order matters, things drawn later appear on top.

```
1. Background fill (#071027 dark navy)
2. Faint grid lines (rgba white at 2% opacity)
3. Snake bodies (tail → head, gradient from green to red at head)
4. Player dot (gold #ffd166)
5. Invincibility pulse glow (if active)
```

### Snake Color Gradient

Each segment is colored based on its position along the snake's length using a parameter `t` (0 = head, 1 = tail):

```js
const t = i / Math.max(1, s.segments.length - 1);
ctx.fillStyle = (i === 0)
  ? 'rgb(239,71,111)'  // bright red-pink head
  : `rgba(${Math.floor(40 + 140 * (1-t))}, ${Math.floor(60 + 150 * t)}, ${Math.floor(30 + 40*(1-t))}, 1)`;
```

The head is always red-pink. The body blends from a brighter red near the head toward a darker green near the tail. This is done by linearly interpolating each RGB channel as a function of `t`.

### Segment Size Taper

Segments also shrink toward the tail:

```js
const r = 12 - (t * 6); // head radius=12, tail radius=6
```

Combined with the color gradient, this gives the snake a realistic tapered appearance without any complex geometry.

---

## Scoring

Score accumulates passively over time:

```js
score += dt * 12; // ~12 points per second
```

Because it's multiplied by `dt`, faster or slower machines accumulate score at the same real-world rate. Bonuses and penalties:

- **+60** on leveling up
- **−6** per teleport used
- **−12** per revive used
- Score floored at 0 (can't go negative)

The best score is persisted to `localStorage`, so it survives page refreshes.

---

##  Mobile Support

Touch controls are implemented two ways, with the more robust press-and-hold system taking precedence:

```js
window.touchInput = { up: false, down: false, left: false, right: false };

function wireDpadButton(elId, keyName) {
  el.addEventListener('pointerdown', e => { e.preventDefault(); setTouch(keyName, true); });
  el.addEventListener('pointerup',   e => { e.preventDefault(); setTouch(keyName, false); });
  el.addEventListener('pointercancel', e => { setTouch(keyName, false); });
  el.addEventListener('pointerleave',  e => { setTouch(keyName, false); });
}
```

The `pointerleave` and `pointercancel` listeners are critical — they prevent the "stuck key" bug where lifting your finger off the edge of a button would leave the direction held indefinitely. The player update reads `window.touchInput` alongside keyboard state, so both work simultaneously.

---

## PWA & Offline Support

A service worker (`public/sw.js`) is registered at startup:

```js
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js');
  });
}
```

This makes the game installable as a Progressive Web App (PWA) and enables offline play after the first load — the service worker caches assets so the game works without an internet connection.

---

## Shareable Game State URLs

At any point, the current level and score are encoded into the URL as query parameters:

```js
export function getShareLinkFromState() {
  const url = new URL(window.location.href);
  url.searchParams.set('level', String(level));
  url.searchParams.set('score', String(Math.floor(score)));
  return url.toString();
}
```

When someone opens a shared link, `loadSharedDataIfPresent()` reads those params on load and shows a level popup. This is a lightweight social feature with zero backend — all state lives in the URL itself.

---


What makes ReverseSnake technically interesting isn't any single system,it's how all these small, well-chosen techniques combine into a smooth, responsive, progressively challenging game built entirely from first principles.

<img width="3410" height="1742" alt="Pasted Graphic" src="https://github.com/user-attachments/assets/fb9755f5-6722-4ee8-951b-c7047ee3f93e" />
