/*
  PASTE THIS WHOLE FILE INTO p5.js Web Editor -> sketch.js
  Keep index.html as the default p5 editor file.

  Controls:
  P1: A/Z throttle, X/V rotate, C flip, Space fire
  P2: 8/2 throttle, 4/6 rotate, 5 flip, Enter fire
  0 start/restart, 3 new map, P pause, Esc menu
*/

const W = 640, H = 480;
const WATER = 427, HUD_TOP = WATER + 3;
const VIEW_W = 316, RIGHT_X = 323, CENTER_X = 158;
const MAP_SIZE = 90, MAP_STEP = 50;
const HELI_RATIO = 2;
const K10 = 10 / HELI_RATIO, K15 = 15 / HELI_RATIO, K20 = 20 / HELI_RATIO;
const K7 = 7 / HELI_RATIO, K17 = 17 / HELI_RATIO, K23 = 23 / HELI_RATIO;
const K25 = 25 / HELI_RATIO, K40 = 40 / HELI_RATIO;
// Pascal-style physics, but with a stronger acceleration scale for p5.js.
// Original Pascal used SCALE_ACCEL = 50000; that is too weak in browser timing.
const GRAVITY = 10;
const SCALE_ACCEL = 7000;
const DRAG = 1.0013;
const ROT_STEP = 11.25 / 2, MAX_THROTTLE = 20;
const TERRAIN_VARIATION = 60, HIGHEST_MOUNTAIN = 200;
const CANNON_COUNT = 8, BULLET_COUNT = 10;
const BULLET_SPEED = 2, CANNON_BULLET_SPEED = 1.5, BULLET_RANGE = 500;
const BOUNCE = 60, BURST = 2;
const MINI_Y_SCALE = 17 / WATER, MINI_X_SCALE = 160 / MAP_SIZE;

let terrain = [];
let terrainType = [];
let cannons = [];
let helis = [];
let pressed = new Set();
let mode = "menu";
let paused = false;
let t = 0;
let cannonTicker = 0;
let flash = 0;
let msg = "";

function setup() {
  createCanvas(W, H);
  pixelDensity(1);
  textFont("monospace");
  generateMap();
  resetHelis();
  frameRate(60);
}

function draw() {
  background(0);
  if (mode === "menu") {
    drawMenu();
    return;
  }
  if (!paused) {
    for (let h of helis) handleControls(h);
    stepGame();
  }
  drawGame();
  if (paused) centerText("PAUSED", 28, color(255, 220, 80));
}

function keyPressed() {
  pressed.add(keyCode);
  pressed.add(String(key).toLowerCase());

  if (keyCode === ESCAPE) {
    mode = "menu";
    return false;
  }
  if (key === "p" || key === "P") paused = !paused;

  if (mode === "menu") {
    if (key === "3") {
      generateMap();
      resetHelis();
    }
    if (key === "0" || keyCode === ENTER) {
      mode = "game";
      paused = false;
      resetHelis();
    }
    return false;
  }

  if (key === "0") {
    generateMap();
    resetHelis();
    msg = "New map";
    flash = 60;
  }

  for (let h of helis) {
    if (matchKey(h.keys.flip)) flipHeli(h);
    if (matchKey(h.keys.fire)) h.fireQueue = h.fireQueue === 0 ? BURST : 0;
  }
  return false;
}

function keyReleased() {
  pressed.delete(keyCode);
  pressed.delete(String(key).toLowerCase());
  return false;
}

function matchKey(binding) {
  if (typeof binding === "number") return keyCode === binding;
  return String(key).toLowerCase() === String(binding).toLowerCase();
}

function down(binding) {
  if (typeof binding === "number") return pressed.has(binding);
  return pressed.has(String(binding).toLowerCase());
}

