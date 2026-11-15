// FERRYLINE — Quay 7: a round-based tactical FPS in three.js. Two teams of five
// fight over two charge sites on a golden-hour ferry quay. Rounds are won by
// elimination or by the objective, money is earned each round and spent in a buy
// menu, and gunfire rewards stopping to aim: spread and recoil punish moving and
// spraying, headshots pay more, and the bots rotate, smoke and call out.
//
// Structure: this file owns the game state, the fixed-step loop and combat
// resolution. The map, the player, the bots, the effects, the HUD and the sound
// each live in their own module with one job. The simulation runs at a fixed
// 60 Hz step, decoupled from rendering, with the frame delta clamped so a hitch
// can never teleport a player through a wall.
import * as THREE from 'three';
import { QuayMap, MAP } from './map.js';
import { QuayProps } from './props.js';
import { Player } from './player.js';
import { Bot } from './bots.js';
import { Effects } from './effects.js';
import { FireZones } from './fire.js';
import { Spectator } from './spectator.js';
import { Settings } from './settings.js';
import { Hud } from './hud.js';
import { Sfx } from './audio.js';
import { WEAPONS, GRENADES, KILL_MONEY, WIN_MONEY, LOSS_MONEY, PLANT_MONEY, START_MONEY } from './weapons.js';
import { KILL_REWARD, lossBonus, roundMvp } from './economy.js';
import { mulberry32, clamp, rayBox } from './util.js';
import { PAL } from './palette.js';

const STEP = 1 / 60;
const ROUND_TIME = 105;
const BUY_TIME = 15; // freeze / buy time: shop, then the gate opens
const PLANT_TIME = 3.5;
const DEFUSE_TIME = 5;
const BOMB_TIME = 40;
const WIN_ROUNDS = 9;
const MAX_ROUNDS = 17;
const HALFTIME_ROUND = 9; // sides swap after round 8

const params = new URLSearchParams(location.search);
const SHOT = params.get('shot'); // start | play | buy | plant — staged scenes for screenshots
const SEED = Number(params.get('seed') || 1);

const DOCKER_NAMES = ['Kael', 'Mara', 'Ilya', 'Sef'];
const RUNNER_NAMES = ['Vex', 'Jax', 'Sol', 'Rook', 'Nix'];

export class Game {
  constructor() {
    this.rng = mulberry32(SEED);
    this.sfx = new Sfx();
    this.hud = new Hud();
    this.time = 0;            // game clock, seconds
    this.phase = 'menu';      // menu | buy | round | roundEnd | matchEnd
    this.round = 1;
    this.scoreDef = 0; this.scoreAtk = 0;
    this.roundWinsDef = 0; this.roundWinsAtk = 0;
    this.timer = ROUND_TIME;
    this.buyTimer = BUY_TIME;
    this.endTimer = 0;
    this.paused = false;
    this.frozen = false;      // shot mode: stage the scene, then hold it still
    this.plantProg = 0; this.defuseProg = 0;
    this.botPlantProg = 0; this.botDefuseProg = 0; // bots plant/defuse on their own clock: the player's progress decays when E is released, a bot's must not
    this.bomb = { state: 'carried', x: 0, z: 0, site: 'A', timer: BOMB_TIME, carrier: null, beepAt: 0 };
    this.grenadesFlying = [];
    this.input = { forward: false, back: false, left: false, right: false, jump: false, crouch: false, walk: false, fire: false, aim: false };
    this.actors = [];         // bots + player, for the scoreboard
    this.killsThisRound = new Set();
    this.roundKills = new Map(); // actor -> kills this round (MVP)
    this.roundHistory = [];      // 'W'/'L' per finished round, from your side
    this.lossStreakDef = 0; this.lossStreakAtk = 0; // consecutive losses, for the bonus
    this.planter = null; this.defuser = null; this.lastMvp = null;
    this.swapped = false;        // halftime side swap done
    this.setupScene();
    this.setupInput();
    this.loop = this.loop.bind(this);
    this.acc = 0; this.lastTs = 0;
    window.__game = this; // debug handle: lets a play-test read live state
    requestAnimationFrame(this.loop);
    if (SHOT) this.stageShot(SHOT);
  }

