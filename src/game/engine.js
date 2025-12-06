import { player, resetPlayer, updatePlayer } from './player.js';
import { snakes, resetSnakes, updateSnakes } from './snake.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function resize(){
  canvas.width = Math.max(600, window.innerWidth - 360);
  canvas.height = window.innerHeight - 60;
}
window.addEventListener('resize', resize);
resize();

// UI elements
const scoreEl = document.getElementById('score');
const levelEl = document.getElementById('level');
const tleftEl = document.getElementById('tleft');
const snakesEl = document.getElementById('snakes');

const levelPopup = document.getElementById('levelPopup');
const popupLevel = document.getElementById('popupLevel');
const popupCloseBtn = document.getElementById('popupCloseBtn');

popupCloseBtn.onclick = () => hideLevelPopup();

let lastTime = 0;
let running = false;
let paused = false;
let score = 0;
let level = 1;
let timeInLevel = 0;
let teleportsLeft = 3;
const TELEPORTS_PER_LEVEL = 3;
const LEVEL_DURATION = 20;

// INVINCIBILITY (used after teleport / revive)
let invincibleTimer = 0;
function startInvincibility(seconds){
  invincibleTimer = seconds;
}

export function startGame(){
  running = true;
  paused = false;
  score = 0;
  level = 1;
  timeInLevel = 0;
  teleportsLeft = TELEPORTS_PER_LEVEL;
  resetPlayer(canvas);
  resetSnakes(canvas);
  lastTime = performance.now();
  invincibleTimer = 0;
  requestAnimationFrame(loop);
}

export function togglePause(){
  if(!running) return;
  paused = !paused;
  const btn = document.getElementById('pauseBtn');
  btn.textContent = paused ? 'Resume' : 'Pause';
  if(!paused){
    lastTime = performance.now();
    requestAnimationFrame(loop);
  }
}

// TELEPORT: updated to allow revive when not running (Option A)
export function teleport(){
  // If game running -> normal teleport behavior (safe spot)
  if (running && !paused) {
    if (teleportsLeft <= 0) return;
    for (let attempt = 0; attempt < 30; attempt++) {
      const p = { x: Math.random()*(canvas.width-60)+30, y: Math.random()*(canvas.height-60)+30 };
      let ok = true;
      for (const s of snakes) {
        for (const seg of s.segments) {
          if (Math.hypot(seg.x - p.x, seg.y - p.y) < 70) { ok = false; break; }
        }
        if (!ok) break;
      }
      if (ok) {
        player.x = p.x; player.y = p.y; player.vx = 0; player.vy = 0;
        teleportsLeft--; score = Math.max(0, score - 6);
        // short invincibility after teleport
        startInvincibility(0.6);
        updateUI();
        return;
      }
    }
    // fallback
    player.x = Math.random()*(canvas.width-60)+30;
    player.y = Math.random()*(canvas.height-60)+30;
    teleportsLeft--; score = Math.max(0, score - 6);
    startInvincibility(0.6);
    updateUI();
    return;
  }

  // If game is NOT running (player died), allow "revive" via teleport if available
  if (!running) {
    if (teleportsLeft <= 0) return; // nothing to do
    // consume one teleport to revive
    teleportsLeft--;
    // revive: reset player position + stop velocities
    player.x = Math.random()*(canvas.width-160)+80;
    player.y = Math.random()*(canvas.height-160)+80;
    player.vx = 0; player.vy = 0;
    score = Math.max(0, score - 12); // optional penalty for reviving
    // resume game
    running = true;
    paused = false;
    lastTime = performance.now();
    // give a short invincibility window so you don't die instantly
    startInvincibility(1.0);
    updateUI();
    requestAnimationFrame(loop);
    return;
  }
}

function loop(now){
  if(!running || paused) return;
  const dt = Math.min(0.05, (now - lastTime)/1000);
  lastTime = now;

  update(dt);
  render();

  requestAnimationFrame(loop);
}

function update(dt){
  timeInLevel += dt;

  // decrement invincibility timer
  if (invincibleTimer > 0) {
    invincibleTimer = Math.max(0, invincibleTimer - dt);
  }

  updatePlayer(dt, canvas);
  updateSnakes(dt, player, level, canvas);

  // collision detection (respect invincibility)
  if (invincibleTimer <= 0) {
    for(const s of snakes){
      const head = s.segments[0];
      if (Math.hypot(head.x - player.x, head.y - player.y) < 16 + player.radius) {
        // game over
        running = false;
        showGameOver();
        return;
      }
    }
  }

  score += dt * 12;

  // level up triggers: time-based but also increment difficulty per level
  if (timeInLevel >= LEVEL_DURATION){
    timeInLevel = 0;
    levelUp();
  }

  updateUI();
}