function generateMap() {
  terrain = Array(MAP_SIZE + 2).fill(WATER);
  terrainType = Array(MAP_SIZE + 2).fill(1);
  cannons = [];

  let sx = floor(320 / MAP_STEP);
  terrain[1] = 10;

  for (let i = 2; i <= MAP_SIZE; i++) {
    if (terrain[i - 1] > WATER - 4) {
      let b = floor(random(5));
      if (b === 0) terrain[i] = terrain[i - 1] - TERRAIN_VARIATION - floor(random(TERRAIN_VARIATION * 2));
      else terrain[i] = terrain[i - 1] === WATER ? WATER - 2 : WATER;
    } else {
      terrain[i] = terrain[i - 1] + TERRAIN_VARIATION - floor(random(TERRAIN_VARIATION * 2));
    }
    if (terrain[i] < HIGHEST_MOUNTAIN) terrain[i] += TERRAIN_VARIATION - floor(random(10));
    if (terrain[i] > WATER + 1) terrain[i] -= TERRAIN_VARIATION - floor(random(TERRAIN_VARIATION / 3));
    terrainType[i - 1] = terrain[i - 1] > WATER - 4 && terrain[i] > WATER - 4 ? 2 : 1;
  }

  terrain[sx - 1] = -50;
  terrain[sx] = -50;
  terrain[MAP_SIZE] = WATER;
  terrain[MAP_SIZE - 1] = WATER - 2;
  terrain[MAP_SIZE - 2] = WATER;

  let starts = [sx + 4, MAP_SIZE - 10];
  for (let d = 0; d < 2; d++) {
    let kx = starts[d];
    terrain[kx] -= 20;
    terrain[kx + 1] = terrain[kx];
    terrainType[kx] = 3;
  }

  for (let d = 0; d < CANNON_COUNT; d++) {
    let half = round(MAP_SIZE / 2);
    let idx = 5;
    let tries = 0;
    do {
      tries++;
      if (d < CANNON_COUNT / 2) idx = floor(random(half - 10)) + 5;
      else idx = half + floor(random(half - 10)) + 5;
      if (tries > 200) break;
    } while (!(terrainType[idx] === 1 && terrain[idx] < terrain[idx - 1] && terrain[idx] < terrain[idx + 1]));

    cannons.push({
      idx,
      x: idx * MAP_STEP,
      y: terrain[idx],
      target: d < CANNON_COUNT / 2 ? 1 : 0,
      side: d < CANNON_COUNT / 2 ? 0 : 1,
      hp: 10,
      px: 0,
      py: 0,
      vx: 0,
      vy: 0,
      range: 0,
      boom: 0
    });
  }
}

function makeHeli(id) {
  // Consistent world coordinates: terrain point i is at x = i * MAP_STEP.
  // The camera keeps each player helicopter at CENTER_X in its own viewport.
  let startKx = id === 0 ? floor(320 / MAP_STEP) + 4 : MAP_SIZE - 10;
  return {
    id,
    x: CENTER_X,
    y: terrain[startKx] - K15 - 2,
    worldX: startKx * MAP_STEP,
    vx: 0,
    vy: 0,
    vk: 0,
    support: GRAVITY / SCALE_ACCEL,
    angle: 90,
    dir: id * 2 - 1,
    rotor: 0,
    rotorDir: 5,
    hp: 20,
    loser: 0,
    fireQueue: 0,
    bulletSlot: 0,
    bullets: Array.from({ length: BULLET_COUNT }, () => ({ active: false, x: 0, y: 500, vx: 0, vy: 0, range: 0 })),
    smoke: [],
    keys: id === 0
      ? { up: "a", down: "z", left: "x", flip: "c", right: "v", fire: 32 }
      : { up: "8", down: "2", left: "4", flip: "5", right: "6", fire: ENTER }
  };
}

function resetHelis() {
  helis = [makeHeli(0), makeHeli(1)];
  t = 0;
  cannonTicker = 0;
}

function resetHeli(h) {
  Object.assign(h, makeHeli(h.id));
}

