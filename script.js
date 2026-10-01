const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const scoreEl = document.getElementById('score');
const livesEl = document.getElementById('lives');
const levelEl = document.getElementById('level');

const WIDTH = canvas.width;
const HEIGHT = canvas.height;

const keys = {};
const state = {
  score: 0,
  lives: 3,
  level: 1,
  asteroids: [],
  bullets: [],
  particles: [],
  stars: [],
  isGameOver: false,
  lastTime: 0,
  highScore: Number(localStorage.getItem('asteroid-high-score') || 0),
};

const player = {
  x: WIDTH / 2,
  y: HEIGHT / 2,
  vx: 0,
  vy: 0,
  radius: 18,
  angle: -Math.PI / 2,
  thrusting: false,
  cooldown: 0,
  invulnerable: 0,
};

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function wrapEntity(entity) {
  if (entity.x < -entity.radius) entity.x = WIDTH + entity.radius;
  if (entity.x > WIDTH + entity.radius) entity.x = -entity.radius;
  if (entity.y < -entity.radius) entity.y = HEIGHT + entity.radius;
  if (entity.y > HEIGHT + entity.radius) entity.y = -entity.radius;
}

function createStars() {
  state.stars = Array.from({ length: 150 }, () => ({
    x: Math.random() * WIDTH,
    y: Math.random() * HEIGHT,
    radius: Math.random() * 2 + 0.5,
    speed: Math.random() * 0.25 + 0.05,
  }));
}

function resetPlayer() {
  player.x = WIDTH / 2;
  player.y = HEIGHT / 2;
  player.vx = 0;
  player.vy = 0;
  player.angle = -Math.PI / 2;
  player.thrusting = false;
  player.cooldown = 0;
  player.invulnerable = 180;
}

function createAsteroid(x, y, radius, speedScale = 1) {
  const asteroid = {
    x,
    y,
    radius,
    vx: randomBetween(-1.4, 1.4) * speedScale,
    vy: randomBetween(-1.4, 1.4) * speedScale,
    rotation: randomBetween(0, Math.PI * 2),
    spin: randomBetween(-0.04, 0.04),
    points: Array.from({ length: 8 }, (_, index) => ({
      angle: (Math.PI * 2 * index) / 8 + randomBetween(-0.5, 0.5),
      distance: radius * randomBetween(0.7, 1.3),
    })),
  };

  state.asteroids.push(asteroid);
}

function buildLevel(level) {
  const asteroidCount = 3 + level;
  state.asteroids = [];

  for (let i = 0; i < asteroidCount; i += 1) {
    let x = randomBetween(0, WIDTH);
    let y = randomBetween(0, HEIGHT);

    const distanceFromPlayer = Math.hypot(x - player.x, y - player.y);
    if (distanceFromPlayer < 120) {
      x = randomBetween(0, WIDTH);
      y = randomBetween(0, HEIGHT);
    }

    createAsteroid(x, y, randomBetween(28, 52), 1 + level * 0.18);
  }
}

function updateHud() {
  scoreEl.textContent = state.score;
  livesEl.textContent = state.lives;
  levelEl.textContent = state.level;
}

function shoot() {
  if (player.cooldown > 0 || state.isGameOver) return;

  const speed = 7.2;
  const shotX = player.x + Math.cos(player.angle) * (player.radius + 12);
  const shotY = player.y + Math.sin(player.angle) * (player.radius + 12);

  state.bullets.push({
    x: shotX,
    y: shotY,
    vx: Math.cos(player.angle) * speed + player.vx,
    vy: Math.sin(player.angle) * speed + player.vy,
    life: 1.2,
    radius: 3,
  });

  player.cooldown = 0.25;
}

function spawnExplosion(x, y, color, count = 12) {
  for (let i = 0; i < count; i += 1) {
    state.particles.push({
      x,
      y,
      vx: randomBetween(-2.5, 2.5),
      vy: randomBetween(-2.5, 2.5),
      radius: randomBetween(2, 5),
      life: randomBetween(0.5, 1.1),
      color,
    });
  }
}

