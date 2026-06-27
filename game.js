const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const W = canvas.width;
const H = canvas.height;

const keys = {};
const touchState = { active: false, x: 0, y: 0 };
window.addEventListener('keydown', (e) => { keys[e.key.toLowerCase()] = true; });
window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

const joystick = document.getElementById('mobileJoystick');
const stick = document.getElementById('mobileStick');

function updateTouchInput(clientX, clientY) {
  const rect = joystick.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const dx = clientX - centerX;
  const dy = clientY - centerY;
  const maxDist = rect.width / 2;
  const len = Math.min(1, Math.hypot(dx, dy) / maxDist);
  const angle = Math.atan2(dy, dx) || 0;

  touchState.active = true;
  touchState.x = Math.cos(angle) * len;
  touchState.y = Math.sin(angle) * len;

  const offsetX = Math.max(-maxDist, Math.min(maxDist, dx));
  const offsetY = Math.max(-maxDist, Math.min(maxDist, dy));
  stick.style.left = `${50 + (offsetX / maxDist) * 35}%`;
  stick.style.top = `${50 + (offsetY / maxDist) * 35}%`;
  stick.style.transform = 'translate(-50%, -50%)';
}

function resetTouchInput() {
  touchState.active = false;
  touchState.x = 0;
  touchState.y = 0;
  stick.style.left = '50%';
  stick.style.top = '50%';
  stick.style.transform = 'translate(-50%, -50%)';
}

function handleTouchStart(e) {
  e.preventDefault();
  if (e.touches && e.touches.length) {
    const touch = e.touches[0];
    updateTouchInput(touch.clientX, touch.clientY);
  }
}

function handleTouchMove(e) {
  e.preventDefault();
  if (e.touches && e.touches.length) {
    const touch = e.touches[0];
    updateTouchInput(touch.clientX, touch.clientY);
  }
}

function handleTouchEnd() {
  resetTouchInput();
}

joystick.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  joystick.setPointerCapture?.(e.pointerId);
  updateTouchInput(e.clientX, e.clientY);
});

joystick.addEventListener('pointermove', (e) => {
  if (joystick.hasPointerCapture?.(e.pointerId)) updateTouchInput(e.clientX, e.clientY);
});

joystick.addEventListener('pointerup', (e) => {
  if (joystick.hasPointerCapture?.(e.pointerId)) joystick.releasePointerCapture?.(e.pointerId);
  resetTouchInput();
});

joystick.addEventListener('pointercancel', resetTouchInput);
joystick.addEventListener('touchstart', handleTouchStart, { passive: false });
joystick.addEventListener('touchmove', handleTouchMove, { passive: false });
joystick.addEventListener('touchend', handleTouchEnd);
joystick.addEventListener('touchcancel', handleTouchEnd);

const ui = {
  time: document.getElementById('timeStat'),
  level: document.getElementById('levelStat'),
  hp: document.getElementById('hpStat'),
  xp: document.getElementById('xpStat'),
};

const fullscreenBtn = document.getElementById('fullscreenBtn');
const settingsBtn = document.querySelector('.settings-btn');
const settingsModal = document.getElementById('settingsModal');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const phoneSwitches = document.querySelectorAll('.phone-switch');
const manualShootBtn = document.getElementById('manualShootBtn');
const autoShootSwitch = document.getElementById('autoShootSwitch');

const settingsState = {
  autoShoot: true,
  soundEnabled: true,
};