function handleControls(h) {
  if (h.loser >= 11) return;
  if (down(h.keys.up) && floor(h.vk) > -MAX_THROTTLE) {
    h.vk -= 0.34;
    h.support = 0;
  }
  if (down(h.keys.down) && floor(h.vk) < 0) {
    h.vk += 0.34;
    if (h.vk > 0) h.vk = 0;
  }
  if (down(h.keys.left) && h.support === 0) rotateHeli(h, -ROT_STEP * 0.22 * h.dir);
  if (down(h.keys.right) && h.support === 0) rotateHeli(h, ROT_STEP * 0.22 * h.dir);
}

function rotateHeli(h, a) {
  h.angle = (h.angle + a + 360) % 360;
}

function flipHeli(h) {
  if (h.support === 0) h.dir *= -1;
}

function stepGame() {
  t = (t % 200) + 1;

  if (t % 20 === 0) for (let h of helis) firePlayerBullet(h);
  if (t % 100 === 0) fireCannon();

  updateCannonBullets();
  updatePlayerBullets();

  if (t % 20 === 15) {
    for (let h of helis) {
      if (h.loser >= 11) rotateHeli(h, h.dir * ROT_STEP * floor(random(-1, 2)));
    }
  }

  for (let h of helis) updateHeli(h);
  for (let h of helis) checkGround(h);
  for (let h of helis) updateSmoke(h);

  for (let h of helis) {
    if (h.loser === 100) {
      msg = `Player ${h.id + 1} crashed`;
      flash = 45;
      resetHeli(h);
    }
  }
  if (flash > 0) flash--;
}

function firePlayerBullet(h) {
  if (h.fireQueue <= 0 || h.loser >= 11) return;
  let b = h.bullets[h.bulletSlot % BULLET_COUNT];
  if (b.active) return;

  let pts = heliPoints(h);
  let muzzle = pts[2];
  let speed = BULLET_SPEED / (1 + random(10) / 40);
  h.fireQueue--;
  h.bulletSlot++;
  b.active = true;
  b.x = h.worldX + muzzle.x - CENTER_X;
  b.y = muzzle.y;
  b.vx = h.dir * cosD(h.angle + 90) * speed;
  b.vy = sinD(h.angle + 90) * speed;
  b.range = BULLET_RANGE;
}

function fireCannon() {
  cannonTicker = (cannonTicker + 1) % CANNON_COUNT;
  let c = cannons[cannonTicker];
  if (!c || c.range > 0 || c.hp <= 0) return;

  let target = helis[c.target];
  let dx = c.x - target.worldX;
  let dy = c.y - 1 - target.y;
  let distToTarget = sqrt(dx * dx + dy * dy);
  if (distToTarget >= 250 || distToTarget < 1 || abs(dx) < 0.01) return;

  c.vx = -dx / 100;
  c.vy = c.vx * (dy / dx);
  let s = CANNON_BULLET_SPEED / sqrt(c.vx * c.vx + c.vy * c.vy);
  c.vx *= s;
  c.vy *= s;
  c.px = c.x + (K20 / CANNON_BULLET_SPEED) * c.vx;
  c.py = c.y - 1 + (K20 / CANNON_BULLET_SPEED) * c.vy;
  c.range = 150;
}

function updateCannonBullets() {
  for (let c of cannons) {
    if (c.range <= 0) continue;
    c.px += c.vx;
    c.py += c.vy;
    c.range--;
    if (c.range <= 0 || c.py < 0 || c.py > WATER + 20) {
      c.range = 0;
      continue;
    }
    for (let h of helis) {
      if (dist(c.px, c.py, h.worldX, h.y) < K15 + 2) {
        damageHeli(h, c.vx / BOUNCE, c.vy / BOUNCE);
        c.range = 0;
        break;
      }
    }
  }
}

function updatePlayerBullets() {
  for (let shooter of helis) {
    for (let b of shooter.bullets) {
      if (!b.active) continue;
      b.x += b.vx;
      b.y += b.vy;
      b.range--;

      if (b.range <= 0 || b.y < 0 || b.y > H || terrainAt(b.x) < b.y) {
        b.active = false;
        continue;
      }

      let target = helis[1 - shooter.id];
      if (dist(b.x, b.y, target.worldX, target.y) < K15 + 3) {
        damageHeli(target, b.vx / BOUNCE, b.vy / BOUNCE);
        b.active = false;
        continue;
      }

      for (let c of cannons) {
        if (c.hp > 0 && dist(b.x, b.y, c.x, c.y) < K20 + 3) {
          c.hp--;
          if (c.hp <= 0) {
            c.hp = 0;
            c.boom = 35;
          }
          b.active = false;
          break;
        }
      }
    }
  }
}

