// HUD: every DOM panel the player reads — minimap, score bar, kill feed, vitals,
// weapon block, crosshair spread, banners, buy menu and scoreboard. All updates
// go through here so the game logic never touches the DOM directly, and the
// minimap is drawn from the same map data the bots walk on.
import { MAP } from './map.js';
import { WEAPONS, GRENADES, FLAVOUR, ARMOUR_PRICE, KIT_PRICE } from './weapons.js';

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
  setScore(defScore, atkScore, round, maxRounds, timer, pipsDef, pipsAtk, phase, planted) {
    $('scoreDef').textContent = defScore;
    $('scoreAtk').textContent = atkScore;
    $('roundLbl').textContent = phase === 'buy' ? `BUY · ROUND ${round} / ${maxRounds}` : `ROUND ${round} / ${maxRounds}`;
    $('phaseLbl').textContent = phase === 'buy' ? 'BUY PHASE' : planted ? 'CHARGE PLANTED' : phase === 'round' ? 'LIVE' : 'ROUND OVER';
    $('phaseLbl').style.color = planted ? '#ff6b61' : '#ffb02e';
    $('timer').textContent = this.fmtTime(timer);
    $('timer').style.color = timer <= 10 && phase === 'round' ? '#ff6b61' : '#fff';
    this.pips($('pipsDef'), pipsDef, 7);
    this.pips($('pipsAtk'), pipsAtk, 7);
  }
  pips(el, won, total) {
    let html = '';
    for (let i = 0; i < total; i++) html += `<i class="${i < won ? 'won' : ''}"></i>`;
    el.innerHTML = html;
  }
  setVitals(player) {
    $('hp').textContent = Math.ceil(player.health);
    $('hpbar').firstElementChild.style.width = `${Math.max(0, player.health)}%`;
    $('ar').textContent = Math.ceil(player.armour);
    $('arbar').firstElementChild.style.width = `${Math.min(100, player.armour)}%`;
    $('money').textContent = `$${player.money.toLocaleString()}`;
    $('prole').textContent = player.team === 'def' ? 'DOCKERS — DEFEND' : 'RUNNERS — ATTACK';
    $('chargeChip').classList.toggle('hidden', !player.carrier);
  }
  // The objective line: what you should be doing right now, not just your role.
  setObjective(text) { $('objective').textContent = text; }
  // The zone under the minimap: where you are standing, by name.
  setZone(name) { const el = $('zoneName'); if (el) el.textContent = name; }
  // Buy header: the countdown, the round and the score, above the shop.
  setBuyHead(round, maxRounds, def, atk, team, timer) {
    const el = $('buyHead');
    if (!el) return;
    el.innerHTML = `BUY <b>${this.fmtTime(timer)}</b> · ROUND ${round} / ${maxRounds} · DOCKERS ${def} — ${atk} RUNNERS · YOU: ${team === 'def' ? 'DOCKERS' : 'RUNNERS'}`;
  }
  setWeapon(player) {
    const w = player.weapon();
    if (!w) return;
    $('wname').textContent = w.def.name;
    $('wmode').textContent = w.def.mode + (player.reloading ? ' · RELOADING…' : '');
    if (w.def.melee) $('ammo').innerHTML = '— <small>MELEE</small>';
    else $('ammo').innerHTML = `${w.mag} <small>/ ${w.reserve}</small>`;
    $('ammo').classList.toggle('low', !w.def.melee && w.mag <= Math.max(1, Math.ceil(w.def.mag * 0.25)));
    const p = player.slots.primary, s = player.slots.secondary, m = player.slots.melee;
    let slots = '';
    if (s) slots += `<span class="${player.slot === 'secondary' ? 'on' : ''}">1 ${s.def.name.split(' ')[0]}</span>`;
    if (p) slots += `<span class="${player.slot === 'primary' ? 'on' : ''}">2 ${p.def.name.split(' ')[0]}</span>`;
    if (m) slots += `<span class="${player.slot === 'melee' ? 'on' : ''}">3 KNIFE</span>`;
    $('slots').innerHTML = slots;
    const g = player.grenades;
    $('nades').innerHTML =
      `FRAG <b>${g.frag}</b> [4] · FLASH <b>${g.flash}</b> [5] · SMOKE <b>${g.smoke}</b> [6] · IGNIS <b>${g.fire || 0}</b> [7] · FLARE <b>${g.flare || 0}</b> [8]` +
      (player.hasKit ? ` · <b style="color:#7cc8ff">DEFUSE KIT</b>` : '') +
      (player.helmet ? ` · <b style="color:#7cc8ff">HELM</b>` : '');
  }
  // Crosshair gap grows with the live spread, so the player sees accuracy.
  // Style, colour and size come from settings; scoped rifles hide it entirely.
  setCrosshair(spreadPx, scoped) {
    $('scope').style.display = scoped ? 'block' : 'none';
    const gap = Math.round((4 + spreadPx) * (this._xSize || 1));
    const parts = this.xhair.children;
    const style = this._xStyle || 'cross';
    this.xhair.className = style;
    const col = this._xColor || '#ffffff';
    for (const p of parts) p.style.background = col;
    parts[0].style.top = `${-gap - 9}px`; parts[1].style.top = `${gap}px`;
    parts[2].style.left = `${-gap - 9}px`; parts[3].style.left = `${gap}px`;
  }
  applySettings(s) {
    this._xStyle = s.crosshair; this._xColor = s.crosshairColor; this._xSize = s.crosshairSize;
    this._dmgNums = s.damageNumbers;
  }
  // Bomb timer bar under the score bar, once the charge is planted.
  setBombBar(frac, seconds, site) {
    const bar = $('bombbar');
    if (frac == null) { bar.classList.add('hidden'); return; }
    bar.classList.remove('hidden');
    $('bombFill').style.width = `${Math.max(0, Math.min(100, frac * 100))}%`;
    $('bombLbl').textContent = `CHARGE — SITE ${site} · ${Math.ceil(seconds)}s`;
    bar.classList.toggle('urgent', seconds <= 10);
  }
  // Round history strip: one letter per finished round, W or L from your side.
  setRoundHistory(hist) {
    const el = $('roundhist');
    if (!el) return;
    el.innerHTML = hist.map((h) => `<i class="${h === 'W' ? 'w' : 'l'}">${h}</i>`).join('');
  }
  // Red arc showing the direction the last hit came from (0 = ahead).
  hitDir(angleDeg) {
    const el = $('hitdir');
    if (!el) return;
    el.style.transform = `translate(-50%,-50%) rotate(${angleDeg}deg)`;
    el.style.opacity = '1';
    clearTimeout(this._hdT);
    this._hdT = setTimeout(() => { el.style.opacity = '0'; }, 900);
  }
  // Floating damage number near the crosshair.
  dmgNum(amount, head) {
    if (this._dmgNums === false) return;
    const host = $('dmgnums');
    if (!host) return;
    const d = document.createElement('div');
    d.className = head ? 'dmg hs' : 'dmg';
    d.textContent = Math.round(amount);
    d.style.left = `${(Math.random() - 0.5) * 90}px`;
    d.style.top = `${(Math.random() - 0.5) * 50 - 10}px`;
    host.appendChild(d);
    setTimeout(() => d.remove(), 750);
  }
  // Kill confirm: the hitmarker flashes gold on a kill.
  killConfirm(head) {
    this.hitmarker(head);
    this.hitEl.classList.add('kill');
    clearTimeout(this._kcT);
    this._kcT = setTimeout(() => this.hitEl.classList.remove('kill'), 250);
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
  // Radio: a teammate's line with their role, in the same panel as callouts.
  radio(name, role, text) {
    const div = document.createElement('div');
    div.className = 'radio';
    div.innerHTML = `[RADIO] <b>${name} (${role}):</b> ${text}`;
    this.callEl.prepend(div);
    this.callItems.push(div);
    while (this.callItems.length > 5) this.callItems.shift().remove();
    setTimeout(() => div.remove(), 9000);
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
    const cat = (title) => `<div class="cat">${title}</div>`;
    let n = 0;
    const item = (key, label, sub, flavour, price, kind) =>
      `<div class="item" data-key="${key}" data-kind="${kind}"><span class="num">${++n}</span><span class="grow">${label}<br><span class="k">${sub}</span>${flavour ? ` <span class="fl">· ${flavour}</span>` : ''}</span><b>$${price.toLocaleString()}</b></div>`;
    const w = (id) => {
      const d = WEAPONS[id];
      return item(id, d.name, `${d.mode} · ${d.mag} rounds`, FLAVOUR[id] || '', d.price, 'weapon');
    };
    shop.innerHTML =
      cat('PISTOLS') + w('revolver') +
      item('p9', 'P9 SIDEARM', 'SEMI · 9MM · 12 rounds · owned', FLAVOUR.p9, 0, 'weapon') +
      cat('SMGs') + w('smg') +
      cat('RIFLES') + w('carbine') + w('dmr') + w('scoped') +
      cat('HEAVY') + w('shotgun') + w('lmg') +
      cat('GEAR') +
      item('armour', 'KEVLAR + HELM', 'Halves body damage · helm halves headshots', 'Vest — absorbs half of every hit', ARMOUR_PRICE, 'armour') +
      item('kit', 'DEFUSE KIT', 'Defuse in half the time (Dockers)', 'Half the defuse, twice the nerve', KIT_PRICE, 'kit') +
      cat('GRENADES') +
      ['frag', 'flash', 'smoke', 'fire', 'flare'].map((id) => {
        const g = GRENADES[id];
        return item(id, `${g.name} GRENADE`, `Throw with key ${g.key}`, g.flavour, g.price, 'grenade');
      }).join('');
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