function splitAsteroid(ast, index) {
  const { x, y, radius } = ast;
  const newRadius = radius * 0.6;

  if (newRadius > 16) {
    for (let i = 0; i < 2; i += 1) {
      const child = {
        x,
        y,
        radius: newRadius,
        vx: ast.vx + randomBetween(-1.4, 1.4),
        vy: ast.vy + randomBetween(-1.4, 1.4),
        rotation: randomBetween(0, Math.PI * 2),
        spin: randomBetween(-0.08, 0.08),
        points: Array.from({ length: 8 }, (_, pointIndex) => ({
          angle: (Math.PI * 2 * pointIndex) / 8 + randomBetween(-0.7, 0.7),
          distance: newRadius * randomBetween(0.72, 1.3),
        })),
      };
      state.asteroids.push(child);
    }
  }

  state.asteroids.splice(index, 1);
  state.score += Math.round(100 * (1 + state.level * 0.25));
  if (state.score > state.highScore) {
    state.highScore = state.score;
    localStorage.setItem('asteroid-high-score', String(state.highScore));
  }
  spawnExplosion(x, y, '#fbbf24', 18);
}

function handleCollisions() {
  for (let i = state.asteroids.length - 1; i >= 0; i -= 1) {
    const asteroid = state.asteroids[i];
    const dx = asteroid.x - player.x;
    const dy = asteroid.y - player.y;
    const distance = Math.hypot(dx, dy);

    if (distance < asteroid.radius + player.radius && player.invulnerable <= 0) {
      state.lives -= 1;
      spawnExplosion(player.x, player.y, '#f87171', 30);
      resetPlayer();

      if (state.lives <= 0) {
        state.isGameOver = true;
        spawnExplosion(WIDTH / 2, HEIGHT / 2, '#f87171', 50);
      }
      return;
    }

    for (let j = state.bullets.length - 1; j >= 0; j -= 1) {
      const bullet = state.bullets[j];
      const bulletDistance = Math.hypot(asteroid.x - bullet.x, asteroid.y - bullet.y);
      if (bulletDistance < asteroid.radius + bullet.radius) {
        state.bullets.splice(j, 1);
        splitAsteroid(asteroid, i);
        break;
      }
    }
  }
}

function update(dt) {
  if (state.isGameOver) {
    if (keys.Enter) {
      state.score = 0;
      state.lives = 3;
      state.level = 1;
      state.isGameOver = false;
      state.asteroids = [];
      state.bullets = [];
      state.particles = [];
      resetPlayer();
      buildLevel(1);
    }
    return;
  }

  if (keys.ArrowLeft || keys.a) {
    player.angle -= 0.085;
  }
  if (keys.ArrowRight || keys.d) {
    player.angle += 0.085;
  }
  if (keys.ArrowUp || keys.w) {
    player.thrusting = true;
    player.vx += Math.cos(player.angle) * 0.18;
    player.vy += Math.sin(player.angle) * 0.18;
    const maxSpeed = 6;
    const speed = Math.hypot(player.vx, player.vy);
    if (speed > maxSpeed) {
      player.vx = (player.vx / speed) * maxSpeed;
      player.vy = (player.vy / speed) * maxSpeed;
    }
    spawnExplosion(player.x - Math.cos(player.angle) * 16, player.y - Math.sin(player.angle) * 16, '#7dd3fc', 1);
  } else {
    player.thrusting = false;
  }

  player.x += player.vx;
  player.y += player.vy;
  player.vx *= 0.99;
  player.vy *= 0.99;
  player.cooldown = Math.max(0, player.cooldown - dt / 1000);
  player.invulnerable = Math.max(0, player.invulnerable - dt);
  wrapEntity(player);

  for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
    const bullet = state.bullets[i];
    bullet.x += bullet.vx;
    bullet.y += bullet.vy;
    bullet.life -= dt / 1000;
    if (bullet.life <= 0) {
      state.bullets.splice(i, 1);
      continue;
    }
    wrapEntity(bullet);
  }

  for (const asteroid of state.asteroids) {
    asteroid.x += asteroid.vx;
    asteroid.y += asteroid.vy;
    asteroid.rotation += asteroid.spin;
    wrapEntity(asteroid);
  }

  for (let i = state.particles.length - 1; i >= 0; i -= 1) {
    const particle = state.particles[i];
    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.life -= dt / 1000;
    if (particle.life <= 0) {
      state.particles.splice(i, 1);
    }
  }

  for (const star of state.stars) {
    star.y += star.speed;
    if (star.y > HEIGHT) {
      star.y = -5;
      star.x = Math.random() * WIDTH;
    }
  }

  handleCollisions();

  if (state.asteroids.length === 0 && !state.isGameOver) {
    state.level += 1;
    buildLevel(state.level);
  }

  updateHud();
}