function damageHeli(h, pushX, pushY) {
  if (h.hp <= 0) return;
  h.hp--;
  if (h.hp <= 0) {
    h.hp = 0;
    h.loser = 11;
    h.vk = 0;
  }
  if (h.hp <= 10) h.loser = max(h.loser, 11 - h.hp);
  h.support = 0;
  h.vx += pushX;
  h.vy += pushY;
  h.smoke.push({ x: h.worldX, y: h.y, life: 80 });
}

function updateHeli(h) {
  // Same model as the Pascal version, only with SCALE_ACCEL reduced
  // so the movement is visible at p5.js frame rate.
  let v = h.vk / SCALE_ACCEL;
  h.vy += sinD(h.angle) * v + GRAVITY / SCALE_ACCEL - h.support;
  h.vx += cosD(h.angle) * v * h.dir;

  h.vy /= DRAG;
  h.vx /= DRAG;
  h.worldX += h.vx;
  h.y += h.vy;

  if (h.y < K10 && h.vk !== 0) h.vk = 0;

  h.rotor += h.rotorDir * max(1, floor(-h.vk / 2));
  if (h.rotor > 25) {
    h.rotor = 25;
    h.rotorDir = -1;
  }
  if (h.rotor < 0) {
    h.rotor = 0;
    h.rotorDir = 1;
  }

  if (h.loser > 0) h.smoke.push({ x: h.worldX + random(-8, 8), y: h.y + random(-2, 5), life: 50 });
}

function checkGround(h) {
  let pts = heliPoints(h);
  let check = [pts[1], pts[2], pts[3], pts[4], pts[5], pts[6]];

  for (let i = 0; i < check.length; i++) {
    let p = check[i];
    let wx = h.worldX + p.x - CENTER_X;
    let ground = terrainAt(wx);
    if (p.y > ground) {
      let g1 = terrainAt(h.worldX + pts[1].x - CENTER_X);
      let g2 = terrainAt(h.worldX + pts[2].x - CENTER_X);
      let safe = g1 < 443 && h.vy < 0.2 && abs(g1 - g2) < 2 && i < 2 && h.angle > 80 && h.angle < 110;
      if (safe) {
        h.y = g1 - K15 - 1;
        h.angle = 90;
        h.support = max(0, (h.vk + GRAVITY) / SCALE_ACCEL);
        h.vx = 0;
        h.vy = 0;
      } else {
        h.loser = 100;
      }
      return;
    }
  }
}

function updateSmoke(h) {
  for (let p of h.smoke) {
    p.y -= 0.12;
    p.life--;
  }
  h.smoke = h.smoke.filter(p => p.life > 0);
}

function terrainAt(worldX) {
  let sx = floor(worldX / MAP_STEP);
  sx = constrainMapIndex(sx);
  let local = worldX - sx * MAP_STEP;
  let slope = (terrain[sx + 1] - terrain[sx]) / MAP_STEP;
  return terrain[sx] + local * slope;
}

function constrainMapIndex(i) {
  if (i < 1) return 1;
  if (i >= MAP_SIZE) return (i % 2) + MAP_SIZE - 2;
  return i;
}