// ── Sound Engine ──────────────────────────────────────────────────────────────
const SoundEngine = (() => {
  let actx = null;

  function ac() {
    if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    return actx;
  }

  function tone(freq, type, dur, vol, freqEnd) {
    if (!settingsState.soundEnabled) return;
    const c = ac();
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.connect(g);
    g.connect(c.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, c.currentTime);
    if (freqEnd !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), c.currentTime + dur);
    }
    g.gain.setValueAtTime(vol, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    osc.start(c.currentTime);
    osc.stop(c.currentTime + dur + 0.01);
  }

  function noise(dur, vol, filterFreq) {
    if (!settingsState.soundEnabled) return;
    const c = ac();
    const size = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, size, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buf;
    const filt = c.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.value = filterFreq || 800;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    src.connect(filt);
    filt.connect(g);
    g.connect(c.destination);
    src.start(c.currentTime);
  }

  return {
    // Short high-pitched "pew" for Pierce Bolt
    shoot() {
      tone(880, 'square', 0.08, 0.15, 440);
    },
    // Triple burst for Scatter Shot
    shootScatter() {
      tone(760, 'square', 0.07, 0.13, 380);
      setTimeout(() => tone(820, 'square', 0.07, 0.13, 410), 35);
      setTimeout(() => tone(700, 'square', 0.07, 0.13, 350), 70);
    },
    // Mid-frequency thud when a bullet hits an enemy
    enemyHit() {
      tone(260, 'sawtooth', 0.06, 0.1, 130);
    },
    // Noise burst + descending tone on enemy death
    enemyDeath() {
      noise(0.22, 0.28, 600);
      tone(160, 'sawtooth', 0.18, 0.12, 55);
    },
    // Low thump when player takes damage
    playerHit() {
      tone(110, 'sawtooth', 0.2, 0.3, 55);
      noise(0.1, 0.18, 200);
    },
    // Rising arpeggio on level up
    levelUp() {
      [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 'square', 0.18, 0.18), i * 80));
    },
    // Ascending sweep when Scatter Shot activates
    scatterActivate() {
      tone(400, 'square', 0.4, 0.22, 1200);
    },
    // Bright chime on pickup collection
    pickup() {
      tone(1400, 'sine', 0.1, 0.12, 1800);
    },
    // Descending tones on game over / reset
    gameOver() {
      [440, 330, 220, 110].forEach((f, i) => setTimeout(() => tone(f, 'sawtooth', 0.25, 0.18), i * 130));
    },
  };
})();

let isPaused = true;

function syncShootControls() {
  const isAutoOn = settingsState.autoShoot;
  autoShootSwitch?.classList.toggle('on', isAutoOn);
  autoShootSwitch?.setAttribute('aria-pressed', String(isAutoOn));
  manualShootBtn?.classList.toggle('hidden', isAutoOn);
  manualShootBtn?.classList.toggle('active', !isAutoOn);
}

function syncSoundSwitch() {
  const soundSwitch = document.querySelector('.phone-switch[data-action="sound"]');
  if (!soundSwitch) return;
  soundSwitch.classList.toggle('on', settingsState.soundEnabled);
  soundSwitch.setAttribute('aria-pressed', String(settingsState.soundEnabled));
}

function tryShoot() {
  if (player.fireTimer > 0) return false;
  fireBullet();
  player.fireTimer = player.cooldown;
  return true;
}

function openSettingsModal() {
  settingsModal?.classList.add('open');
  settingsModal?.setAttribute('aria-hidden', 'false');
  isPaused = true;
}

function closeSettingsModal() {
  settingsModal?.classList.remove('open');
  settingsModal?.setAttribute('aria-hidden', 'true');
  isPaused = false;
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.();
    fullscreenBtn.textContent = 'Exit Fullscreen';
  } else {
    document.exitFullscreen?.();
    fullscreenBtn.textContent = 'Fullscreen';
  }
}

fullscreenBtn?.addEventListener('click', toggleFullscreen);
settingsBtn?.addEventListener('click', openSettingsModal);
closeSettingsBtn?.addEventListener('click', closeSettingsModal);
settingsModal?.addEventListener('click', (e) => {
  if (e.target === settingsModal) closeSettingsModal();
});
phoneSwitches.forEach((switchBtn) => {
  switchBtn.addEventListener('click', () => {
    const enabled = !switchBtn.classList.contains('on');
    switchBtn.classList.toggle('on', enabled);
    switchBtn.setAttribute('aria-pressed', String(enabled));

    if (switchBtn.dataset.action === 'fullscreen') {
      if (enabled) {
        document.documentElement.requestFullscreen?.();
      } else if (document.fullscreenElement) {
        document.exitFullscreen?.();
      }
    }

    if (switchBtn.dataset.action === 'autoShoot') {
      settingsState.autoShoot = enabled;
      syncShootControls();
    }

    if (switchBtn.dataset.action === 'sound') {
      settingsState.soundEnabled = enabled;
    }
  });
});