  setupScene() {
    const app = document.getElementById('app');
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.domElement.className = 'webgl';
    app.prepend(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x9cc4de);
    this.scene.fog = new THREE.Fog(PAL.fog, 45, 150);
    this.camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.08, 400);
    this.scene.add(this.camera);
    // Golden-hour light: warm sun low over the water to the west, cool sky fill,
    // and a soft warm bounce from the east so shaded faces never go flat grey.
    const hemi = new THREE.HemisphereLight(0xbfd9e8, 0x8a7a5e, 1.05);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(PAL.sun, 2.4);
    sun.position.set(-45, 26, -12);
    this.scene.add(sun);
    const bounce = new THREE.DirectionalLight(0xffe0b8, 0.6);
    bounce.position.set(40, 22, 18);
    this.scene.add(bounce);
    // Sun disc hanging over the harbour, and a pale sky dome gradient is faked by
    // the background colour plus fog; the disc sells the hour at a glance.
    const disc = new THREE.Mesh(new THREE.CircleGeometry(7, 32),
      new THREE.MeshBasicMaterial({ color: 0xffe9bb, fog: false }));
    disc.position.set(-120, 34, -40); disc.lookAt(0, 10, 0);
    this.scene.add(disc);
    this.map = new QuayMap(this.scene);
    this.props = new QuayProps(this.map, this.scene); // barrels, overlook, sky life
    window.__quayColliders = this.map.colliders; // minimap reads the same boxes
    this.effects = new Effects(this.scene);
    this.fireZones = new FireZones(this.scene);
    this.player = new Player(this.map, this.sfx, this.camera);
    this.spectator = new Spectator(this.camera);
    this.settings = new Settings();
    this.settings.apply(this.player, this.sfx, this.hud, this.renderer);
    const applySettings = () => this.settings.apply(this.player, this.sfx, this.hud, this.renderer);
    this.settings.buildPanel(document.getElementById('pauseSettings'), applySettings);
    this.settings.buildPanel(document.getElementById('menuSettings'), applySettings);
    // Nine bots fill the other nine slots of a 5v5.
    this.bots = [];
    const defNames = [...DOCKER_NAMES], atkNames = [...RUNNER_NAMES];
    for (let i = 0; i < 4; i++) this.bots.push(new Bot(this.map, this.scene, this.rng, i, 'def', defNames[i]));
    for (let i = 0; i < 5; i++) this.bots.push(new Bot(this.map, this.scene, this.rng, 4 + i, 'atk', atkNames[i]));
    this.actors = [this.player, ...this.bots];
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  setupInput() {
    const keymap = {
      KeyW: 'forward', ArrowUp: 'forward', KeyS: 'back', ArrowDown: 'back',
      KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
      Space: 'jump', ControlLeft: 'crouch', KeyC: 'crouch', ShiftLeft: 'walk', ShiftRight: 'walk',
    };
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Tab') { e.preventDefault(); if (this.phase === 'round' || this.phase === 'buy') this.hud.showScores(this.scoreboardHtml()); return; }
      if (keymap[e.code]) { this.input[keymap[e.code]] = true; if (e.code === 'Space') e.preventDefault(); }
      if (e.code === 'KeyR') this.player.startReload(this.time);
      if (e.code === 'KeyB') this.toggleBuy();
      if (e.code === 'KeyF') this.player.inspectUntil = this.time + 0.9;
      if (e.code === 'Digit1') this.player.switchSlot('secondary');
      if (e.code === 'Digit2') this.player.switchSlot('primary');
      if (e.code === 'Digit3' || e.code === 'KeyV') this.player.switchSlot('melee');
      if (e.code === 'Digit4') this.throwGrenade('frag');
      if (e.code === 'Digit5') this.throwGrenade('flash');
      if (e.code === 'Digit6') this.throwGrenade('smoke');
      if (e.code === 'Digit7') this.throwGrenade('fire');
      if (e.code === 'KeyE') this.interactHeld = true;
      if (e.code === 'Escape') this.togglePause();
      if (e.code === 'Enter' && this.phase === 'menu') this.startMatch('def');
    });
    window.addEventListener('keyup', (e) => {
      if (keymap[e.code]) this.input[keymap[e.code]] = false;
      if (e.code === 'KeyE') this.interactHeld = false;
      if (e.code === 'Tab') this.hud.hideScores();
    });
    const cv = this.renderer.domElement;
    cv.addEventListener('mousedown', (e) => {
      if (this.phase !== 'round' && this.phase !== 'buy') return;
      if (!SHOT) this.lockPointer();
      if (e.button === 0) this.input.fire = true;
      if (e.button === 2) this.input.aim = true;
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.input.fire = false;
      if (e.button === 2) this.input.aim = false;
    });
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.addEventListener('wheel', (e) => {
      if (this.phase !== 'round') return;
      this.player.switchSlot(this.player.slot === 'primary' ? 'secondary' : 'primary');
    }, { passive: true });
    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === cv && !this.paused) this.player.addLook(e.movementX, e.movementY);
    });
    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement !== cv && (this.phase === 'round') && !SHOT && !this.paused) this.togglePause();
    });
    document.getElementById('btnDef').addEventListener('click', () => this.startMatch('def'));
    document.getElementById('btnAtk').addEventListener('click', () => this.startMatch('atk'));
    document.getElementById('btnResume').addEventListener('click', () => this.togglePause());
    document.getElementById('btnRestart').addEventListener('click', () => { this.hud.hidePause(); this.startMatch(this.player.team); });
    document.getElementById('shop').addEventListener('click', (e) => {
      const item = e.target.closest('.item');
      if (item) this.buyItem(item.dataset.kind, item.dataset.key);
    });
    this.sfx.ensure();
  }
  lockPointer() {
    try { this.renderer.domElement.requestPointerLock(); } catch { /* headless or denied: play on */ }
  }
  toggleBuy() {
    if (this.phase !== 'buy') return;
    const buy = document.getElementById('buy');
    if (buy.classList.contains('hidden')) { this.hud.showBuy(this.player.money); this.sfx.click(); }
    else this.hud.hideBuy();
  }
  togglePause() {
    if (this.phase !== 'round' && this.phase !== 'buy') return;
    this.paused = !this.paused;
    if (this.paused) { this.hud.showPause(); document.exitPointerLock?.(); }
    else { this.hud.hidePause(); if (!SHOT) this.lockPointer(); }
  }

  // ---------- match and round flow ----------
  startMatch(team) {
    this.player.team = team;
    this.scoreDef = 0; this.scoreAtk = 0; this.round = 1;
    this.roundWinsDef = 0; this.roundWinsAtk = 0;
    this.lossStreakDef = 0; this.lossStreakAtk = 0;
    this.roundHistory = []; this.roundKills = new Map();
    this.planter = null; this.defuser = null; this.lastMvp = null;
    this.swapped = false;
    this.spectator.stop();
    for (const a of this.actors) { a.kills = 0; a.deaths = 0; a.damageDealt = 0; a.money = START_MONEY; }
    this.player.money = START_MONEY;
    this.player.slots = { primary: null, secondary: this.player.freshWeapon('p9'), melee: this.player.freshWeapon('knife') };
    this.player.slot = 'secondary';
    this.player.grenades = { frag: 0, flash: 0, smoke: 0, fire: 0 };
    this.player.armour = 0; this.player.helmet = false; this.player.hasKit = false;
    this.player.buildViewmodel();
    this.hud.hideMenu(); this.hud.hidePause();
    this.sfx.ensure(); this.sfx.startAmbient();
    this.startRound();
  }
  // Halftime: after round 8 the sides swap — Dockers attack, Runners defend —
  // and the loss bonuses reset, same as a real half.
  swapSides() {
    this.swapped = true;
    for (const a of this.actors) {
      if (a === this.player) a.team = a.team === 'def' ? 'atk' : 'def';
      else a.setTeam(a.team === 'def' ? 'atk' : 'def');
    }
    this.lossStreakDef = 0; this.lossStreakAtk = 0;
    this.hud.banner('HALFTIME — SIDES SWAPPED',
      this.player.team === 'atk' ? 'You are Runners now — plant the charge' : 'You are Dockers now — hold the sites', 3.5);
    this.sfx.roundStart();
  }
  startRound() {
    if (this.round === HALFTIME_ROUND && !this.swapped) this.swapSides();
    this.phase = 'buy';
    this.buyTimer = BUY_TIME;
    this.timer = ROUND_TIME;
    this.plantProg = 0; this.defuseProg = 0;
    this.botPlantProg = 0; this.botDefuseProg = 0;
    this.killsThisRound.clear();
    this.roundKills = new Map();
    this.planter = null; this.defuser = null;
    // Bots spend their money before the freeze ends: rifles when rich, an eco
    // sidearm when broke, armour and a kit when the budget allows.
    for (const b of this.bots) b.buyForRound();
    // Bomb: carried by the player when attacking, else by a random attacker bot.
    const attackers = this.bots.filter((b) => b.team === 'atk');
    for (const b of this.bots) b.carrier = false;
    if (this.player.team === 'atk') {
      this.bomb.state = 'carried'; this.bomb.carrier = this.player;
    } else {
      const carrier = attackers[Math.floor(this.rng() * attackers.length)];
      carrier.carrier = true;
      this.bomb.state = 'carried'; this.bomb.carrier = carrier;
    }
    this.bomb.timer = BOMB_TIME;
    // Attackers commit to a site as a group; defenders spread across both.
    const site = this.rng() < 0.5 ? 'A' : 'B';
    for (const b of attackers) b.destSite = site;
    // Spawns: attackers at the terminal gate, defenders around the quay.
    const rSpawn = MAP.runnerSpawn, dSpawn = MAP.dockerSpawn;
    let ri = 0, di = 0;
    const place = (actor, spawn, yaw) => {
      const [x, z] = spawn;
      if (actor === this.player) actor.resetSpawn(x, z, yaw);
      else actor.resetSpawn(x, z, yaw, undefined, this.rng() < 0.4 ? 50 : 0);
    };
    for (const a of this.actors) {
      if (a.team === 'atk') { place(a, rSpawn[ri++ % rSpawn.length], Math.PI / 2); }
      else { place(a, dSpawn[di++ % dSpawn.length], -Math.PI / 2); }
    }
    // Face the attackers toward the quay, the defenders toward the gate.
    this.player.yaw = this.player.team === 'atk' ? Math.PI / 2 : -Math.PI / 2;
    this.hud.showBuy(this.player.money);
    const matchPoint = this.scoreDef === WIN_ROUNDS - 1 || this.scoreAtk === WIN_ROUNDS - 1;
    this.hud.banner(matchPoint ? `MATCH POINT — ROUND ${this.round}` : `ROUND ${this.round} — BUY PHASE`,
      matchPoint
        ? (this.scoreDef === WIN_ROUNDS - 1 ? 'Dockers are one round from the match' : 'Runners are one round from the match')
        : `${BUY_TIME}s freeze — spend your money (B), then the gate opens`, 2.6);
    this.sfx.roundStart();
  }
  endRound(winner, reason) {
    if (this.phase === 'roundEnd' || this.phase === 'matchEnd') return;
    this.phase = 'roundEnd';
    this.endTimer = 4.5;
    this.hud.hideBuy(); this.hud.hideProgress(); this.hud.setBombBar(null);
    if (winner === 'def') { this.scoreDef++; this.roundWinsDef++; }
    else { this.scoreAtk++; this.roundWinsAtk++; }
    // Economy: winners take the round win; losers take a loss bonus that grows
    // with their losing streak, so a broke team can force-buy back.
    if (winner === 'def') { this.lossStreakDef = 0; this.lossStreakAtk++; }
    else { this.lossStreakAtk = 0; this.lossStreakDef++; }
    for (const a of this.actors) {
      if (a.team === winner) a.money += WIN_MONEY;
      else a.money += lossBonus(a.team === 'def' ? this.lossStreakDef : this.lossStreakAtk);
    }
    const mvp = roundMvp(this.actors, this.roundKills, this.planter, this.defuser);
    this.lastMvp = mvp;
    if (mvp) mvp.money += 300; // MVP bonus
    this.roundHistory.push(this.player.team === winner ? 'W' : 'L');
    this.hud.setRoundHistory(this.roundHistory);
    const playerWon = this.player.team === winner;
    this.hud.banner(
      winner === 'def' ? 'DOCKERS WIN THE ROUND' : 'RUNNERS WIN THE ROUND',
      `${reason} · ${this.scoreDef} — ${this.scoreAtk}${mvp ? ` · ★ MVP: ${mvp.name}` : ''}`,
      4.2,
    );
    if (playerWon) this.sfx.roundWin(); else this.sfx.roundLose();
    if (this.bomb.state === 'planted') this.bomb.state = 'done';
  }
  checkMatchEnd() {
    if (this.scoreDef >= WIN_ROUNDS || this.scoreAtk >= WIN_ROUNDS || this.round >= MAX_ROUNDS) {
      this.phase = 'matchEnd';
      const winner = this.scoreDef > this.scoreAtk ? 'def' : 'atk';
      this.hud.banner(winner === 'def' ? 'DOCKERS TAKE THE MATCH' : 'RUNNERS TAKE THE MATCH',
        `Final score ${this.scoreDef} — ${this.scoreAtk} · press Enter or pick a team to play again`, 6);
      setTimeout(() => { if (this.phase === 'matchEnd') this.hud.showMenu(); }, 6000);
      return true;
    }
    return false;
  }

  // ---------- shooting ----------
  // One hitscan shot from `shooter` along `dir` (already spread). Tests the map
  // first, then every living actor's head, body and leg boxes, and takes the
  // nearest hit. Returns the hit actor and whether it was a headshot. maxDist
  // caps the ray — the knife uses it for its 2.2 m reach.
  resolveShot(shooter, ox, oy, oz, dx, dy, dz, weapon, isPlayerShot, maxDist = 90) {
    const dl = Math.hypot(dx, dy, dz) || 1;
    dx /= dl; dy /= dl; dz /= dl;
    let bestT = maxDist, bestActor = null, bestHead = false, bestLeg = false, bestPoint = null;
    const tmp = { x: 0, y: 0, z: 0 };
    for (const b of this.map.colliders) {
      const t = rayBox(ox, oy, oz, dx, dy, dz, b);
      if (t > 0 && t < bestT) { bestT = t; bestActor = null; }
    }
    for (const a of this.actors) {
      if (a === shooter || !a.alive) continue;
      const boxes = [
        { minX: a.pos.x - 0.30, maxX: a.pos.x + 0.30, minY: a.pos.y + 0.75, maxY: a.pos.y + 1.42, minZ: a.pos.z - 0.30, maxZ: a.pos.z + 0.30, zone: 'body' },
        { minX: a.pos.x - 0.20, maxX: a.pos.x + 0.20, minY: a.pos.y + 1.42, maxY: a.pos.y + 1.78, minZ: a.pos.z - 0.20, maxZ: a.pos.z + 0.20, zone: 'head' },
        { minX: a.pos.x - 0.28, maxX: a.pos.x + 0.28, minY: a.pos.y + 0.25, maxY: a.pos.y + 0.75, minZ: a.pos.z - 0.28, maxZ: a.pos.z + 0.28, zone: 'leg' },
      ];
      for (const b of boxes) {
        const t = rayBox(ox, oy, oz, dx, dy, dz, b);
        if (t > 0 && t < bestT) { bestT = t; bestActor = a; bestHead = b.zone === 'head'; bestLeg = b.zone === 'leg'; }
      }
    }
    if (bestT === Infinity) bestT = maxDist;
    tmp.x = ox + dx * bestT; tmp.y = oy + dy * bestT; tmp.z = oz + dz * bestT;
    bestPoint = { x: tmp.x, y: tmp.y, z: tmp.z };
    if (bestActor) {
      const dist = bestT;
      let dmg = weapon.damage;
      if (dist > weapon.range) dmg *= weapon.falloff + (1 - weapon.falloff) * Math.max(0, 1 - (dist - weapon.range) / weapon.range);
      if (bestHead) dmg *= weapon.headMult;
      if (bestActor === this.player) {
        const dealt = this.player.takeDamage(dmg, bestHead, bestLeg);
        this.hud.damageFlash(dealt);
        this.sfx.hurt();
        // Hit-direction arc: where did that shot come from, relative to facing?
        if (shooter && shooter.pos) {
          const wx = shooter.pos.x - this.player.pos.x, wz = shooter.pos.z - this.player.pos.z;
          const worldAng = Math.atan2(-wx, -wz);
          let rel = (worldAng - this.player.yaw) * 180 / Math.PI;
          while (rel > 180) rel -= 360; while (rel < -180) rel += 360;
          this.hud.hitDir(rel);
        }
        if (!this.player.alive) this.onKill(shooter, this.player, bestHead, weapon);
      } else {
        const dealt = bestActor.takeDamage(dmg, bestHead, bestLeg);
        if (shooter) shooter.damageDealt = (shooter.damageDealt || 0) + dealt;
        if (isPlayerShot) {
          this.hud.hitmarker(bestHead);
          if (bestHead) this.sfx.ding(); else this.sfx.hit(bestHead);
          this.hud.dmgNum(dealt, bestHead);
        }
        if (!bestActor.alive) this.onKill(shooter, bestActor, bestHead, weapon);
      }
    } else if (bestT < maxDist) {
      this.effects.sparks(bestPoint, 4);
    }
    return { actor: bestActor, head: bestHead, point: bestPoint, dist: bestT };
  }
  playerShoot() {
    const p = this.player, w = p.weapon();
    if (!w || !p.alive || this.phase !== 'round') return;
    if (p.reloading) return;
    if (this.time - p.lastShotAt < 1 / w.def.fireRate) return;
    const eye = p.eyePos(new THREE.Vector3());
    const fwd = new THREE.Vector3(); this.camera.getWorldDirection(fwd);
    // The knife is a short raycast, not a bullet: silent, no ammo, no tracer.
    if (w.def.melee) {
      p.lastShotAt = this.time;
      this.sfx.knifeSwing();
      const hit = this.resolveShot(p, eye.x, eye.y, eye.z, fwd.x, fwd.y, fwd.z, w.def, true, w.def.range);
      if (hit.actor) { this.sfx.knifeHit(); if (!hit.actor.alive) this.hud.killConfirm(false); }
      return;
    }
    if (w.mag <= 0) { this.sfx.dryFire(); p.lastShotAt = this.time; p.startReload(this.time); return; }
    w.mag--;
    p.lastShotAt = this.time;
    p.bloom = Math.min(w.def.bloomMax, p.bloom + w.def.bloomPerShot);
    // Deterministic recoil pattern: each shot in a burst kicks up and sideways
    // on a fixed curve, so bursts can be learned and pulled down.
    p.shotCount++;
    const pat = w.def.pattern || [[0, 1]];
    const pk = pat[(p.shotCount - 1) % pat.length];
    p.yaw += pk[0] * 0.0016;
    p.recoilPitch += w.def.recoil * pk[1] * (p.scoped ? 0.5 : 1);
    // Muzzle position: just ahead of the viewmodel.
    const muzzle = eye.clone().addScaledVector(fwd, 0.6);
    muzzle.y -= 0.12;
    this.effects.muzzle(muzzle);
    const spread = p.currentSpread();
    const pellets = w.def.pellets || 1;
    for (let i = 0; i < pellets; i++) {
      const dx = fwd.x + (this.rng() - 0.5) * 2 * spread + (this.rng() - 0.5) * spread;
      const dy = fwd.y + (this.rng() - 0.5) * 2 * spread + (this.rng() - 0.5) * spread;
      const dz = fwd.z + (this.rng() - 0.5) * 2 * spread + (this.rng() - 0.5) * spread;
      const hit = this.resolveShot(p, eye.x, eye.y, eye.z, dx, dy, dz, w.def, true);
      this.effects.tracer(muzzle, hit.point, w.def.tracer);
    }
    const dist = 0;
    this.sfx.shot(w.def.sound, dist);
  }
  onKill(killer, victim, head, weapon) {
    victim.deaths++;
    if (killer) {
      killer.kills++;
      this.roundKills.set(killer, (this.roundKills.get(killer) || 0) + 1);
      // Kill money depends on the weapon: a scoped-rifle kill pays $100, a
      // knife kill pays $1500, everything else $300.
      killer.money += KILL_REWARD[weapon && weapon.id] || KILL_MONEY;
      if (killer === this.player) this.hud.killConfirm(head);
    }
    const kName = killer ? killer.name : '—';
    const vName = victim.name;
    this.hud.addFeed(`${kName} <span class="wp">${weapon ? weapon.name : ''}</span> ${head ? '<span class="hs">HS</span> ' : ''}${vName}`);
    // The charge drops where its carrier falls; an attacker picks it up again.
    if (victim === this.bomb.carrier) {
      this.bomb.state = 'dropped'; this.bomb.x = victim.pos.x; this.bomb.z = victim.pos.z;
      this.bomb.carrier = null;
    }
    // Deathcam: the player spectates a living teammate.
    if (victim === this.player) this.spectator.start(this.player, this.actors);
    this.checkRoundEnd();
  }
  checkRoundEnd() {
    if (this.phase !== 'round') return;
    const defAlive = this.actors.some((a) => a.team === 'def' && a.alive);
    const atkAlive = this.actors.some((a) => a.team === 'atk' && a.alive);
    if (!defAlive) this.endRound('atk', 'Runners eliminated the Dockers');
    else if (!atkAlive) this.endRound(this.bomb.state === 'planted' ? 'atk' : 'def', 'Runners eliminated — the charge never went off');
  }

  // ---------- grenades ----------
  throwGrenade(kind) {
    const p = this.player;
    if (this.phase !== 'round' || !p.alive || p.grenades[kind] <= 0) return;
    p.grenades[kind]--;
    const eye = p.eyePos(new THREE.Vector3());
    const fwd = new THREE.Vector3(); this.camera.getWorldDirection(fwd);
    this.grenadesFlying.push({
      kind, x: eye.x, y: eye.y, z: eye.z,
      vx: fwd.x * 15, vy: fwd.y * 15 + 4.5, vz: fwd.z * 15,
      t: 0, fuse: kind === 'frag' ? 1.6 : 1.1, fromPlayer: true,
    });
    this.sfx.click();
  }
  detonate(g) {
    const pos = { x: g.x, y: Math.max(0.2, g.y), z: g.z };
    if (g.kind === 'frag') {
      this.sfx.explosion();
      this.effects.sparks(pos, 40, 6);
      for (const a of this.actors) {
        if (!a.alive) continue;
        const d = Math.hypot(a.pos.x - pos.x, a.pos.z - pos.z);
        if (d < GRENADES.frag.radius) {
          const dmg = GRENADES.frag.damage * (1 - d / (GRENADES.frag.radius * 1.4));
          if (a === this.player) { this.player.takeDamage(dmg, false); this.hud.damageFlash(dmg); }
          else { a.takeDamage(dmg); if (!a.alive) this.onKill(g.fromPlayer ? this.player : null, a, false, { name: 'FRAG' }); }
        }
      }
    } else if (g.kind === 'flash') {
      this.sfx.flashbang();
      this.effects.sparks(pos, 12, 3);
      // Anyone facing the pop inside its radius is blinded; the player sees white.
      for (const a of this.actors) {
        if (!a.alive) continue;
        const d = Math.hypot(a.pos.x - pos.x, (a.pos.y + 1.4) - pos.y, a.pos.z - pos.z);
        if (d > GRENADES.flash.radius) continue;
        if (a === this.player) { this.player.flashUntil = this.time + 1.6; this.hud.flashbang(0.9); }
        else if (a.update) { a.reactUntil = Math.max(a.reactUntil, this.time + 1.8); a.target = null; }
      }
    } else if (g.kind === 'fire') {
      // Ignis: light a fire zone that burns for 7 seconds and denies the area.
      this.fireZones.ignite(pos.x, pos.z);
      this.sfx.fireCrackle();
      this.hud.addFeed(`<span class="hs">IGNIS</span> — fire zone lit`);
    } else {
      // Smoke: three puffs that hang for 14 seconds and block sight for everyone.
      for (let i = 0; i < 3; i++) {
        this.effects.smoke(pos.x + (this.rng() - 0.5) * 2.5, 1.4, pos.z + (this.rng() - 0.5) * 2.5, GRENADES.smoke.radius, GRENADES.smoke.life);
      }
    }
  }

  // ---------- buy menu ----------
  buyItem(kind, key) {
    const p = this.player;
    if (this.phase !== 'buy') return;
    if (kind === 'weapon') {
      if (p.buyWeapon(key)) { this.sfx.buy(); this.hud.showBuy(p.money); this.hud.setWeapon(p); }
    } else if (kind === 'armour') {
      if (p.money >= 650 && p.armour < 100) { p.money -= 650; p.armour = 100; p.helmet = true; this.sfx.buy(); this.hud.showBuy(p.money); }
    } else if (kind === 'kit') {
      if (p.team === 'def' && p.money >= 400 && !p.hasKit) { p.money -= 400; p.hasKit = true; this.sfx.buy(); this.hud.showBuy(p.money); }
    } else if (kind === 'grenade') {
      const g = GRENADES[key];
      if (p.money >= g.price && p.grenades[key] < 3) { p.money -= g.price; p.grenades[key]++; this.sfx.buy(); this.hud.showBuy(p.money); }
    }
    this.hud.setVitals(p); this.hud.setWeapon(p);
  }

  scoreboardHtml() {
    const rows = [...this.actors].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
    let html = '<table><tr><th>PLAYER</th><th>TEAM</th><th>K</th><th>D</th><th>DMG</th><th>$</th><th>MVP</th></tr>';
    for (const a of rows) {
      html += `<tr class="${a === this.player ? 'me' : ''}"><td>${a.name}${a.carrier ? ' ●' : ''}</td><td>${a.team === 'def' ? 'DOCKERS' : 'RUNNERS'}</td><td>${a.kills}</td><td>${a.deaths}</td><td>${Math.round(a.damageDealt || 0)}</td><td>$${(a.money || 0).toLocaleString()}</td><td class="mvp">${a === this.lastMvp ? '★' : ''}</td></tr>`;
    }
    return html + '</table>';
  }

  // ---------- the bot world: what bots ask the game for ----------
  siteByName(name) { return name === 'A' ? MAP.siteA : MAP.siteB; }
  losClear(ax, ay, az, bx, by, bz) {
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const dist = Math.hypot(dx, dy, dz) || 1;
    for (const b of this.map.colliders) {
      const t = rayBox(ax, ay, az, dx, dy, dz, b);
      if (t > 0 && t < dist) return false;
    }
    if (this.effects.smokeBlocks(ax, ay, az, bx, by, bz)) return false;
    return true;
  }
  nearestVisibleEnemy(bot) {
    const eye = bot.eyePos(new THREE.Vector3());
    let best = null, bestD = 55;
    for (const a of this.actors) {
      if (a === bot || a.team === bot.team || !a.alive) continue;
      const chest = new THREE.Vector3(a.pos.x, a.pos.y + 1.2, a.pos.z);
      const d = eye.distanceTo(chest);
      if (d > bestD) continue;
      if (!this.losClear(eye.x, eye.y, eye.z, chest.x, chest.y, chest.z)) continue;
      best = a; bestD = d;
    }
    return best;
  }
  callout(bot, text) { this.hud.callout(bot.name, text, bot.team); }
  botShoot(bot, target, err) {
    const eye = bot.eyePos(new THREE.Vector3());
    const chest = new THREE.Vector3(target.pos.x, target.pos.y + 1.15, target.pos.z);
    const head = new THREE.Vector3(target.pos.x, target.pos.y + 1.6, target.pos.z);
    // Bots aim at the chest, and sometimes at the head when the target is still.
    const aimAt = (target.vel && Math.hypot(target.vel.x, target.vel.z) < 1 && this.rng() < 0.25) ? head : chest;
    const dx = aimAt.x - eye.x, dy = aimAt.y - eye.y, dz = aimAt.z - eye.z;
    const dl = Math.hypot(dx, dy, dz) || 1;
    const spread = err;
    const ndx = dx / dl + (this.rng() - 0.5) * 2 * spread;
    const ndy = dy / dl + (this.rng() - 0.5) * 2 * spread;
    const ndz = dz / dl + (this.rng() - 0.5) * 2 * spread;
    const hit = this.resolveShot(bot, eye.x, eye.y, eye.z, ndx, ndy, ndz, bot.weapon.def, false);
    const muzzle = eye.clone(); muzzle.y -= 0.1;
    this.effects.tracer(muzzle, hit.point, bot.weapon.def.tracer);
    this.effects.muzzle(muzzle);
    const dist = eye.distanceTo(chest);
    this.sfx.shot(bot.weapon.def.sound, dist);
  }
  botThrowSmoke(bot, x, z) {
    for (let i = 0; i < 3; i++) {
      this.effects.smoke(x + (this.rng() - 0.5) * 3, 1.4, z + (this.rng() - 0.5) * 3, GRENADES.smoke.radius, GRENADES.smoke.life);
    }
    this.hud.callout(bot.name, 'smoke out — pushing the site!', bot.team);
  }
  botThrowFlash(bot, x, y, z) {
    this.grenadesFlying.push({ kind: 'flash', x, y, z, vx: 0, vy: 0, vz: 0, t: 0, fuse: 0.4, fromPlayer: false });
  }
  botThrowFire(bot, x, z) {
    this.fireZones.ignite(x, z);
    this.sfx.fireCrackle();
    this.hud.callout(bot.name, 'Ignis out — that choke is burning!', bot.team);
  }
  botPlant(bot, dt) {
    this.botPlantProg += dt / PLANT_TIME;
    this.hud.showProgress(`${bot.name.toUpperCase()} IS PLANTING THE CHARGE…`, this.botPlantProg);
    if (Math.floor(this.botPlantProg * 10) !== Math.floor((this.botPlantProg - dt / PLANT_TIME) * 10)) this.sfx.beep();
    if (this.botPlantProg >= 1) {
      this.bomb.state = 'planted'; this.bomb.x = bot.pos.x; this.bomb.z = bot.pos.z;
      this.bomb.site = bot.destSite; this.bomb.timer = BOMB_TIME; this.bomb.beepAt = 0;
      this.botPlantProg = 0; this.hud.hideProgress();
      this.planter = bot;
      this.sfx.plant();
      this.hud.banner('CHARGE PLANTED', `Site ${this.bomb.site} — ${this.player.team === 'def' ? 'defuse it!' : 'defend it!'}`, 3);
      this.hud.addFeed(`<span class="hs">CHARGE PLANTED</span> · SITE ${this.bomb.site}`);
      if (this.bomb.carrier === this.player) this.player.money += PLANT_MONEY;
      if (bot === this.bomb.carrier) bot.money += PLANT_MONEY;
    }
  }
  botDefuse(bot, dt) {
    const need = bot.hasKit ? DEFUSE_TIME / 2 : DEFUSE_TIME; // a kit halves defuse time
    this.botDefuseProg += dt / need;
    this.hud.showProgress(`${bot.name.toUpperCase()} IS DEFUSING…`, this.botDefuseProg);
    if (this.botDefuseProg >= 1) {
      this.bomb.state = 'done'; this.botDefuseProg = 0; this.hud.hideProgress();
      this.defuser = bot;
      this.sfx.defuse();
      this.endRound('def', 'Dockers defused the charge');
    }
  }

  // ---------- per-frame simulation ----------
  step(dt) {
    this.time += dt;
    if (this.phase === 'buy') {
      this.buyTimer -= dt;
      if (this.buyTimer <= 0) {
        this.phase = 'round'; this.hud.hideBuy();
        this.hud.banner(`ROUND ${this.round} — GO`, this.player.team === 'atk' ? 'Take a site and plant' : 'Hold both sites', 1.6);
      }
    } else if (this.phase === 'round') {
      if (this.bomb.state !== 'planted') this.timer -= dt;
      else {
        this.bomb.timer -= dt;
        if (this.time - this.bomb.beepAt > Math.max(0.25, this.bomb.timer / 40)) { this.bomb.beepAt = this.time; this.sfx.beep(this.bomb.timer < 8); }
        if (this.bomb.timer <= 0) {
          // Detonation: flash, smoke and a damage radius that kills the careless.
          this.sfx.explosion();
          this.effects.explosion({ x: this.bomb.x, y: 1, z: this.bomb.z });
          for (const a of this.actors) {
            if (!a.alive) continue;
            const d = Math.hypot(a.pos.x - this.bomb.x, a.pos.z - this.bomb.z);
            if (d < 12) {
              const dmg = 200 * (1 - d / 14);
              if (a === this.player) { this.player.takeDamage(dmg, false, false); this.hud.damageFlash(dmg); }
              else a.takeDamage(dmg, false, false);
              if (!a.alive) this.onKill(null, a, false, { name: 'CHARGE', id: 'FRAG' });
            }
          }
          this.endRound('atk', 'The charge detonated at Site ' + this.bomb.site);
        }
      }
      if (this.timer <= 0 && this.bomb.state !== 'planted') this.endRound('def', 'Time — the charge never went off');
      // Bomb pickup: a dropped charge is collected by walking over it.
      if (this.bomb.state === 'dropped') {
        for (const a of this.actors) {
          if (a.team !== 'atk' || !a.alive) continue;
          if (Math.hypot(a.pos.x - this.bomb.x, a.pos.z - this.bomb.z) < 1.4) {
            this.bomb.state = 'carried'; this.bomb.carrier = a; a.carrier = true;
            if (a === this.player) this.hud.addFeed('You picked up the <span class="hs">CHARGE</span>');
            break;
          }
        }
      }
    } else if (this.phase === 'roundEnd') {
      this.endTimer -= dt;
      // The round is over: the deathcam goes free so the player can watch.
      if (this.spectator.active && !this.spectator.free) this.spectator.setFree();
      if (this.endTimer <= 0) {
        if (this.checkMatchEnd()) return;
        this.round++;
        this.startRound();
      }
    }
    // Player. During the buy freeze the player can shop but not move.
    const p = this.player;
    const moveInput = this.phase === 'buy'
      ? { ...this.input, forward: false, back: false, left: false, right: false, jump: false, crouch: false }
      : this.input;
    if (p.alive && (this.phase === 'round' || this.phase === 'buy')) {
      p.aiming = this.input.aim && p.weapon() && (p.weapon().def.scoped || p.weapon().def.ads);
      this.camera.fov = p.scoped ? 32 : p.aiming ? 55 : this.settings.get('fov');
      this.camera.updateProjectionMatrix();
      p.update(dt, moveInput, this.time);
      if (this.time - p.lastShotAt > 0.5) p.shotCount = 0; // burst resets
      if (p.reloading && this.time >= p.reloadUntil) p.finishReload();
      if (this.input.fire && this.phase === 'round') this.playerShoot();
      if (this.time < p.flashUntil) this.hud.flashbang(0.85);
    } else if (!p.alive && (this.phase === 'round' || this.phase === 'roundEnd')) {
      // Dead: spectate a teammate, or fly the free camera after the round ends.
      this.spectator.update(dt);
    }
    // Plant / defuse by holding E.
    if (this.phase === 'round' && this.interactHeld && p.alive) {
      if (p.team === 'atk' && this.bomb.carrier === p) {
        const site = this.bomb.state === 'carried' ? (p.pos.x < 0 ? MAP.siteA : MAP.siteB) : null;
        const inSite = site && p.pos.x >= site.minX && p.pos.x <= site.maxX && p.pos.z >= site.minZ && p.pos.z <= site.maxZ;
        if (inSite) {
          this.plantProg += dt / PLANT_TIME;
          this.hud.showProgress('PLANTING CHARGE…  (hold E)', this.plantProg);
          if (this.plantProg >= 1) {
            this.bomb.state = 'planted'; this.bomb.x = p.pos.x; this.bomb.z = p.pos.z;
            this.bomb.site = site === MAP.siteA ? 'A' : 'B'; this.bomb.timer = BOMB_TIME; this.bomb.beepAt = 0;
            this.plantProg = 0; this.hud.hideProgress();
            this.planter = p;
            p.money += PLANT_MONEY; this.sfx.plant();
            this.hud.banner('CHARGE PLANTED', `Site ${this.bomb.site} — defend it!`, 3);
          }
        } else { this.plantProg = Math.max(0, this.plantProg - dt * 2); this.hud.hideProgress(); }
      } else if (p.team === 'def' && this.bomb.state === 'planted') {
        const d = Math.hypot(p.pos.x - this.bomb.x, p.pos.z - this.bomb.z);
        if (d < 2.2) {
          const need = p.hasKit ? DEFUSE_TIME / 2 : DEFUSE_TIME;
          this.defuseProg += dt / need;
          this.hud.showProgress(p.hasKit ? 'DEFUSING…  (kit — half time)' : 'DEFUSING…  (hold E)', this.defuseProg);
          if (this.defuseProg >= 1) {
            this.bomb.state = 'done'; this.defuseProg = 0; this.hud.hideProgress();
            this.defuser = p;
            this.sfx.defuse(); this.endRound('def', 'You defused the charge');
          }
        } else { this.defuseProg = Math.max(0, this.defuseProg - dt * 2); this.hud.hideProgress(); }
      }
    } else if (this.phase === 'round') {
      this.plantProg = Math.max(0, this.plantProg - dt * 2);
      this.defuseProg = Math.max(0, this.defuseProg - dt * 2);
      if (!this.interactHeld) this.hud.hideProgress();
    }
    // Bots. Frozen during the buy phase, like everyone else.
    if (this.phase === 'round') {
      for (const b of this.bots) b.update(dt, this.time, this);
    }
    // Grenades in flight.
    for (let i = this.grenadesFlying.length - 1; i >= 0; i--) {
      const g = this.grenadesFlying[i];
      g.t += dt;
      g.vy -= 12 * dt;
      g.x += g.vx * dt; g.y += g.vy * dt; g.z += g.vz * dt;
      if (g.y <= 0.1) { g.y = 0.1; g.vy *= -0.35; g.vx *= 0.6; g.vz *= 0.6; }
      if (g.t >= g.fuse) { this.detonate(g); this.grenadesFlying.splice(i, 1); }
    }
    // HUD.
    const phase = this.phase === 'buy' ? 'buy' : this.phase === 'round' ? 'round' : 'round';
    this.hud.setScore(this.scoreDef, this.scoreAtk, this.round, MAX_ROUNDS,
      this.phase === 'buy' ? this.buyTimer : this.bomb.state === 'planted' ? this.bomb.timer : this.timer,
      this.roundWinsDef, this.roundWinsAtk, phase);
    this.hud.setBombBar(this.bomb.state === 'planted' ? this.bomb.timer / BOMB_TIME : null, this.bomb.timer, this.bomb.site);
    this.hud.setVitals(p);
    this.hud.setWeapon(p);
    this.hud.setCrosshair(p.currentSpread() * 900, p.scoped);
    this.hud.drawMinimap(p, this.bots, this.bomb, this.time);
    this.hud.tickBanner(dt);
    // Context hint under the crosshair.
    let hint = '';
    if (this.phase === 'round' && p.alive) {
      if (p.team === 'atk' && this.bomb.carrier === p) {
        const inA = p.pos.x >= MAP.siteA.minX && p.pos.x <= MAP.siteA.maxX && p.pos.z >= MAP.siteA.minZ && p.pos.z <= MAP.siteA.maxZ;
        const inB = p.pos.x >= MAP.siteB.minX && p.pos.x <= MAP.siteB.maxX && p.pos.z >= MAP.siteB.minZ && p.pos.z <= MAP.siteB.maxZ;
        if (inA || inB) hint = 'HOLD E — PLANT THE CHARGE';
      } else if (p.team === 'def' && this.bomb.state === 'planted' && Math.hypot(p.pos.x - this.bomb.x, p.pos.z - this.bomb.z) < 2.2) {
        hint = 'HOLD E — DEFUSE THE CHARGE';
      } else if (this.bomb.state === 'planted') hint = `CHARGE PLANTED — SITE ${this.bomb.site} · ${Math.ceil(this.bomb.timer)}s`;
    }
    this.hud.hint(hint);
    // Fire zones burn, and the sky lives: clouds, gulls, crane, flags, water.
    this.fireZones.update(dt, this.time, this.actors, (a, dmg) => {
      if (a === this.player) { this.player.takeDamage(dmg, false, false); this.hud.damageFlash(dmg); }
      else a.takeDamage(dmg, false, false);
      if (!a.alive) this.onKill(null, a, false, { name: 'IGNIS', id: 'IGNIS' });
    });
    this.props.update(dt, this.time);
    this.effects.update(dt);
  }

  loop(ts) {
    requestAnimationFrame(this.loop);
    const dtMs = this.lastTs ? ts - this.lastTs : 16;
    this.lastTs = ts;
    if (!this.paused && !this.frozen) {
      this.acc += Math.min(dtMs / 1000, 0.1);
      let n = 0;
      while (this.acc >= STEP && n < 5) { this.step(STEP); this.acc -= STEP; n++; }
      if (n === 5) this.acc = 0; // drop backlog after a hitch rather than spiral
    }
    this.renderer.render(this.scene, this.camera);
  }

  // ---------- staged screenshot scenes ----------
  // ?shot= picks a frozen, fully-HUD'd moment so the screenshots are real renders
  // of the game's own code: the menu, a mid-firefight, the buy phase, a plant,
  // the scoreboard, and a look down the mid connector.
  stageShot(kind) {
    const stage = () => {
      if (kind === 'start') {
        this.phase = 'menu';
        this.camera.position.set(14, 9, 18);
        this.camera.lookAt(-8, 1, -6);
        this.hud.showMenu();
      } else if (kind === 'buy') {
        this.startMatch('def');
        this.round = 3; this.scoreDef = 2; this.scoreAtk = 1;
        this.player.money = 3850;
        this.player.buyWeapon('carbine');
        this.player.money = 3850;
        this.player.grenades = { frag: 1, flash: 1, smoke: 1, fire: 1 };
        this.hud.showBuy(this.player.money);
        this.hud.bannerEl.style.display = 'none'; this.hud.bannerTimer = 0;
        // Face the ferry and the water so the shop's backdrop is bright, not a wall.
        this.player.yaw = Math.PI / 2;
        this.camera.position.set(this.player.pos.x, 1.62, this.player.pos.z);
        this.camera.rotation.set(0, this.player.yaw, 0, 'YXZ');
      } else if (kind === 'plant') {
        this.startMatch('atk');
        this.phase = 'round';
        this.hud.hideBuy();
        this.hud.bannerEl.style.display = 'none'; this.hud.bannerTimer = 0;
        this.round = 5; this.scoreDef = 2; this.scoreAtk = 2; this.timer = 47;
        this.player.resetSpawn(-21, -13, -Math.PI / 2);
        this.player.money = 5000;
        this.player.buyWeapon('carbine');
        this.player.money = 3850;
        this.plantProg = 0.62;
        this.hud.showProgress('PLANTING CHARGE…  (hold E)', 0.62);
        const guard = this.bots.find((b) => b.team === 'def');
        guard.resetSpawn(-15.5, -8.5, -2.26, 'carbine', 50);
        guard.mesh.position.set(-15.5, 0, -8.5); guard.mesh.rotation.y = -2.26;
        const mate = this.bots.find((b) => b.team === 'atk' && b !== this.bomb.carrier);
        if (mate) { mate.resetSpawn(-24, -10, Math.PI / 2, 'smg', 0); mate.mesh.position.set(-24, 0, -10); }
        this.camera.position.set(this.player.pos.x, 1.62, this.player.pos.z);
        this.camera.rotation.set(-0.06, this.player.yaw, 0, 'YXZ');
      } else if (kind === 'scores') {
        // Tab scoreboard: K/D, damage, money, MVP star and the round history.
        this.startMatch('def');
        this.phase = 'roundEnd'; this.endTimer = 4.5; // stay on this round: a 0 timer would advance to round 9 and swap sides
        this.round = 8; this.scoreDef = 5; this.scoreAtk = 3; this.timer = 62;
        this.roundWinsDef = 5; this.roundWinsAtk = 3;
        this.roundHistory = ['W', 'L', 'W', 'W', 'L', 'W', 'W'];
        this.player.kills = 12; this.player.deaths = 4; this.player.damageDealt = 1450; this.player.money = 5200;
        this.lastMvp = this.player;
        const stats = { Kael: [9, 5, 1180, 4300], Mara: [7, 6, 940, 2100], Ilya: [5, 7, 620, 1750], Sef: [4, 6, 510, 2900], Vex: [10, 6, 1320, 3600], Jax: [6, 8, 780, 1200], Sol: [5, 7, 690, 2400], Rook: [3, 9, 410, 900], Nix: [4, 8, 530, 1500] };        for (const b of this.bots) {
          const s = stats[b.name] || [2, 5, 300, 1000];
          b.kills = s[0]; b.deaths = s[1]; b.damageDealt = s[2]; b.money = s[3];
        }
        this.player.resetSpawn(-20, 16, 0.08);
        this.camera.position.set(14, 9, 18);
        this.camera.lookAt(-8, 1, -6);
        this.hud.hideBuy();
        this.hud.showScores(this.scoreboardHtml());
        this.hud.setRoundHistory(this.roundHistory);
        this.hud.bannerEl.style.display = 'none'; this.hud.bannerTimer = 0;
      } else if (kind === 'mid') {
        // Down the new mid connector: window in the north wall, an enemy at the
        // far mouth, smoke and an Ignis fire zone lighting the tunnel.
        this.startMatch('def');
        this.phase = 'round';
        this.hud.hideBuy();
        this.hud.bannerEl.style.display = 'none'; this.hud.bannerTimer = 0;
        this.round = 3; this.scoreDef = 1; this.scoreAtk = 1; this.timer = 88;
        this.roundWinsDef = 1; this.roundWinsAtk = 1;
        this.player.resetSpawn(2, -6, -Math.PI / 2);
        this.player.health = 100; this.player.armour = 50; this.player.money = 4200;
        this.player.buyWeapon('carbine');
        this.player.money = 4200;
        const w = this.player.weapon(); w.mag = 22; w.reserve = 75;
        this.player.grenades = { frag: 1, flash: 1, smoke: 1, fire: 1 };
        const e1 = this.bots.find((b) => b.team === 'atk' && b.name === 'Vex');
        e1.resetSpawn(13.5, -6, Math.PI / 2, 'carbine', 50);
        e1.mesh.position.set(13.5, 0, -6); e1.mesh.rotation.y = Math.PI / 2;
        const e2 = this.bots.find((b) => b.team === 'atk' && b.name === 'Jax');
        e2.resetSpawn(11, -7.2, Math.PI * 0.8, 'smg', 0);
        e2.mesh.position.set(11, 0, -7.2); e2.mesh.rotation.y = Math.PI * 0.8;
        this.fireZones.ignite(9, -5.2);
        this.effects.smoke(16.5, 1.4, -6, 3, 14);
        const eye = this.player.eyePos(new THREE.Vector3());
        this.effects.tracer({ x: eye.x + 0.3, y: eye.y - 0.15, z: eye.z - 0.5 }, { x: 13.5, y: 1.2, z: -6 });
        this.camera.position.set(this.player.pos.x, 1.62, this.player.pos.z);
        this.camera.rotation.set(-0.02, this.player.yaw, 0, 'YXZ');
      } else {
        // play: mid-firefight cover — the denser map now: the overlook platform
        // and stairs, an Ignis fire zone and smoke in mid, an enemy up on the
        // overlook and one pushing the mid corridor, tracers and a full HUD.
        // The camera looks east down the clear z=4 corridor, so the overlook,
        // the fire and both enemies read in one frame.
        this.startMatch('def');
        this.phase = 'round';
        this.hud.hideBuy();
        this.hud.bannerEl.style.display = 'none'; this.hud.bannerTimer = 0;
        this.round = 7; this.scoreDef = 4; this.scoreAtk = 3; this.timer = 62;
        this.roundWinsDef = 4; this.roundWinsAtk = 3;
        this.player.resetSpawn(-6, 4, -Math.PI / 2);
        this.player.health = 86; this.player.armour = 94; this.player.money = 5000;
        this.player.buyWeapon('carbine');
        this.player.money = 3850;
        const w = this.player.weapon(); w.mag = 24; w.reserve = 90;
        this.player.grenades = { frag: 1, flash: 1, smoke: 2, fire: 1 };
        const e1 = this.bots.find((b) => b.team === 'atk' && b.name === 'Vex');
        const e2 = this.bots.find((b) => b.team === 'atk' && b.name === 'Jax');
        // Vex holds the overlook deck, 2.84 m up; Jax pushes the mid corridor.
        e1.resetSpawn(10, 4, Math.PI * 0.85, 'carbine', 50);
        e1.pos.y = 2.84; e1.mesh.position.set(10, 2.84, 4); e1.mesh.rotation.y = Math.PI * 0.85;
        e2.resetSpawn(5, 3, Math.PI / 2, 'smg', 0); e2.mesh.position.set(5, 0, 3); e2.mesh.rotation.y = Math.PI / 2;
        const t1 = this.bots.find((b) => b.team === 'def' && b.name === 'Kael');
        t1.resetSpawn(0, 6.5, -Math.PI / 2, 'carbine', 50); t1.mesh.position.set(0, 0, 6.5);
        this.fireZones.ignite(2, 4);
        // Smoke off the sightline to the overlook, so the enemy on the deck
        // still reads through the frame instead of hiding behind a puff.
        this.effects.smoke(5, 1.4, 0.8, 3, 14);
        this.effects.smoke(7.5, 1.6, 6.8, 2.5, 14);
        // A live tracer from the player's muzzle toward the overlook.
        const eye = this.player.eyePos(new THREE.Vector3());
        this.effects.tracer({ x: eye.x + 0.3, y: eye.y - 0.15, z: eye.z - 0.5 }, { x: 10, y: 4.6, z: 4 });
        this.camera.position.set(this.player.pos.x, 1.62, this.player.pos.z);
        this.camera.rotation.set(-0.02, this.player.yaw, 0, 'YXZ');
      }
      // One live step so the HUD, minimap and crosshair refresh from the staged
      // state, then clear anything the bots said during it and lay the staged
      // feed and callouts on top. Freeze synchronously right after: a live step
      // after staging would hide the plant progress bar and let bots act.
      this.step(STEP);
      this.hud.feedEl.innerHTML = ''; this.hud.feedItems = [];
      this.hud.callEl.innerHTML = ''; this.hud.callItems = [];
      if (kind === 'play') {
        this.hud.addFeed('Vex <span class="wp">AR-47 CARBINE</span> <span class="hs">HS</span> Warden Kael');
        this.hud.addFeed('Mara <span class="wp">K9 COMPACT SMG</span> Jax');
        this.hud.addFeed('YOU <span class="wp">IGNIS</span> Rook');
        this.hud.callout('Vex', 'contact mid — one on the overlook!', 'atk');
        this.hud.callout('Kael', 'fire on mid, do not push through it', 'def');
      } else if (kind === 'mid') {
        this.hud.addFeed('Vex <span class="wp">TEMPEST 7.62</span> Mara');
        this.hud.callout('Vex', 'holding the connector window — watch it!', 'atk');
        this.hud.callout('Kael', 'two in the tunnel, Ignis lit', 'def');
      } else if (kind === 'scores') {
        this.hud.showScores(this.scoreboardHtml());
        this.hud.setRoundHistory(this.roundHistory);
      } else if (kind === 'plant') {
        this.hud.addFeed('Vex <span class="wp">AR-47 CARBINE</span> Mara');
        this.hud.callout('Vex', 'planting at Site A — cover me!', 'atk');
        this.hud.showProgress('PLANTING CHARGE…  (hold E)', 0.62);
      } else if (kind === 'buy') {
        this.hud.showBuy(this.player.money);
      }
      // ?shot=...&live=1 stages the scene but keeps the simulation running, so a
      // play-test can watch bots fight in it; otherwise the scene freezes here.
      this.frozen = params.get('live') !== '1';
      // One settled frame, then the scene is ready for capture.
      requestAnimationFrame(() => requestAnimationFrame(() => {
        window.__shotReady = true;
      }));
    };
    // Let the first real frames land so textures and the minimap are drawn once.
    setTimeout(stage, 600);
  }
}

new Game();