function heliPoints(h) {
  let c0 = cosD(h.angle) * h.dir;
  let c90 = cosD(h.angle + 90) * h.dir;
  let s0 = sinD(h.angle);
  let s90 = sinD(h.angle + 90);
  let prop = K25 - h.rotor / HELI_RATIO;
  let p = Array.from({ length: 20 }, () => ({ x: h.x, y: h.y }));

  p[1] = { x: h.x - c90 * K10 + c0 * K15, y: h.y - s90 * K10 + s0 * K15 };
  p[2] = { x: p[1].x + c90 * (K20 + K10), y: p[1].y + s90 * (K20 + K10) };
  p[7] = { x: h.x - c0 * K20, y: h.y - s0 * K20 };
  p[3] = { x: p[7].x + c90 * prop, y: p[7].y + s90 * prop };
  p[4] = { x: p[7].x - c90 * prop, y: p[7].y - s90 * prop };
  p[6] = { x: h.x - c90 * K17 - c0 * K7 - c90 * K23, y: h.y - s90 * K17 - s0 * K7 - s90 * K23 };
  p[5] = { x: p[6].x - c0 * K10, y: p[6].y - s0 * K10 };
  p[16] = { x: h.x + c0 * K10, y: h.y + s0 * K10 };
  p[14] = { x: p[16].x + c90 * K10, y: p[16].y + s90 * K10 };
  p[12] = { x: h.x + c90 * K10, y: h.y + s90 * K10 };
  p[18] = { x: p[14].x - c0 * K20, y: p[14].y - s0 * K20 };
  p[15] = { x: h.x - c0 * K15, y: h.y - s0 * K15 };
  p[19] = { x: p[15].x + c90 * K7, y: p[15].y + s90 * K7 };
  p[10] = { x: p[15].x - c90 * K7, y: p[15].y - s90 * K7 };
  p[17] = { x: p[18].x - c90 * K20, y: p[18].y - s90 * K20 };
  p[13] = { x: p[18].x - c90 * K40, y: p[18].y - s90 * K40 };
  p[11] = { x: h.x - c90 * K17 - c0 * K7, y: h.y - s90 * K17 - s0 * K7 };
  p[9] = { x: h.x + c0 * K15, y: h.y + s0 * K15 };
  p[8] = { x: p[9].x + c90 * K10, y: p[9].y + s90 * K10 };
  return p;
}

function drawGame() {
  drawFrame();
  drawViewport(0);
  drawViewport(1);
  drawHud();
  drawMiniMap();
  if (flash > 0 && msg) {
    fill(255, 220, 80);
    noStroke();
    textAlign(CENTER, CENTER);
    textSize(14);
    text(msg, W / 2, 230);
  }
}

function drawFrame() {
  stroke(240);
  noFill();
  line(0, 0, 0, H - 1);
  line(W - 1, 0, W - 1, H - 1);
  line(316, 0, 316, WATER + 2);
  line(323, 0, 323, WATER + 2);
  line(0, WATER + 2, 316, WATER + 2);
  line(323, WATER + 2, W - 1, WATER + 2);
  line(0, H - 1, W - 1, H - 1);
  line(0, HUD_TOP + 19, W - 1, HUD_TOP + 19);
  line(0, HUD_TOP + 34, W - 1, HUD_TOP + 34);
  line(320, H - 1, 320, WATER + 2);
  line(317, WATER + 2, 322, WATER + 2);
  line(159, WATER + 2, 159, HUD_TOP + 19);
  line(479, WATER + 2, 479, HUD_TOP + 19);
}

function drawViewport(side) {
  let ox = side === 0 ? 0 : RIGHT_X;
  let viewer = helis[side];

  push();
  drawingContext.save();
  drawingContext.beginPath();
  drawingContext.rect(ox + 1, 0, VIEW_W - 1, WATER + 2);
  drawingContext.clip();

  drawTerrain(side, viewer);
  drawCannons(side, viewer);
  drawSmoke(side, viewer);
  drawBullets(side, viewer);

  let other = helis[1 - side];
  if (abs(viewer.worldX - other.worldX) < 157 - K40) {
    drawHeliAt(other, ox + CENTER_X + other.worldX - viewer.worldX, other.y);
  }
  drawHeliAt(viewer, ox + CENTER_X, viewer.y);

  drawingContext.restore();
  pop();
}