manualShootBtn?.addEventListener('click', () => {
  tryShoot();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeSettingsModal();
});
document.addEventListener('fullscreenchange', () => {
  fullscreenBtn.textContent = document.fullscreenElement ? 'Exit Fullscreen' : 'Fullscreen';
});

const player = {
  x: W / 2,
  y: H / 2,
  radius: 16,
  speed: 220,
  hp: 100,
  targetIndex: 0,
  maxHp: 100,
  xp: 0,
  level: 1,
  damageGraceTimer: 0,
  cooldown: 0.35,
  fireTimer: 0,
  damage: 18,
  weapon: 'Pierce Bolt',
  charge: 0,
  maxCharge: 10,
  scatterTimer: 0,
  scatterDuration: 10,
};

const projectiles = [];
const enemies = [];
const pickups = [];
const particles = [];

let time = 0;
let spawnTimer = 0;
let lastTime = performance.now();

function rand(min, max) { return Math.random() * (max - min) + min; }

function spawnEnemy() {
  const side = Math.floor(Math.random() * 4);
  let x = 0, y = 0;
  if (side === 0) { x = rand(0, W); y = -30; }
  if (side === 1) { x = W + 30; y = rand(0, H); }
  if (side === 2) { x = rand(0, W); y = H + 30; }
  if (side === 3) { x = -30; y = rand(0, H); }

  const radius = 14 + Math.random() * 8;
  const maxHp = 70 + Math.random() * 40;
  enemies.push({
    x,
    y,
    radius,
    hitboxRadius: radius * 0.92,
    speed: 55 + Math.random() * 45,
    hp: maxHp,
    maxHp,
    color: Math.random() > 0.6 ? '#ff7b7b' : '#ffd166',
    attackCooldown: 2,
    attackTimer: 0,
  });
}

function spawnPickup(x, y) {
  pickups.push({ x, y, radius: 7, life: 10, color: '#70d6ff' });
}

function spawnProjectile(angle, speed, damage, radius = 5, color = '#ffe082', pierce = 0) {
  projectiles.push({
    x: player.x,
    y: player.y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius,
    damage,
    color,
    pierce,
  });
}

function fireBullet() {
  const target = nearestEnemy();
  if (!target) return;

  const dx = target.x - player.x;
  const dy = target.y - player.y;
  const angle = Math.atan2(dy, dx) || 0;

  if (player.weapon === 'Scatter Shot') {
    SoundEngine.shootScatter();
    spawnProjectile(angle - 0.18, 330, 25, 5, '#ffd166');
    spawnProjectile(angle, 360, 25, 5, '#ffe082');
    spawnProjectile(angle + 0.18, 330, 25, 5, '#ffd166');
    return;
  }

  SoundEngine.shoot();
  spawnProjectile(angle, 380, 12, 5, '#8ec5ff', 2);
}

function nearestEnemy() {
  if (!enemies.length) return null;

  const sortedEnemies = enemies
    .map((enemy) => ({
      enemy,
      d: Math.hypot(enemy.x - player.x, enemy.y - player.y),
    }))
    .sort((a, b) => a.d - b.d)
    .slice(0, Math.min(5, enemies.length));

  const target = sortedEnemies[player.targetIndex % sortedEnemies.length];
  player.targetIndex = (player.targetIndex + 1) % sortedEnemies.length;
  return target ? target.enemy : null;
}

