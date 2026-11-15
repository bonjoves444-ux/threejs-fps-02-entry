// Bots: boxy low-poly teammates and opponents with a real state machine — they
// patrol the waypoint graph, rotate between the sites, hold angles, push as a
// group, plant the charge when they carry it, defuse when they defend, and throw
// smoke and flash grenades on the way in. They see with line-of-sight tests
// (map boxes and live smoke both block them), react after a human-ish delay, and
// miss on purpose: their aim error grows with distance and target speed, so a
// player who stops, peeks and taps wins duels and a player who sprints across an
// open lane gets punished.
import * as THREE from 'three';
import { WEAPONS, START_MONEY } from './weapons.js';
import { PAL } from './palette.js';
import { clamp, angDiff } from './util.js';

const DOCKER_NAMES = ['Kael', 'Mara', 'Ilya', 'Sef', 'Dune'];
const RUNNER_NAMES = ['Vex', 'Jax', 'Sol', 'Rook', 'Nix'];
const BOT_WEAPONS = ['carbine', 'smg', 'carbine', 'shotgun', 'scoped'];
// What a bot buys when it can afford it, in preference order. Broke bots keep
// the sidearm and save — an eco round, same as a human would play.
const BOT_BUY_LADDER = ['carbine', 'dmr', 'smg', 'shotgun', 'lmg', 'scoped'];