function drawTerrain(side, viewer) {
  let ox = side === 0 ? 0 : RIGHT_X;
  for (let i = 1; i < MAP_SIZE; i++) {
    let sx = constrainMapIndex(i);
    let x1 = ox + CENTER_X + i * MAP_STEP - viewer.worldX;
    let x2 = ox + CENTER_X + (i + 1) * MAP_STEP - viewer.worldX;
    if (x2 < ox - 10 || x1 > ox + VIEW_W + 10) continue;
    if (terrainType[sx] === 2) stroke(40, 200, 220);
    else if (terrainType[sx] === 3) stroke(210);
    else stroke(60, 220, 80);
    line(x1, terrain[sx], x2, terrain[sx + 1]);
  }
}

function drawCannons(side, viewer) {
  let ox = side === 0 ? 0 : RIGHT_X;
  for (let c of cannons) {
    let cx = ox + CENTER_X + c.x - viewer.worldX;
    if (cx < ox - K20 || cx > ox + VIEW_W + K20) continue;
    stroke(c.side === 0 ? color(255, 120, 255) : color(120, 170, 255));
    line(cx - K20, c.y - 1, cx - K20, c.y - K7);
    line(cx + K20, c.y - 1, cx + K20, c.y - K7);
    line(cx - K20, c.y - 1, cx + K20, c.y - 1);
    noFill();
    if (c.hp > 0) arc(cx, c.y - 2, K20 * 2, K20 * 2, PI, TWO_PI);
    else if (c.boom > 0) {
      stroke(255, 80, 50);
      arc(cx, c.y - 2, c.boom, c.boom, PI, TWO_PI);
      c.boom--;
    }
  }
}

function drawBullets(side, viewer) {
  let ox = side === 0 ? 0 : RIGHT_X;
  strokeWeight(2);
  for (let c of cannons) {
    if (c.range > 0) {
      let x = ox + CENTER_X + c.px - viewer.worldX;
      if (x > ox && x < ox + VIEW_W) {
        stroke(c.side === 0 ? color(255, 120, 255) : color(120, 170, 255));
        point(x, c.py);
      }
    }
  }
  for (let h of helis) {
    for (let b of h.bullets) {
      if (!b.active) continue;
      let x = ox + CENTER_X + b.x - viewer.worldX;
      if (x > ox && x < ox + VIEW_W) {
        stroke(h.id === 0 ? color(255, 80, 80) : color(255, 230, 80));
        point(x, b.y);
      }
    }
  }
  strokeWeight(1);
}

function drawSmoke(side, viewer) {
  let ox = side === 0 ? 0 : RIGHT_X;
  noFill();
  for (let h of helis) {
    for (let p of h.smoke) {
      let x = ox + CENTER_X + p.x - viewer.worldX;
      if (x < ox || x > ox + VIEW_W) continue;
      stroke(130, p.life * 3);
      circle(x, p.y, max(2, (55 - p.life) * 0.18));
    }
  }
}

function drawHeliAt(h, sx, sy) {
  let temp = Object.assign({}, h, { x: sx, y: sy });
  let p = heliPoints(temp);
  stroke(h.id === 0 ? color(255, 80, 80) : color(255, 230, 80));
  noFill();
  lp(p, 16, 14); lp(p, 18, 8); lp(p, 18, 19); lp(p, 10, 19);
  lp(p, 10, 17); lp(p, 18, 13); lp(p, 15, 7); lp(p, 16, 11);
  lp(p, 6, 11); lp(p, 6, 5); lp(p, 5, 13); lp(p, 2, 1);
  lp(p, 16, 9); lp(p, 3, 4);
  arc(p[12].x, p[12].y, K10 * 2, K10 * 2, radians(-h.angle * h.dir + 180), radians(-h.angle * h.dir + 360));
  if (h.loser >= 11) {
    stroke(255, 100, 20);
    line(sx - 8, sy - 8, sx + 8, sy + 8);
    line(sx + 8, sy - 8, sx - 8, sy + 8);
  }
}

function lp(p, a, b) {
  line(p[a].x, p[a].y, p[b].x, p[b].y);
}

