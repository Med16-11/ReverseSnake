export let snakes = []; // array of snake objects, each has segments[]

export function createSnake(x,y,length=6){
  const segs = [];
  for(let i=0;i<length;i++){
    segs.push({ x: x - i*16, y: y + (Math.random()*6-3) });
  }
  return { segments: segs, baseSpeed: 70, aggro: 0.18, predictT: 0.34 };
}

export function resetSnakes(canvas){
  snakes = [ createSnake(canvas.width*0.3, canvas.height*0.5, 6) ];
}

function dist(a,b){ return Math.hypot(a.x-b.x, a.y-b.y); }

export function updateSnakes(dt, player, level, canvas){
  // difficulty scaling
  const extraSnakes = Math.floor(level / 6); // spawn extra snakes every 6 levels
  while(snakes.length < 1 + extraSnakes){
    const x = Math.random() * canvas.width * 0.6 + 20;
    const y = Math.random() * canvas.height * 0.9 + 10;
    snakes.push(createSnake(x,y,6 + Math.floor(level/3)));
  }

  // scale attributes by level
  snakes.forEach((s, idx) => {
    const head = s.segments[0];
    const speed = s.baseSpeed * (1 + (level - 1) * 0.12 + idx*0.05);
    const predictT = Math.max(0.08, s.predictT - (level - 1) * 0.015);
    const aggro = Math.min(0.36, s.aggro + (level - 1) * 0.01);

    // predictive pursuit target
    const targetX = player.x + player.vx * predictT;
    const targetY = player.y + player.vy * predictT;
    let dx = targetX - head.x, dy = targetY - head.y;
    const len = Math.hypot(dx,dy) || 1;
    dx /= len; dy /= len;

    head.x += dx * speed * dt;
    head.y += dy * speed * dt;

    // keep in bounds
    head.x = Math.max(12, Math.min(canvas.width-12, head.x));
    head.y = Math.max(12, Math.min(canvas.height-12, head.y));

    // move segments to follow previous
    for(let i=1;i<s.segments.length;i++){
      const prev = s.segments[i-1];
      const seg = s.segments[i];

      seg.x += (prev.x - seg.x) * aggro;
      seg.y += (prev.y - seg.y) * aggro;
    }

    // natural growth occasionally
    if (Math.random() < 0.002 + level*0.0006) {
      const tail = s.segments[s.segments.length - 1];
      s.segments.push({ x: tail.x - 6, y: tail.y + 2 });
    }
  });
}
