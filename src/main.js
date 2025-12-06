import { startGame, teleport, togglePause, getShareLinkFromState, loadSharedDataIfPresent } from './game/engine.js';

const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const teleBtn = document.getElementById('teleBtn');
const copyBtn = document.getElementById('copyBtn');
const openShareBtn = document.getElementById('openShareBtn');
const shareInput = document.getElementById('shareInput');
const popupShareBtn = document.getElementById('popupShareBtn');

startBtn.onclick = () => startGame();
pauseBtn.onclick = () => togglePause();
teleBtn.onclick = () => teleport();

// copy current share link
copyBtn.onclick = async () => {
  try {
    const link = getShareLinkFromState();
    await navigator.clipboard.writeText(link);
    copyBtn.textContent = 'Copied ✓';
    setTimeout(() => (copyBtn.textContent = 'Copy link'), 1500);
  } catch (e) {
    console.warn('copy failed', e);
  }
};

// open the current share link in new tab
openShareBtn.onclick = () => {
  const link = getShareLinkFromState();
  window.open(link, '_blank');
};

// popup share
popupShareBtn.onclick = async () => {
  const link = getShareLinkFromState();
  try {
    await navigator.clipboard.writeText(link);
    popupShareBtn.textContent = 'Copied ✓';
    setTimeout(()=> popupShareBtn.textContent = 'Share Level', 1500);
  } catch(e){
    console.warn(e);
  }
};

// keep share input updated periodically
setInterval(() => {
  try {
    shareInput.value = getShareLinkFromState();
  } catch {}
}, 400);

// If page opened with a shared link (query params), load those values into HUD
loadSharedDataIfPresent();

// helpful focus: click to focus canvas for keyboard input
document.querySelector('canvas').addEventListener('click', () => window.focus());

// --- Mobile touch mapping (add to src/main.js) ---
function emitKeyEvent(key, type='keydown'){
  const ev = new KeyboardEvent(type, { key });
  window.dispatchEvent(ev);
}

// map D-Pad buttons
const dpadBtns = document.querySelectorAll('.dpad-btn');
dpadBtns.forEach(btn => {
  const key = btn.dataset.key || btn.getAttribute('data-key');
  btn.addEventListener('pointerdown', (e) => { e.preventDefault(); emitKeyEvent(key, 'keydown'); });
  btn.addEventListener('pointerup',   (e) => { e.preventDefault(); emitKeyEvent(key, 'keyup'); });
  btn.addEventListener('pointerleave',(e) => { e.preventDefault(); emitKeyEvent(key, 'keyup'); });
  btn.addEventListener('lostpointercapture', (e)=> emitKeyEvent(key, 'keyup'));
});

// big teleport button
const bigTele = document.getElementById('bigTeleport');
if (bigTele){
  bigTele.addEventListener('pointerdown', (e) => { e.preventDefault(); document.getElementById('teleBtn').click(); });
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(()=>{/*sw reg failed*/});
  });
}