function drawHud() {
  noStroke();
  fill(230);
  textAlign(LEFT, TOP);
  textSize(12);
  text("Kaasu:", 2, 453);
  text("Kaasu:", 322, 453);

  for (let i = 0; i < 2; i++) {
    let x0 = i === 0 ? 0 : 319;
    let h = helis[i];
    fill(30);
    rect(x0 + 40, 451, 108, 12);
    for (let k = 0; k < floor(-h.vk); k += 2) {
      fill(k < 6 ? color(230, 60, 60) : k < 12 ? color(230, 200, 40) : color(70, 220, 70));
      rect(x0 + 40 + k * 5, 451, 8, 11);
    }
    fill(30);
    rect(x0 + 215, 451, 104, 12);
    for (let e = 1; e <= h.hp; e++) {
      fill(e < 6 ? color(230, 60, 60) : e < 11 ? color(230, 200, 40) : color(70, 220, 70));
      rect(x0 + 215 + e * 5, 451, 3, 11);
    }
    fill(i === 0 ? color(255, 100, 100) : color(255, 220, 80));
    text(`P${i + 1} HP ${h.hp}`, x0 + 215, 466);
  }
}

function drawMiniMap() {
  for (let view = 0; view < 2; view++) {
    let off = view === 0 ? 0 : 320;
    for (let i = 2; i <= MAP_SIZE; i++) {
      if (terrainType[i - 1] === 2) stroke(40, 200, 220);
      else if (terrainType[i - 1] === 3) stroke(210);
      else stroke(60, 220, 80);
      line(off + i * MINI_X_SCALE - MINI_X_SCALE, 408 + terrain[i] * MINI_Y_SCALE,
           off + (i - 1) * MINI_X_SCALE - MINI_X_SCALE, 408 + terrain[i - 1] * MINI_Y_SCALE);
    }
    for (let h of helis) {
      let mx = off + (h.worldX * MINI_X_SCALE / MAP_STEP - MINI_X_SCALE);
      let my = HUD_TOP + h.y * MINI_Y_SCALE + MINI_Y_SCALE;
      stroke(h.id === 0 ? color(255, 80, 80) : color(255, 230, 80));
      point(mx, my);
    }
  }
}

function drawMenu() {
  background(0);
  drawMiniPreview();

  textAlign(CENTER, CENTER);
  textSize(56);
  fill(180, 20, 30);
  text("Helikopteripeli", W / 2 + 3, 54);
  fill(255, 220, 40);
  text("Helikopteripeli", W / 2 - 1, 50);

  textAlign(LEFT, TOP);
  textSize(14);
  fill(180);
  text("0) Aloita peli / Start game", 50, 200);
  text("3) Uusi kartta / New map", 50, 224);
  text("P) Pause    Esc) Menu", 50, 248);

  fill(255, 100, 100);
  text("Player 1: A/Z throttle, X/V rotate, C flip, Space fire", 50, 292);
  fill(255, 220, 80);
  text("Player 2: 8/2 throttle, 4/6 rotate, 5 flip, Enter fire", 50, 316);

  fill(150);
  text("Paste this into sketch.js only. Leave p5editor index.html unchanged.", 50, 370);
}

function drawMiniPreview() {
  for (let i = 2; i <= MAP_SIZE; i++) {
    if (terrainType[i - 1] === 2) stroke(40, 200, 220);
    else if (terrainType[i - 1] === 3) stroke(210);
    else stroke(60, 220, 80);
    line(i * (W / MAP_SIZE), 408 + terrain[i] * MINI_Y_SCALE,
         (i - 1) * (W / MAP_SIZE), 408 + terrain[i - 1] * MINI_Y_SCALE);
  }
}

function centerText(s, size, col) {
  fill(col);
  noStroke();
  textAlign(CENTER, CENTER);
  textSize(size);
  text(s, W / 2, H / 2);
}

function sinD(a) {
  return Math.sin(a * Math.PI / 180);
}

function cosD(a) {
  return Math.cos(a * Math.PI / 180);
}