function drawShip() {
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.angle);

  if (player.invulnerable > 0 && Math.floor(player.invulnerable / 8) % 2 === 0) {
    ctx.globalAlpha = 0.45;
  }

  ctx.beginPath();
  ctx.moveTo(18, 0);
  ctx.lineTo(-14, 10);
  ctx.lineTo(-8, 0);
  ctx.lineTo(-14, -10);
  ctx.closePath();
  ctx.fillStyle = '#e2e8f0';
  ctx.fill();

  if (player.thrusting) {
    ctx.beginPath();
    ctx.moveTo(-12, 0);
    ctx.lineTo(-20, 0);
    ctx.lineTo(-10, 0);
    ctx.lineTo(-14, 0);
    ctx.closePath();
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-12, 0);
    ctx.lineTo(-22, 0);
    ctx.lineTo(-12, 0);
    ctx.stroke();
  }

  ctx.restore();
}

function drawAsteroid(asteroid) {
  ctx.save();
  ctx.translate(asteroid.x, asteroid.y);
  ctx.rotate(asteroid.rotation);

  ctx.beginPath();
  asteroid.points.forEach((point, index) => {
    const angle = point.angle;
    const distance = point.distance;
    const x = Math.cos(angle) * distance;
    const y = Math.sin(angle) * distance;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fillStyle = '#94a3b8';
  ctx.fill();
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.restore();
}

function drawBullets() {
  for (const bullet of state.bullets) {
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
    ctx.fillStyle = '#7dd3fc';
    ctx.fill();
  }
}

function drawParticles() {
  for (const particle of state.particles) {
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
    ctx.fillStyle = particle.color;
    ctx.globalAlpha = Math.max(particle.life, 0);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawStars() {
  for (const star of state.stars) {
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(186, 230, 253, 0.8)';
    ctx.fill();
  }
}

function drawGameOver() {
  ctx.fillStyle = 'rgba(2, 6, 23, 0.7)';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = '#f8fafc';
  ctx.textAlign = 'center';
  ctx.font = 'bold 48px Segoe UI';
  ctx.fillText('Game Over', WIDTH / 2, HEIGHT / 2 - 16);

  ctx.font = '24px Segoe UI';
  ctx.fillText(`Score: ${state.score}  |  High Score: ${state.highScore}`, WIDTH / 2, HEIGHT / 2 + 34);
  ctx.fillText('Press Enter to restart', WIDTH / 2, HEIGHT / 2 + 76);
}

function render() {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);

  drawStars();

  for (const asteroid of state.asteroids) {
    drawAsteroid(asteroid);
  }

  drawBullets();
  drawParticles();
  drawShip();

  if (state.isGameOver) {
    drawGameOver();
  }
}

function loop(timestamp) {
  const dt = timestamp - state.lastTime || 16;
  state.lastTime = timestamp;

  update(dt);
  render();
  requestAnimationFrame(loop);
}

window.addEventListener('keydown', (event) => {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  keys[key] = true;

  if (key === ' ' || event.code === 'Space') {
    event.preventDefault();
    shoot();
  }

  if (key === 'Enter') {
    keys.Enter = true;
  }
});

window.addEventListener('keyup', (event) => {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  keys[key] = false;
  if (key === 'Enter') keys.Enter = false;
});

createStars();
resetPlayer();
buildLevel(1);
updateHud();
requestAnimationFrame(loop);