function update(dt) {
  if (isPaused) return;

  time += dt;
  spawnTimer += dt;
  if (spawnTimer > Math.max(0.45, 1.8 - time * 0.02)) {
    spawnTimer = 0;
    spawnEnemy();
  }

const moveX = (keys['arrowleft'] ? -1 : 0) + (keys['arrowright'] ? 1 : 0) + (keys['a'] ? -1 : 0) + (keys['d'] ? 1 : 0) + (touchState.active ? touchState.x : 0);
const moveY = (keys['arrowup'] ? -1 : 0) + (keys['arrowdown'] ? 1 : 0) + (keys['w'] ? -1 : 0) + (keys['s'] ? 1 : 0) + (touchState.active ? touchState.y : 0);
  const len = Math.hypot(moveX, moveY) || 1;
  player.x += (moveX / len) * player.speed * dt;
  player.y += (moveY / len) * player.speed * dt;

  player.x = Math.max(player.radius, Math.min(W - player.radius, player.x));
  player.y = Math.max(player.radius, Math.min(H - player.radius, player.y));

  if (player.scatterTimer > 0) {
    player.scatterTimer -= dt;
    if (player.scatterTimer <= 0) {
      player.scatterTimer = 0;
      player.weapon = 'Pierce Bolt';
    }
  }

  if (settingsState.autoShoot) {
    tryShoot();
  }
  player.fireTimer -= dt;

  if (player.damageGraceTimer > 0) {
    player.damageGraceTimer -= dt;
  }

  if (player.damageGraceTimer <= 0 && player.hp < player.maxHp) {
    player.hp = Math.min(player.maxHp, player.hp + 2 * dt);
  }

  for (const p of projectiles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }

  for (const enemy of enemies) {
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const d = Math.hypot(dx, dy) || 1;
    enemy.x += (dx / d) * enemy.speed * dt;
    enemy.y += (dy / d) * enemy.speed * dt;

    enemy.attackTimer -= dt;

    if (d < enemy.hitboxRadius + player.radius && enemy.attackTimer <= 0) {
      const hitDamage = 8;
      player.hp -= hitDamage;
      player.damageGraceTimer = 3;
      enemy.attackTimer = enemy.attackCooldown;
      SoundEngine.playerHit();
      particles.push({ x: player.x, y: player.y, vx: rand(-80, 80), vy: rand(-80, 80), life: 0.35, color: '#ff6b6b' });
      particles.push({ x: player.x, y: player.y, vx: rand(-30, 30), vy: rand(-90, -25), life: 0.55, color: '#ff6b6b', text: String(hitDamage), textColor: '#ff6b6b' });
      if (player.hp <= 0) resetRun();
    }
  }

  for (let i = projectiles.length - 1; i >= 0; i -= 1) {
    const p = projectiles[i];
    if (p.x < -30 || p.x > W + 30 || p.y < -30 || p.y > H + 30) {
      projectiles.splice(i, 1);
      continue;
    }

    for (let j = enemies.length - 1; j >= 0; j -= 1) {
      const enemy = enemies[j];
      const d = Math.hypot(p.x - enemy.x, p.y - enemy.y);
      if (d < enemy.hitboxRadius + p.radius) {
        enemy.hp -= p.damage;
        SoundEngine.enemyHit();
        particles.push({ x: p.x, y: p.y, vx: rand(-60, 60), vy: rand(-60, 60), life: 0.2, color: p.color || '#7af5b5' });
        particles.push({ x: p.x, y: p.y, vx: rand(-35, 35), vy: rand(-80, -20), life: 0.45, color: '#7af5b5', text: String(Math.max(1, Math.floor(p.damage))), textColor: '#7af5b5' });
        if (p.pierce && p.pierce > 0) {
          p.pierce -= 1;
          if (p.pierce <= 0) projectiles.splice(i, 1);
        } else {
          projectiles.splice(i, 1);
        }
        if (enemy.hp <= 0) {
          SoundEngine.enemyDeath();
          enemies.splice(j, 1);
          player.xp += 5;
          if (player.weapon !== 'Scatter Shot') {
            player.charge += 0.5;
          }
          if (player.charge >= player.maxCharge && player.weapon !== 'Scatter Shot') {
            player.charge = 0;
            player.weapon = 'Scatter Shot';
            player.scatterTimer = player.scatterDuration;
            SoundEngine.scatterActivate();
            particles.push({ x: player.x, y: player.y, vx: 0, vy: 0, life: 0.6, color: '#ffd166' });
          }
          if (Math.random() < 0.5) spawnPickup(enemy.x, enemy.y);
          for (let k = 0; k < 8; k++) {
            particles.push({ x: enemy.x, y: enemy.y, vx: rand(-120, 120), vy: rand(-120, 120), life: 0.35, color: enemy.color });
          }
          for (let k = 0; k < 3; k++) {
            particles.push({ x: enemy.x, y: enemy.y, vx: rand(-40, 40), vy: rand(-40, 40), life: 0.18, color: '#fff7b2' });
          }
        }
        break;
      }
    }
  }

  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.92;
    p.vy *= 0.92;
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }

  // Pickup collection — player walks over glowing shards to restore HP
  for (let i = pickups.length - 1; i >= 0; i -= 1) {
    const item = pickups[i];
    item.life -= dt;
    const d = Math.hypot(item.x - player.x, item.y - player.y);
    if (d < item.radius + player.radius) {
      player.hp = Math.min(player.maxHp, player.hp + 12);
      SoundEngine.pickup();
      particles.push({ x: item.x, y: item.y, vx: rand(-50, 50), vy: rand(-80, -20), life: 0.4, color: '#70d6ff' });
      pickups.splice(i, 1);
    } else if (item.life <= 0) {
      pickups.splice(i, 1);
    }
  }

  levelUpIfReady();
  updateUI();
}

