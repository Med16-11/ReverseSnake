export const player = {
  x: 0, y: 0,
  vx: 0, vy: 0,
  speed: 220,
  radius: 8
};

const keys = {};
function keyName(k){ return (k || '').toString().toLowerCase(); }

window.addEventListener('keydown', e => {
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) {
    e.preventDefault();
  }
  keys[keyName(e.key)] = true;
});
window.addEventListener('keyup', e => { keys[keyName(e.key)] = false; });

export function resetPlayer(canvas){
  player.x = canvas.width * 0.7;
  player.y = canvas.height * 0.5;
  player.vx = 0; player.vy = 0;
}

export function updatePlayer(dt, canvas){
  let dx = 0, dy = 0;

  // keyboard input (existing)
  if (keys['w'] || keys['arrowup']) dy = -1;
  if (keys['s'] || keys['arrowdown']) dy = 1;
  if (keys['a'] || keys['arrowleft']) dx = -1;
  if (keys['d'] || keys['arrowright']) dx = 1;

  // touch input (press-and-hold from on-screen D-pad)
  const ti = (window.touchInput || {});
  if (ti.up) dy = -1;
  if (ti.down) dy = 1;
  if (ti.left) dx = -1;
  if (ti.right) dx = 1;

  // if both keyboard and touch pressed, combine naturally
  const len = Math.hypot(dx, dy);
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

  // clamp
  player.x = Math.max(player.radius, Math.min(canvas.width - player.radius, player.x));
  player.y = Math.max(player.radius, Math.min(canvas.height - player.radius, player.y));
}

