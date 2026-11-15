// Flare grenades: a thrown flare lights a push for 8 seconds. A pooled set of
// point lights with additive glow sprites — nothing allocated per throw — so a
// flare over a dark site mouth reads from across the map and bots can throw
// them on entry the same way the player can.
import * as THREE from 'three';

const FLARE_MAX = 4;
const FLARE_LIFE = 8;

function glowTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,240,200,1)');
  grad.addColorStop(0.35, 'rgba(255,190,90,0.55)');
  grad.addColorStop(1, 'rgba(255,140,40,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class FlareManager {
  constructor(scene) {
    this.scene = scene;
    this.slots = [];
    const tex = glowTexture();
    for (let i = 0; i < FLARE_MAX; i++) {
      const light = new THREE.PointLight(0xffc06a, 0, 26, 1.4);
      light.position.set(0, -10, 0); scene.add(light);
      const spr = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending,
      }));
      spr.scale.set(7, 7, 1); spr.position.set(0, -10, 0); scene.add(spr);
      this.slots.push({ light, spr, life: 0 });
    }
    this.idx = 0;
  }
  light(x, y, z) {
    const s = this.slots[this.idx]; this.idx = (this.idx + 1) % FLARE_MAX;
    s.life = FLARE_LIFE;
    s.light.position.set(x, Math.max(1.1, y), z);
    s.spr.position.set(x, Math.max(1.1, y), z);
    return s;
  }
  update(dt, time) {
    for (let i = 0; i < this.slots.length; i++) {
      const s = this.slots[i];
      if (s.life <= 0) continue;
      s.life -= dt;
      const frac = Math.max(0, s.life / FLARE_LIFE);
      const flick = 0.85 + Math.sin(time * 13 + i * 2.7) * 0.15;
      s.light.intensity = 34 * frac * flick;
      s.spr.material.opacity = 0.55 * frac * flick;
      s.spr.scale.setScalar(5 + frac * 3);
      if (s.life <= 0) { s.light.intensity = 0; s.spr.material.opacity = 0; }
    }
  }
}