function levelUpIfReady() {
  const target = player.level * 40;
  if (player.xp >= target) {
    player.level += 1;
    player.xp -= target;
    player.speed += 8;
    player.damage += 4;
    player.maxHp += 8;
    player.hp = Math.min(player.hp + 12, player.maxHp);
    player.cooldown = Math.max(0.12, player.cooldown - 0.02);
    SoundEngine.levelUp();
    particles.push({ x: player.x, y: player.y, vx: 0, vy: 0, life: 0.6, color: '#77d7ff' });
  }
}

function updateUI() {
  ui.time.textContent = `${Math.floor(time)}s`;
  ui.level.textContent = String(player.level);
  ui.hp.textContent = `${Math.max(0, Math.floor(player.hp))}/${player.maxHp}`;
  ui.xp.textContent = `${player.xp}`;
}

function drawBackground() {
  ctx.clearRect(0, 0, W, H);
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#111827');
  grad.addColorStop(1, '#172132');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.strokeStyle = 'rgba(119, 215, 255, 0.08)';
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y < H; y += 48) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPlayer() {
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.fillStyle = '#98e6ff';
  ctx.fillRect(-16, -16, 32, 32);
  ctx.fillStyle = '#4ca3d0';
  ctx.fillRect(-8, -8, 16, 16);
  ctx.fillStyle = '#dff8ff';
  ctx.fillRect(-2, -18, 4, 10);
  ctx.restore();
}

function drawEnemies() {
  for (const enemy of enemies) {
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    ctx.fillStyle = enemy.color;
    ctx.fillRect(-enemy.radius, -enemy.radius, enemy.radius * 2, enemy.radius * 2);
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(-enemy.radius * 0.45, -enemy.radius * 0.45, enemy.radius * 0.9, enemy.radius * 0.9);

    const hpRatio = Math.max(0, enemy.hp / enemy.maxHp);
    const barW = enemy.radius * 2;
    const barH = 4;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
    ctx.fillRect(-barW / 2, -enemy.radius - 10, barW, barH);
    ctx.fillStyle = hpRatio > 0.35 ? '#7af5b5' : '#ffd166';
    ctx.fillRect(-barW / 2, -enemy.radius - 10, barW * hpRatio, barH);
    ctx.restore();
  }
}

function drawProjectiles() {
  for (const p of projectiles) {
    ctx.fillStyle = p.color || '#00e1ff';
    ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
  }
}

function drawPickups() {
  for (const item of pickups) {
    ctx.save();
    ctx.translate(item.x, item.y);
    ctx.fillStyle = item.color;
    ctx.fillRect(-6, -6, 12, 12);
    ctx.fillStyle = '#eff6ff';
    ctx.fillRect(-2, -2, 4, 4);
    ctx.restore();
  }
}

function drawParticles() {
  for (const p of particles) {
    const alpha = Math.max(0, p.life / 0.5);
    ctx.globalAlpha = Math.min(1, alpha * 1.15);
    if (p.text) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 12px "Press Start 2P"';
      ctx.fillStyle = p.textColor || p.color || '#ffffff';
      ctx.fillText(p.text, p.x, p.y);
      ctx.restore();
    } else {
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, 4, 4);
    }
    ctx.globalAlpha = 1;
  }
}