function levelUp(){
  level++;
  teleportsLeft = TELEPORTS_PER_LEVEL;
  // small bonus
  score += 60;
  // spawn one extra snake if level high enough handled in snake module
  showLevelPopup(level);
}

function showGameOver(){
  // overlay + reset UI
  ctx.fillStyle = 'rgba(2,6,23,0.7)';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle = '#fff';
  ctx.font = '28px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('Game Over', canvas.width/2, canvas.height/2 - 10);
  ctx.font = '16px system-ui';
  ctx.fillText(`Score: ${Math.floor(score)}  Level: ${level}`, canvas.width/2, canvas.height/2 + 20);

  // save local best
  try {
    const best = Number(localStorage.getItem('best') || 0);
    if(Math.floor(score) > best) localStorage.setItem('best', Math.floor(score));
  } catch {}
}

function updateUI(){
  scoreEl.textContent = Math.floor(score);
  levelEl.textContent = level;
  tleftEl.textContent = teleportsLeft;
  snakesEl.textContent = snakes.length;
}

function render(){
  // background
  ctx.fillStyle = '#071027';
  ctx.fillRect(0,0,canvas.width,canvas.height);

  // faint grid
  const step = 48;
  ctx.strokeStyle = 'rgba(255,255,255,0.02)';
  ctx.lineWidth = 1;
  for(let x=0;x<canvas.width;x+=step){
    ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,canvas.height); ctx.stroke();
  }
  for(let y=0;y<canvas.height;y+=step){
    ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(canvas.width,y); ctx.stroke();
  }

  // snakes (draw tail -> head)
  for(const s of snakes){
    for(let i=s.segments.length-1;i>=0;i--){
      const seg = s.segments[i];
      const t = i / Math.max(1, s.segments.length-1);
      const r = 12 - (t*6);
      ctx.beginPath();
      ctx.fillStyle = (i===0) ? 'rgb(239,71,111)' : `rgba(${Math.floor(40+140*(1-t))},${Math.floor(60+150*t)},${Math.floor(30+40*(1-t))},1)`;
      ctx.arc(seg.x, seg.y, r, 0, Math.PI*2);
      ctx.fill();
    }
  }

  // player (show faint pulse when invincible)
  ctx.fillStyle = '#ffd166';
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius, 0, Math.PI*2);
  ctx.fill();

  if (invincibleTimer > 0) {
    const alpha = 0.12 + 0.12 * Math.sin(invincibleTimer * 30);
    ctx.globalAlpha = alpha;
    ctx.beginPath(); ctx.arc(player.x, player.y, player.radius*3.6, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = 1;
  } else {
    ctx.globalAlpha = 0.14;
    ctx.beginPath(); ctx.arc(player.x, player.y, player.radius*3.6, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function showLevelPopup(n){
  popupLevel.textContent = n;
  levelPopup.classList.remove('hidden');
  // animate show
  requestAnimationFrame(()=> levelPopup.classList.add('show'));
  // hide after a few seconds automatically
  setTimeout(()=> hideLevelPopup(), 4200);
}

// hide popup
function hideLevelPopup(){
  levelPopup.classList.remove('show');
  setTimeout(()=> levelPopup.classList.add('hidden'), 260);
}

// share helpers
export function getShareLinkFromState(){
  const url = new URL(window.location.href);
  url.searchParams.set('level', String(level));
  url.searchParams.set('score', String(Math.floor(score)));
  return url.toString();
}

export function loadSharedDataIfPresent(){
  const params = new URLSearchParams(window.location.search);
  const sharedLevel = params.get('level');
  const sharedScore = params.get('score');
  if(sharedLevel || sharedScore){
    // display shared info in HUD and share input
    const shareInput = document.getElementById('shareInput');
    if (shareInput) shareInput.value = window.location.href;
    // also show a small temporary popup to indicate shared data
    popupLevel.textContent = sharedLevel || '—';
    levelPopup.classList.remove('hidden');
    levelPopup.classList.add('show');
    setTimeout(()=> hideLevelPopup(), 4200);
  }
}

// when popup close clicked, copy link as fallback handled in main.js

// auto-export for tests/debugging
window.__gameAPI = {
  startGame, teleport, togglePause, getShareLinkFromState
};