export class Bot {
  constructor(map, scene, rng, id, team, name) {
    this.map = map; this.scene = scene; this.rng = rng;
    this.id = id; this.team = team; // 'def' Dockers teal, 'atk' Runners orange
    this.name = name;
    this.pos = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0;
    this.health = 100; this.armour = 0; this.helmet = false; this.hasKit = false;
    this.alive = true;
    this.kills = 0; this.deaths = 0; this.damageDealt = 0;
    this.money = START_MONEY;
    this.carrier = false;      // holds the charge (attackers only)
    this.state = 'idle';       // idle | patrol | push | engage | hold | plant | defuse | rotate
    this.path = []; this.pathIdx = 0;
    this.target = null;        // actor currently fought
    this.lastSeen = null;      // {x,y,z} of the last seen enemy
    this.seenAt = -10;
    this.reactUntil = 0;       // cannot shoot before this game time
    this.burstLeft = 0; this.nextShotAt = 0; this.burstPauseUntil = 0;
    this.aimErr = 0.030;
    this.holdUntil = 0;
    this.destSite = 'A';
    this.planVia = null; this.viaDone = false; // flank route for the team plan
    this.hasSmoked = false; this.hasFlashed = false; this.hasFired = false; this.hasFlared = false;
    this.calledOut = false; this.calledRotate = false;
    this.speed = 3.4;
    this.strafeDir = 1; this.strafeUntil = 0;
    this.grenades = { frag: 1, flash: 1, smoke: 1, fire: 0 };
    this.weapon = this.freshWeapon(BOT_WEAPONS[id % BOT_WEAPONS.length]);
    this.buildMesh();
  }
  // Spend the round's money like a player: a rifle when rich, an SMG or a
  // shotgun mid-budget, the sidearm when broke (eco — save for next round).
  // Armour, a defuse kit for defenders and one fire grenade come with the buy.
  buyForRound() {
    let budget = this.money;
    const afford = (id) => budget >= WEAPONS[id].price;
    let pick = 'p9';
    for (const id of BOT_BUY_LADDER) {
      if (afford(id) && this.rng() < 0.7) { pick = id; break; }
      if (afford(id)) { pick = id; break; }
    }
    if (pick !== 'p9') budget -= WEAPONS[pick].price;
    this.weapon = this.freshWeapon(pick);
    this.armour = 0; this.helmet = false; this.hasKit = false;
    if (budget >= 650 && (pick !== 'p9' || budget >= 1400)) {
      budget -= 650; this.armour = 100; this.helmet = true;
    }
    if (this.team === 'def' && budget >= 400 && this.rng() < 0.5) {
      budget -= 400; this.hasKit = true;
    }
    this.grenades = { frag: 1, flash: 1, smoke: 1, fire: budget >= 400 && this.rng() < 0.45 ? 1 : 0, flare: this.rng() < 0.4 ? 1 : 0 };
    this.money = budget;
  }
  // Halftime side swap: same bot, other side — recolour the uniform and tag.
  setTeam(team) {
    this.team = team;
    const c = team === 'def' ? PAL.teal : PAL.orange;
    if (this.suitMat) this.suitMat.color.setHex(c);
    if (this.bandMat) this.bandMat.color.setHex(c);
    if (this.nameCtx) {
      this.nameCtx.fillStyle = 'rgba(8,12,16,0.72)'; this.nameCtx.fillRect(0, 0, 256, 64);
      this.nameCtx.fillStyle = team === 'def' ? '#7df0e2' : '#ffb37a';
      this.nameCtx.font = '900 34px Arial'; this.nameCtx.textAlign = 'center'; this.nameCtx.textBaseline = 'middle';
      this.nameCtx.fillText(this.name, 128, 34);
      if (this.nameTex) this.nameTex.needsUpdate = true;
    }
  }
  freshWeapon(id) {
    const def = WEAPONS[id];
    return { def, mag: def.mag, reserve: 999 };
  }
  buildMesh() {
    const teamColor = this.team === 'def' ? PAL.teal : PAL.orange;
    const g = new THREE.Group();
    const suit = new THREE.MeshLambertMaterial({ color: teamColor });
    this.suitMat = suit;
    this.bandMat = new THREE.MeshLambertMaterial({ color: teamColor });
    const dark = new THREE.MeshLambertMaterial({ color: 0x22282d });
    const skin = new THREE.MeshLambertMaterial({ color: 0xc9976b });
    const box = (sx, sy, sz, x, y, z, m) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m);
      mesh.position.set(x, y, z); g.add(mesh); return mesh;
    };
    box(0.52, 0.62, 0.30, 0, 1.05, 0, suit);            // torso
    box(0.54, 0.10, 0.32, 0, 1.38, 0, dark);            // vest strap
    box(0.34, 0.32, 0.32, 0, 1.56, 0, skin);            // head
    box(0.36, 0.08, 0.34, 0, 1.68, 0, this.bandMat);    // headband
    box(0.36, 0.06, 0.05, 0, 1.58, 0.17, dark);         // visor
    box(0.16, 0.55, 0.18, -0.14, 0.42, 0, dark);         // legs
    box(0.16, 0.55, 0.18, 0.14, 0.42, 0, dark);
    box(0.12, 0.12, 0.55, 0.22, 1.12, 0.28, dark);      // gun
    if (this.carrier) box(0.3, 0.22, 0.14, 0, 1.02, -0.22, new THREE.MeshLambertMaterial({ color: PAL.yellow }));
    // Name tag: a small canvas sprite so the field reads at a glance.
    const c = document.createElement('canvas'); c.width = 256; c.height = 64;
    const ctx = c.getContext('2d');
    this.nameCtx = ctx;
    ctx.fillStyle = 'rgba(8,12,16,0.72)'; ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = teamColor === PAL.teal ? '#7df0e2' : '#ffb37a';
    ctx.font = '900 34px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(this.name, 128, 34);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    this.nameTex = tex;
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    spr.scale.set(1.6, 0.4, 1); spr.position.set(0, 1.95, 0);
    g.add(spr);
    this.mesh = g;
    this.scene.add(g);
  }
  eyePos(out) { out.set(this.pos.x, this.pos.y + 1.5, this.pos.z); return out; }
  chestPos(out) { out.set(this.pos.x, this.pos.y + 1.15, this.pos.z); return out; }
  // Same damage model as the player: legs 25% less, helmet halves a headshot,
  // kevlar soaks half of what is left.
  takeDamage(amount, isHead, isLeg) {
    if (!this.alive) return 0;
    let dmg = amount;
    if (isLeg) dmg *= 0.75;
    if (isHead && this.helmet) dmg *= 0.5;
    if (this.armour > 0) { const s = Math.min(this.armour, dmg * 0.5); this.armour -= s; dmg -= s; }
    this.health -= dmg;
    if (this.health <= 0) { this.health = 0; this.alive = false; this.mesh.visible = false; }
    return dmg;
  }
  resetSpawn(x, z, yaw, weaponId, armour) {
    this.pos.set(x, 0, z); this.yaw = yaw; this.pitch = 0;
    this.health = 100; this.armour = armour || 0; this.alive = true;
    this.mesh.visible = true;
    this.weapon = this.freshWeapon(weaponId || BOT_WEAPONS[this.id % BOT_WEAPONS.length]);
    this.state = 'patrol'; this.path = []; this.pathIdx = 0;
    this.target = null; this.lastSeen = null; this.seenAt = -10;
    this.burstLeft = 0; this.nextShotAt = 0; this.hasSmoked = false; this.hasFlashed = false; this.hasFired = false; this.hasFlared = false;
    this.calledOut = false; this.calledRotate = false; this.planVia = null; this.viaDone = false;
    this.grenades = { frag: 1, flash: 1, smoke: 1, fire: 0, flare: 0 };
    this.holdUntil = 0;
  }
  setPath(path) { this.path = path; this.pathIdx = 0; }
  atSite(site) {
    return this.pos.x >= site.minX && this.pos.x <= site.maxX && this.pos.z >= site.minZ && this.pos.z <= site.maxZ;
  }
  // Main AI tick. `w` is the world the main loop passes in: it owns line of
  // sight, shooting, damage, callouts, grenades and the bomb, so bots stay dumb
  // about everything except deciding what to do next.
  update(dt, now, w) {
    if (!this.alive) return;
    // --- perception: nearest living enemy with a clear line of sight.
    const enemy = w.nearestVisibleEnemy(this);
    if (enemy) {
      if (!this.target) {
        this.reactUntil = now + 0.5 + this.rng() * 0.4; // human-ish reaction delay
        this.calledOut = false;
      }
      this.target = enemy;
      this.lastSeen = { x: enemy.pos.x, y: enemy.pos.y + 1.2, z: enemy.pos.z };
      this.seenAt = now;
      if (!this.calledOut && enemy.isPlayer) {
        this.calledOut = true;
        w.radioContact(this, enemy);
      }
      this.state = 'engage';
    } else if (this.target && now - this.seenAt > 1.6) {
      this.target = null;
      this.state = this.team === 'atk' ? 'push' : 'patrol';
    }
    // --- objective: plant when the carrier reaches its site, defuse when defending.
    if (this.team === 'atk' && this.carrier && w.bomb.state === 'carried' && !this.target) {
      const site = w.siteByName(this.destSite);
      if (this.atSite(site)) { this.state = 'plant'; w.botPlant(this, dt); return; }
    }
    if (this.team === 'def' && w.bomb.state === 'planted' && !this.target) {
      const d = Math.hypot(this.pos.x - w.bomb.x, this.pos.z - w.bomb.z);
      if (d < 2.2) { this.state = 'defuse'; w.botDefuse(this, dt); return; }
      if (this.state !== 'rotate') {
        this.state = 'rotate'; this.setPath(this.map.findPath(this.pos.x, this.pos.z, w.bomb.x, w.bomb.z));
        if (!this.calledRotate) { this.calledRotate = true; w.radioRotate(this, w.bomb.site); }
      }
    }
    // --- behaviour by state.
    if (this.state === 'engage' && this.target) { this.fight(dt, now, w); return; }
    if (this.state === 'hold') {
      if (now > this.holdUntil) this.state = this.team === 'atk' ? 'push' : 'patrol';
      return; // hold the angle, do not wander
    }
    // Walk the current path; when it runs out, pick a new job.
    if (this.pathIdx < this.path.length) {
      const [tx, tz] = this.path[this.pathIdx];
      const dx = tx - this.pos.x, dz = tz - this.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.6) { this.pathIdx++; }
      else if (w.fireZones && w.fireZones.isBurning(tx, tz, 0.5)) {
        // The next waypoint is on fire: hold here a moment instead of walking in.
        this.state = 'hold'; this.holdUntil = now + 1.2;
      } else {
        const sp = this.state === 'rotate' ? 4.3 : 3.4;
        this.yaw = Math.atan2(dx, dz);
        this.map.collide(this.pos, 0.36, 1.7, (dx / dist) * sp * dt, (dz / dist) * sp * dt);
        // Attackers smoke the mouth of the site they push, once per round.
        if (this.team === 'atk' && !this.hasSmoked && this.grenades.smoke > 0) {
          const site = w.siteByName(this.destSite);
          const ds = Math.hypot(this.pos.x - site.x, this.pos.z - site.z);
          if (ds < 14 && ds > 6) { this.hasSmoked = true; this.grenades.smoke--; w.botThrowSmoke(this, site.x, site.z); }
        }
        // And light the choke with an Ignis when they are close to the site.
        if (this.team === 'atk' && !this.hasFired && this.grenades.fire > 0) {
          const site = w.siteByName(this.destSite);
          const ds = Math.hypot(this.pos.x - site.x, this.pos.z - site.z);
          if (ds < 9 && ds > 4 && this.rng() < 0.6) {
            this.hasFired = true; this.grenades.fire--;
            w.botThrowFire(this, site.x + (this.rng() - 0.5) * 4, site.z + (this.rng() - 0.5) * 4);
          }
        }
        // And light the site mouth with a flare when pushing in.
        if (this.team === 'atk' && !this.hasFlared && this.grenades.flare > 0) {
          const site = w.siteByName(this.destSite);
          const ds = Math.hypot(this.pos.x - site.x, this.pos.z - site.z);
          if (ds < 12 && ds > 5 && this.rng() < 0.5) {
            this.hasFlared = true; this.grenades.flare--;
            w.botThrowFlare(this, site.x, site.z);
          }
        }
      }
      this.faceAlongPath();
    } else {
      this.pickJob(now, w);
    }
    this.syncMesh(dt);
  }
  faceAlongPath() {
    if (this.pathIdx < this.path.length) {
      const [tx, tz] = this.path[this.pathIdx];
      this.yaw = Math.atan2(tx - this.pos.x, tz - this.pos.z);
    }
  }
  pickJob(now, w) {
    const r = this.rng();
    if (this.team === 'atk') {
      // A flanker takes the Mid Arch route first, then rejoins the site push.
      if (this.planVia && !this.viaDone) {
        this.viaDone = true; this.state = 'push';
        this.setPath(this.map.findPath(this.pos.x, this.pos.z, this.planVia.x, this.planVia.z));
        return;
      }
      // Attackers commit to a site as a group; the carrier goes first.
      if (this.carrier || r < 0.55) {
        const site = w.siteByName(this.destSite);
        this.state = 'push';
        this.setPath(this.map.findPath(this.pos.x, this.pos.z, site.x, site.z));
      } else {
        // A lurker holds a lane angle for a few seconds, then rejoins.
        this.state = 'hold'; this.holdUntil = now + 3 + r * 4;
      }
    } else {
      // Defenders split across the sites and the mid lanes, then re-patrol.
      const sites = [w.siteByName('A'), w.siteByName('B')];
      const pick = this.rng() < 0.5 ? sites[0] : sites[1];
      const jx = pick.x + (this.rng() - 0.5) * 8, jz = pick.z + (this.rng() - 0.5) * 8;
      this.state = 'patrol';
      this.setPath(this.map.findPath(this.pos.x, this.pos.z, jx, jz));
    }
  }
  fight(dt, now, w) {
    const t = this.target;
    if (!t || !t.alive) { this.target = null; return; }
    // Face the target, strafe to make yourself a harder target.
    const dx = t.pos.x - this.pos.x, dz = t.pos.z - this.pos.z;
    const dist = Math.hypot(dx, dz) || 1;
    this.yaw = Math.atan2(dx, dz);
    if (now > this.strafeUntil) { this.strafeDir *= -1; this.strafeUntil = now + 0.7 + this.rng() * 0.9; }
    if (dist > 4) {
      // Strafe sideways while closing or holding range.
      const px = -dz / dist * this.strafeDir, pz = dx / dist * this.strafeDir;
      const close = dist > 16 ? 0.7 : 0;
      this.map.collide(this.pos, 0.36, 1.7,
        (px * 1.6 + (dx / dist) * close) * dt, (pz * 1.6 + (dz / dist) * close) * dt);
    }
    // Fire in bursts once the reaction delay has passed.
    if (now < this.reactUntil || now < this.burstPauseUntil) return;
    if (this.burstLeft <= 0) {
      this.burstLeft = 3 + Math.floor(this.rng() * 3);
      this.burstPauseUntil = now + 0.15;
    }
    if (now >= this.nextShotAt) {
      this.nextShotAt = now + 1 / this.weapon.def.fireRate;
      this.burstLeft--;
      if (this.burstLeft <= 0) this.burstPauseUntil = now + 0.45 + this.rng() * 0.5;
      // Aim error: grows with distance and with how fast the target moves.
      const tSpeed = Math.hypot(t.vel ? t.vel.x : 0, t.vel ? t.vel.z : 0);
      const err = this.aimErr + dist * 0.00045 + tSpeed * 0.004;
      w.botShoot(this, t, err);
      // A flash on entry: the first time a bot fights at a site mouth it blinds it.
      if (!this.hasFlashed && this.grenades.flash > 0 && dist < 22 && this.rng() < 0.12) {
        this.hasFlashed = true; this.grenades.flash--;
        w.botThrowFlash(this, t.pos.x, t.pos.y + 1.2, t.pos.z);
      }
    }
    this.syncMesh(dt);
  }
  syncMesh(dt) {
    this.mesh.position.set(this.pos.x, this.pos.y, this.pos.z);
    this.mesh.rotation.y = this.yaw;
    // Simple walk bob so the bots read as moving, not sliding statues.
    this.mesh.position.y = this.pos.y + Math.abs(Math.sin(performance.now() * 0.006 + this.id * 2)) * 0.03;
  }
}
