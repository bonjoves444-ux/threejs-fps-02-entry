// The human player: first-person movement with acceleration and friction, crouch
// and quiet-walk, jumping with gravity, and the weapon state (slots, ammo, reload,
// bloom). Gunplay lives here in the numbers and in main.js in the resolution: the
// spread you actually shoot with is computed here from how you are moving, so
// stopping, crouching and tap-firing are the way to hit anything far away.
import * as THREE from 'three';
import { WEAPONS, START_MONEY } from './weapons.js';
import { clamp, lerp } from './util.js';

const EYE_STAND = 1.62, EYE_CROUCH = 1.05;
const WALK_SPEED = 4.6, CROUCH_SPEED = 2.2, QUIET_SPEED = 2.6;

export class Player {
  constructor(map, sfx, camera) {
    this.map = map; this.sfx = sfx; this.camera = camera;
    this.pos = new THREE.Vector3(0, 0, 0);
    this.vel = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0;
    this.onGround = true;
    this.crouching = false;
    this.eyeHeight = EYE_STAND;
    this.health = 100; this.armour = 0; this.hasKit = false;
    this.money = START_MONEY;
    this.alive = true;
    this.kills = 0; this.deaths = 0;
    this.team = 'def'; // 'def' Dockers or 'atk' Runners
    this.name = 'YOU';
    this.bloom = 0;            // spread growth from holding the trigger
    this.recoilPitch = 0;      // visual kick, recovered over time
    this.reloadUntil = 0;      // game time when the reload finishes
    this.reloading = false;
    this.lastShotAt = -10;
    this.stepAcc = 0;
    this.flashUntil = 0;       // blinded by a flashbang until this game time
    this.viewmodel = new THREE.Group();
    camera.add(this.viewmodel);
    this.slots = { primary: null, secondary: this.freshWeapon('p9') };
    this.slot = 'secondary';
    this.grenades = { frag: 0, flash: 0, smoke: 0 };
    this.buildViewmodel();
  }
  freshWeapon(id) {
    const def = WEAPONS[id];
    return { def, mag: def.mag, reserve: def.reserve };
  }
  weapon() { return this.slots[this.slot]; }
  hasWeapon(id) { return (this.slots.primary && this.slots.primary.def.id === id) || (this.slots.secondary && this.slots.secondary.def.id === id); }
  buyWeapon(id) {
    const def = WEAPONS[id];
    if (this.money < def.price || this.hasWeapon(id)) return false;
    this.money -= def.price;
    const w = this.freshWeapon(id);
    if (id === 'p9') this.slots.secondary = w;
    else { this.slots.primary = w; this.slot = 'primary'; }
    this.buildViewmodel();
    return true;
  }
  switchSlot(slot) {
    if (!this.slots[slot] || this.slot === slot) return false;
    this.slot = slot; this.reloading = false; this.bloom = 0;
    this.buildViewmodel();
    return true;
  }
  startReload(now) {
    const w = this.weapon();
    if (!w || this.reloading || w.mag >= w.def.mag || w.reserve <= 0) return false;
    this.reloading = true;
    this.reloadUntil = now + w.def.reload;
    this.sfx.reload();
    return true;
  }
  finishReload() {
    const w = this.weapon();
    if (!w) return;
    const need = w.def.mag - w.mag;
    const take = Math.min(need, w.reserve);
    w.mag += take; w.reserve -= take;
    this.reloading = false;
  }
  // Current shot cone in radians. Standing still and crouched is tight; moving,
  // airborne or spraying opens it up. Scoped rifles are laser-still only when still.
  currentSpread() {
    const w = this.weapon(); if (!w) return 0.05;
    const d = w.def;
    const speed = Math.hypot(this.vel.x, this.vel.z);
    let s = d.spread + this.bloom;
    s += d.moveSpread * clamp(speed / WALK_SPEED, 0, 1);
    if (!this.onGround) s += d.airSpread;
    if (this.crouching) s *= 0.55;
    if (this.scoped) s *= 0.35;
    return s;
  }
  get scoped() { const w = this.weapon(); return !!(w && w.def.scoped && this.aiming); }
  aiming = false;
  eyePos(out) {
    out.set(this.pos.x, this.pos.y + this.eyeHeight, this.pos.z);
    return out;
  }
  // Damage: armour soaks 50% of body damage until it breaks; a helmet turns a
  // headshot into a body hit's worth of extra damage instead of the full multiplier
  // (the multiplier itself is applied by the shooter before calling here).
  takeDamage(amount, isHead) {
    if (!this.alive) return 0;
    let dmg = amount;
    if (this.armour > 0) {
      const soaked = Math.min(this.armour, dmg * 0.5);
      this.armour -= soaked; dmg -= soaked;
    }
    this.health -= dmg;
    if (this.health <= 0) { this.health = 0; this.alive = false; }
    return dmg;
  }
  addLook(dx, dy) {
    this.yaw -= dx * 0.0022;
    this.pitch = clamp(this.pitch - dy * 0.0022, -1.45, 1.45);
  }
  update(dt, input, now) {
    if (!this.alive) return;
    this.crouching = !!input.crouch;
    const targetEye = this.crouching ? EYE_CROUCH : EYE_STAND;
    this.eyeHeight = lerp(this.eyeHeight, targetEye, Math.min(1, dt * 12));
    // Wish direction from the keys, rotated by yaw. Shift is a quiet walk: slower,
    // silent, steadier — the trade for giving up speed.
    const speed = this.crouching ? CROUCH_SPEED : input.walk ? QUIET_SPEED : WALK_SPEED;
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    let fx = 0, fz = 0;
    if (input.forward) { fx -= sin; fz -= cos; }
    if (input.back) { fx += sin; fz += cos; }
    if (input.left) { fx -= cos; fz += sin; }
    if (input.right) { fx += cos; fz -= sin; }
    const len = Math.hypot(fx, fz);
    if (len > 0) { fx /= len; fz /= len; }
    const accel = this.onGround ? 55 : 14;
    this.vel.x += fx * accel * dt;
    this.vel.z += fz * accel * dt;
    // Friction: strong on the ground so stops are crisp, none in the air.
    if (this.onGround) {
      const f = Math.max(0, 1 - dt * 10);
      this.vel.x *= f; this.vel.z *= f;
      const sp = Math.hypot(this.vel.x, this.vel.z);
      if (sp > speed) { this.vel.x *= speed / sp; this.vel.z *= speed / sp; }
    }
    if (input.jump && this.onGround) { this.vel.y = 7.4; this.onGround = false; }
    this.vel.y -= 22 * dt;
    this.map.collide(this.pos, 0.36, this.crouching ? 1.15 : 1.7, this.vel.x * dt, this.vel.z * dt);
    this.pos.y += this.vel.y * dt;
    if (this.pos.y <= 0) { this.pos.y = 0; this.vel.y = 0; this.onGround = true; }
    // Footsteps: audible to nearby bots unless quiet-walking.
    const hSpeed = Math.hypot(this.vel.x, this.vel.z);
    if (this.onGround && hSpeed > 1.2) {
      this.stepAcc += hSpeed * dt;
      if (this.stepAcc > 2.4) { this.stepAcc = 0; if (!input.walk) this.sfx.step(false); }
    }
    // Bloom and recoil recover when you stop firing.
    if (now - this.lastShotAt > 0.12) this.bloom = Math.max(0, this.bloom - dt * 0.09);
    this.recoilPitch = lerp(this.recoilPitch, 0, Math.min(1, dt * 9));
    // Camera follows the head, plus recoil kick and a touch of walk bob.
    const bob = this.onGround && hSpeed > 1 ? Math.sin(now * 9) * 0.025 * (hSpeed / WALK_SPEED) : 0;
    this.camera.position.set(this.pos.x, this.pos.y + this.eyeHeight + bob, this.pos.z);
    this.camera.rotation.set(this.pitch + this.recoilPitch, this.yaw, 0, 'YXZ');
    // Viewmodel sway: lags the look a touch, kicks on each shot.
    this.viewmodel.position.set(0.34, -0.30 + bob * 0.4, -0.55);
    this.viewmodel.rotation.x = this.recoilPitch * 1.4;
  }
  // A low-poly gun from boxes, rebuilt per weapon. Colours match the weapon's role
  // so the viewmodel reads at a glance even before the HUD does.
  buildViewmodel() {
    while (this.viewmodel.children.length) this.viewmodel.remove(this.viewmodel.children[0]);
    const w = this.weapon(); if (!w) return;
    const g = new THREE.Group();
    const dark = new THREE.MeshLambertMaterial({ color: 0x1c2126 });
    const mid = new THREE.MeshLambertMaterial({ color: 0x3a444c });
    const accent = new THREE.MeshLambertMaterial({ color: w.def.id === 'scoped' ? 0x2dd4c4 : w.def.id === 'shotgun' ? 0xb4552d : 0xffb02e });
    const box = (sx, sy, sz, x, y, z, m) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m || dark);
      mesh.position.set(x, y, z); g.add(mesh); return mesh;
    };
    if (w.def.id === 'p9') {
      box(0.07, 0.09, 0.24, 0, 0, 0); box(0.06, 0.12, 0.08, 0, -0.09, 0.06);
    } else if (w.def.id === 'smg') {
      box(0.07, 0.08, 0.42, 0, 0, 0); box(0.05, 0.10, 0.06, 0, -0.08, 0.12, mid); box(0.06, 0.06, 0.16, 0, -0.01, -0.26);
    } else if (w.def.id === 'shotgun') {
      box(0.09, 0.10, 0.55, 0, 0, 0); box(0.08, 0.08, 0.5, 0, -0.02, 0.02, mid); box(0.06, 0.11, 0.07, 0, -0.09, 0.1);
    } else if (w.def.id === 'scoped') {
      box(0.07, 0.09, 0.62, 0, 0, 0); box(0.05, 0.05, 0.3, 0, 0.07, 0, accent);
      const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.2, 10), mid);
      scope.rotation.x = Math.PI / 2; scope.position.set(0, 0.075, 0.02); g.add(scope);
      box(0.05, 0.10, 0.06, 0, -0.08, 0.12);
    } else {
      box(0.07, 0.09, 0.52, 0, 0, 0); box(0.05, 0.05, 0.2, 0, 0.06, -0.05, accent);
      box(0.06, 0.12, 0.07, 0, -0.09, 0.1); box(0.05, 0.07, 0.1, 0, -0.03, -0.3, mid);
    }
    this.viewmodel.add(g);
  }
  resetSpawn(x, z, yaw) {
    this.pos.set(x, 0, z); this.vel.set(0, 0, 0);
    this.yaw = yaw; this.pitch = 0; this.health = 100; this.alive = true;
    this.bloom = 0; this.reloading = false; this.flashUntil = 0;
  }
}
