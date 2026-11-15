// Ignis fire zones: a thrown fire grenade lights a patch of ground that burns
// for 7 seconds. Flames are a pooled set of flickering cones, so nothing is
// allocated per throw; anyone standing in the zone takes damage in half-second
// ticks, and bots treat a burning waypoint as blocked and hold instead of
// walking through it. The zone denies an area — a choke, a site mouth, a plant
// spot — exactly the way a molotov does.
import * as THREE from 'three';

const ZONE_MAX = 6;
const ZONE_LIFE = 7;
const ZONE_RADIUS = 3.5;
const TICK_DMG = 12;
const TICK_EVERY = 0.5;

export class FireZones {
  constructor(scene) {
    this.scene = scene;
    this.zones = [];
    for (let i = 0; i < ZONE_MAX; i++) {
      const g = new THREE.Group();
      const flames = [];
      for (let k = 0; k < 5; k++) {
        const f = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.5, 6),
          new THREE.MeshBasicMaterial({ color: k % 2 ? 0xff7a1a : 0xffc23d, transparent: true, opacity: 0.9 }));
        f.position.set((Math.random() - 0.5) * 3.4, 0.7, (Math.random() - 0.5) * 3.4);
        g.add(f); flames.push(f);
      }
      const glow = new THREE.Mesh(new THREE.CircleGeometry(ZONE_RADIUS, 20),
        new THREE.MeshBasicMaterial({ color: 0xff5a00, transparent: true, opacity: 0.22 }));
      glow.rotation.x = -Math.PI / 2; glow.position.y = 0.06; g.add(glow);
      g.visible = false; scene.add(g);
      this.zones.push({ group: g, flames, life: 0, x: 0, z: 0, tickAt: 0 });
    }
    this.idx = 0;
  }
  ignite(x, z) {
    const zn = this.zones[this.idx]; this.idx = (this.idx + 1) % ZONE_MAX;
    zn.x = x; zn.z = z; zn.life = ZONE_LIFE; zn.tickAt = 0;
    zn.group.position.set(x, 0, z); zn.group.visible = true;
    return zn;
  }
  isBurning(x, z, pad = 0) {
    for (const zn of this.zones) {
      if (zn.life <= 0) continue;
      if (Math.hypot(x - zn.x, z - zn.z) < ZONE_RADIUS + pad) return true;
    }
    return false;
  }
  // Flicker the flames and tick damage. `hit` is called for every living actor
  // inside a zone on each tick: (actor, damage) => {}.
  update(dt, time, actors, hit) {
    for (const zn of this.zones) {
      if (zn.life <= 0) continue;
      zn.life -= dt;
      const frac = zn.life / ZONE_LIFE;
      for (let k = 0; k < zn.flames.length; k++) {
        const f = zn.flames[k];
        const s = (0.7 + Math.sin(time * 11 + k * 2.4) * 0.3) * (0.5 + frac * 0.5);
        f.scale.set(s, s * (0.8 + Math.sin(time * 9 + k) * 0.25), s);
        f.rotation.y += dt * (k % 2 ? 2 : -2);
      }
      zn.group.children[zn.flames.length].material.opacity = 0.10 + frac * 0.14;
      zn.tickAt += dt;
      if (zn.tickAt >= TICK_EVERY) {
        zn.tickAt = 0;
        for (const a of actors) {
          if (!a.alive) continue;
          if (Math.hypot(a.pos.x - zn.x, a.pos.z - zn.z) < ZONE_RADIUS) hit(a, TICK_DMG);
        }
      }
      if (zn.life <= 0) zn.group.visible = false;
    }
  }
}