function drawHudText() {
  ctx.save();
  ctx.fillStyle = 'rgb(255, 255, 255)';
  ctx.font = '12px "Press Start 2P"';
  ctx.fillText(`SURVIVE: ${Math.floor(time)}s`, 18, 28);
  ctx.fillText(`LEVEL ${player.level}`, 18, 48);
  ctx.fillText(`WEAPON: ${player.weapon}`, 18, 68);

  const hpBarW = 120;
  const hpBarH = 10;
  const hpPercent = Math.max(0, Math.min(1, player.hp / player.maxHp));
  const hpBarY = H - 82;

  ctx.fillStyle = 'rgba(239, 246, 255, 0.9)';
  ctx.fillText('HP', 18, H - 94);
  ctx.fillText(`${Math.floor(hpPercent * 100)}%`, 18 + hpBarW + 10, H - 94);

  ctx.fillStyle = 'rgba(148, 163, 184, 0.35)';
  ctx.fillRect(18, hpBarY, hpBarW, hpBarH);
  ctx.shadowBlur = 10;
  ctx.shadowColor = 'rgba(134, 239, 172, 0.8)';
  ctx.fillStyle = 'rgba(134, 239, 172, 0.95)';
  ctx.fillRect(18, hpBarY, hpBarW * hpPercent, hpBarH);
  ctx.shadowBlur = 0;

  const chargeW = 120;
  const chargeH = 10;
  const chargeFill = Math.min(1, player.charge / player.maxCharge);
  const barY = H - 38;
  ctx.fillStyle = 'rgba(148, 163, 184, 0.35)';
  ctx.fillRect(18, barY, chargeW, chargeH);
  ctx.fillStyle = '#7af5b5';
  ctx.fillRect(18, barY, chargeW * chargeFill, chargeH);

  const scatterFill = player.scatterTimer > 0 ? Math.max(0, player.scatterTimer / player.scatterDuration) : 0;
  ctx.fillStyle = 'rgba(148, 163, 184, 0.35)';
  ctx.fillRect(18, barY + 14, chargeW, chargeH);
  ctx.fillStyle = '#ffd166';
  ctx.fillRect(18, barY + 14, chargeW * scatterFill, chargeH);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.fillText('CHARGE', 18, H - 58);
  ctx.fillText(player.scatterTimer > 0 ? 'SCATTER' : 'PIERCE', 18, H - 40);
  ctx.restore();
}

function render() {
  drawBackground();
  drawPickups();
  drawEnemies();
  drawProjectiles();
  drawParticles();
  drawPlayer();
  drawHudText();
}

function resetRun() {
  SoundEngine.gameOver();
  player.x = W / 2;
  player.y = H / 2;
  player.hp = player.maxHp;
  player.xp = 0;
  player.level = 1;
  player.speed = 220;
  player.damage = 18;
  player.cooldown = 0.35;
  player.weapon = 'Pierce Bolt';
  player.charge = 0;
  player.scatterTimer = 0;
  projectiles.length = 0;
  enemies.length = 0;
  pickups.length = 0;
  particles.length = 0;
  time = 0;
  spawnTimer = 0;
  updateUI();
}

function loop(now) {
  const dt = Math.min(0.033, (now - lastTime) / 1000);
  lastTime = now;
  update(dt);
  render();
  requestAnimationFrame(loop);
}

const loadingScreen = document.getElementById('loadingScreen');
const startScreen = document.getElementById('startScreen');
const playBtn = document.getElementById('playBtn');

function startGame() {
   isPaused = false;
   loadingScreen?.classList.add('hidden');
   setTimeout(() => loadingScreen?.remove(), 420);
   document.documentElement.requestFullscreen?.();
}

playBtn?.addEventListener('click', () => {
   startScreen?.classList.add('hidden');
   loadingScreen?.classList.remove('hidden');
   setTimeout(startGame, 1300);
});

syncShootControls();
syncSoundSwitch();
updateUI();
requestAnimationFrame(loop);