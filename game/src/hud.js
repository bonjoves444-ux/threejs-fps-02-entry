// HUD: every DOM panel the player reads — minimap, score bar, kill feed, vitals,
// weapon block, crosshair spread, banners, buy menu and scoreboard. All updates
// go through here so the game logic never touches the DOM directly, and the
// minimap is drawn from the same map data the bots walk on.
import { MAP } from './map.js';
import { WEAPONS, GRENADES, ARMOUR_PRICE, KIT_PRICE } from './weapons.js';

const $ = (id) => document.getElementById(id);

export class Hud {
  constructor() {
    this.mapCanvas = $('minimap');
    this.mapCtx = this.mapCanvas.getContext('2d');
    this.feedEl = $('feed');
    this.callEl = $('callouts');
    this.xhair = $('xhair');
    this.hitEl = $('hitmark');
    this.vigEl = $('vig');
    this.flashEl = $('flash');
    this.bannerEl = $('banner');
    this.bannerTimer = 0;
    this.feedItems = [];
    this.callItems = [];
    this.buildShop();
  }
  fmtTime(sec) {
    sec = Math.max(0, Math.ceil(sec));
    return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  }
  setScore(defScore, atkScore, round, maxRounds, timer, pipsDef, pipsAtk, phase) {
    $('scoreDef').textContent = defScore;
    $('scoreAtk').textContent = atkScore;
    $('roundLbl').textContent = phase === 'buy' ? `BUY · ROUND ${round} / ${maxRounds}` : `ROUND ${round} / ${maxRounds}`;
    $('timer').textContent = this.fmtTime(timer);
    $('timer').style.color = timer <= 10 && phase === 'round' ? '#ff6b61' : '#fff';
    this.pips($('pipsDef'), pipsDef);
    this.pips($('pipsAtk'), pipsAtk);
  }
  pips(el, won) {
    let html = '';
    for (let i = 0; i < 9; i++) html += `<i class="${i < won ? 'won' : ''}"></i>`;
    el.innerHTML = html;
  }
  setVitals(player) {
    $('hp').textContent = Math.ceil(player.health);
    $('hpbar').firstElementChild.style.width = `${Math.max(0, player.health)}%`;
    $('ar').textContent = Math.ceil(player.armour);
    $('arbar').firstElementChild.style.width = `${Math.min(100, player.armour)}%`;
    $('money').textContent = `$${player.money.toLocaleString()}`;
    $('prole').textContent = player.team === 'def' ? 'DOCKERS — DEFEND' : 'RUNNERS — ATTACK';
    $('objective').textContent = player.team === 'def'
      ? 'Hold the sites. Defuse the charge if it is planted.'
      : 'Plant the charge at Site A or Site B, then defend it.';
  }
  setWeapon(player) {
    const w = player.weapon();
    if (!w) return;
    $('wname').textContent = w.def.name;
    $('wmode').textContent = w.def.mode + (player.reloading ? ' · RELOADING…' : '');
    $('ammo').innerHTML = `${w.mag} <small>/ ${w.reserve}</small>`;
    const p = player.slots.primary, s = player.slots.secondary;
    let slots = '';
    if (s) slots += `<span class="${player.slot === 'secondary' ? 'on' : ''}">1 ${s.def.name.split(' ')[0]}</span>`;
    if (p) slots += `<span class="${player.slot === 'primary' ? 'on' : ''}">2 ${p.def.name.split(' ')[0]}</span>`;
    $('slots').innerHTML = slots;
    const g = player.grenades;
    $('nades').innerHTML =
      `FRAG <b>${g.frag}</b> [3] · FLASH <b>${g.flash}</b> [4] · SMOKE <b>${g.smoke}</b> [5]` +
      (player.hasKit ? ` · <b style="color:#7cc8ff">DEFUSE KIT</b>` : '');
  }
  // Crosshair gap grows with the live spread, so the player sees accuracy.
  setCrosshair(spreadPx, scoped) {
    $('scope').style.display = scoped ? 'block' : 'none';
    const gap = Math.round(4 + spreadPx);
    const parts = this.xhair.children;
    parts[0].style.top = `${-gap - 9}px`; parts[1].style.top = `${gap}px`;
    parts[2].style.left = `${-gap - 9}px`; parts[3].style.left = `${gap}px`;
  }
  hitmarker(head) {
    this.hitEl.style.opacity = '1';
    this.hitEl.classList.toggle('hs', !!head);
    clearTimeout(this._hmT);
    this._hmT = setTimeout(() => { this.hitEl.style.opacity = '0'; }, 130);
  }
  damageFlash(amount) {
    this.vigEl.style.opacity = Math.min(1, 0.35 + amount / 90);
    clearTimeout(this._vgT);
    this._vgT = setTimeout(() => { this.vigEl.style.opacity = '0'; }, 320);
  }
  flashbang(strength) {
    this.flashEl.style.opacity = String(Math.min(1, strength));
    clearTimeout(this._flT);
    this._flT = setTimeout(() => { this.flashEl.style.opacity = '0'; }, 500);
  }
  banner(title, sub, seconds = 2.6) {
    $('bannerTitle').textContent = title;
    $('bannerSub').textContent = sub;
    this.bannerEl.style.display = 'block';
    this.bannerTimer = seconds;
  }
  tickBanner(dt) {
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.bannerEl.style.display = 'none';
    }
  }
  showProgress(label, frac) {
    $('progress').style.display = 'block';
    $('progLbl').textContent = label;
    $('progFill').style.width = `${Math.round(frac * 100)}%`;
  }
  hideProgress() { $('progress').style.display = 'none'; }
  hint(text) {
    const h = $('hint');
    if (!text) { h.classList.add('hidden'); return; }
    h.textContent = text; h.classList.remove('hidden');
  }
  addFeed(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    this.feedEl.prepend(div);
    this.feedItems.push(div);
    while (this.feedItems.length > 5) this.feedItems.shift().remove();
    setTimeout(() => { div.style.opacity = '0.25'; }, 6000);
  }
  callout(name, text, team) {
    const div = document.createElement('div');
    div.className = team === 'atk' ? 'atk' : '';
    div.innerHTML = `<b>${name}:</b> ${text}`;
    this.callEl.prepend(div);
    this.callItems.push(div);
    while (this.callItems.length > 4) this.callItems.shift().remove();
    setTimeout(() => div.remove(), 7000);
  }
  // Minimap: quay outline, water edge, container blocks, site zones with letters,
  // the player as a white wedge, teammates teal, enemies only when seen, the bomb
  // carrier with a yellow dot and the planted charge blinking.
  drawMinimap(player, bots, bomb, now) {
    const ctx = this.mapCtx, W = this.mapCanvas.width, H = this.mapCanvas.height;
    const sx = (x) => ((x - MAP.minX) / (MAP.maxX - MAP.minX)) * W;
    const sy = (z) => ((z - MAP.minZ) / (MAP.maxZ - MAP.minZ)) * H;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0e1a20'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#1d4b55'; ctx.fillRect(0, 0, sx(-30) + 2, H); // water west
    ctx.fillStyle = '#8f887c'; ctx.fillRect(sx(-30), 0, W - sx(-30), H); // quay
    ctx.fillStyle = '#6b655c'; ctx.fillRect(sx(-4), 0, sx(8) - sx(-4), H); // service road
    ctx.fillStyle = '#3a4a52';
    for (const b of window.__quayColliders || []) {
      // Draw every solid box; skip only the perimeter and edge walls.
      if (b.minX < -30.4 || b.maxX > 30.4 || b.minZ < -20.4 || b.maxZ > 20.4) continue;
      ctx.fillRect(sx(b.minX), sy(b.minZ), Math.max(2, sx(b.maxX) - sx(b.minX)), Math.max(2, sy(b.maxZ) - sy(b.minZ)));
    }
    // Site zones.
    for (const s of [MAP.siteA, MAP.siteB]) {
      ctx.strokeStyle = '#ffb02e'; ctx.lineWidth = 2;
      ctx.strokeRect(sx(s.minX), sy(s.minZ), sx(s.maxX) - sx(s.minX), sy(s.maxZ) - sy(s.minZ));
      ctx.fillStyle = '#ffb02e'; ctx.font = '900 26px Arial'; ctx.textAlign = 'center';
      ctx.fillText(s === MAP.siteA ? 'A' : 'B', sx(s.x), sy(s.z) + 9);
    }
    const dot = (x, z, color, r = 4) => {
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(sx(x), sy(z), r, 0, Math.PI * 2); ctx.fill();
    };
    for (const b of bots) {
      if (!b.alive) continue;
      const sameTeam = b.team === player.team;
      const seen = sameTeam || (now - b.seenAt < 3 && b.team !== player.team);
      if (sameTeam) dot(b.pos.x, b.pos.z, '#2dd4c4', b.carrier ? 5 : 4);
      else if (seen) dot(b.pos.x, b.pos.z, '#ff7a1a', 4);
      if (b.carrier && b.team === 'atk') { ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sx(b.pos.x), sy(b.pos.z), 8, 0, Math.PI * 2); ctx.stroke(); }
    }
    if (bomb.state === 'planted') {
      const blink = Math.floor(now * 3) % 2 === 0;
      dot(bomb.x, bomb.z, blink ? '#ff3b30' : '#ffd700', 6);
    }
    // Player wedge, rotated by yaw.
    ctx.save();
    ctx.translate(sx(player.pos.x), sy(player.pos.z));
    ctx.rotate(Math.atan2(Math.sin(player.yaw), -Math.cos(player.yaw)) + Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  buildShop() {
    const shop = $('shop');
    const items = [];
    for (const id of ['smg', 'carbine', 'shotgun', 'scoped']) {
      const w = WEAPONS[id];
      items.push({ key: id, label: `${w.name}`, sub: `${w.mode} · ${w.mag} rounds`, price: w.price, kind: 'weapon' });
    }
    items.push({ key: 'armour', label: 'KEVLAR + HELM', sub: 'Halves body damage', price: ARMOUR_PRICE, kind: 'armour' });
    items.push({ key: 'kit', label: 'DEFUSE KIT', sub: 'Defuse in half the time (Dockers)', price: KIT_PRICE, kind: 'kit' });
    for (const id of ['frag', 'flash', 'smoke']) {
      const g = GRENADES[id];
      items.push({ key: id, label: `${g.name} GRENADE`, sub: `Throw with key ${g.key}`, price: g.price, kind: 'grenade' });
    }
    shop.innerHTML = items.map((it) =>
      `<div class="item" data-key="${it.key}" data-kind="${it.kind}"><span>${it.label}<br><span class="k">${it.sub}</span></span><b>$${it.price.toLocaleString()}</b></div>`).join('');
  }
  showBuy(money) { $('buyMoney').textContent = `$${money.toLocaleString()}`; $('buy').classList.remove('hidden'); }
  hideBuy() { $('buy').classList.add('hidden'); }
  showScores(rowsHtml) { $('scoreTable').innerHTML = rowsHtml; $('scores').classList.remove('hidden'); }
  hideScores() { $('scores').classList.add('hidden'); }
  showMenu() { $('menu').classList.remove('hidden'); }
  hideMenu() { $('menu').classList.add('hidden'); }
  showPause() { $('pause').classList.remove('hidden'); }
  hidePause() { $('pause').classList.add('hidden'); }
  error(msg) { $('err').textContent = msg; }
}
