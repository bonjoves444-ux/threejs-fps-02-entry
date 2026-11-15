// Transient combat effects, all pooled: tracers are a fixed set of line segments,
// smoke is a fixed set of expanding billboards, sparks are a fixed point cloud.
// Nothing here allocates per frame — the hot loop reuses the same buffers, and
// finished effects are returned to the pool instead of being disposed.
import * as THREE from 'three';

const TRACER_MAX = 24;
const SMOKE_MAX = 10;
const SPARK_MAX = 240;

export class Effects {
  constructor(scene) {
    this.scene = scene;
    // --- tracers: one THREE.Line per slot, two vertices each.
    this.tracers = [];
    for (let i = 0; i < TRACER_MAX; i++) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      const mat = new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0 });
      const line = new THREE.Line(geo, mat);
      line.frustumCulled = false; line.visible = false;
      scene.add(line);
      this.tracers.push({ line, life: 0, max: 0.09 });
    }
    this.tracerIdx = 0;
    // --- smoke: billboarded puffs that grow, drift and fade; bots treat them as
    // opaque, so a smoke at a site mouth really does block a rotate.
    this.smokes = [];
    const puffGeo = new THREE.IcosahedronGeometry(1, 1);
    for (let i = 0; i < SMOKE_MAX; i++) {
      const mat = new THREE.MeshLambertMaterial({ color: 0xcfd6d8, transparent: true, opacity: 0 });
      const mesh = new THREE.Mesh(puffGeo, mat);
      mesh.visible = false; scene.add(mesh);
      this.smokes.push({ mesh, life: 0, max: 0, x: 0, y: 0, z: 0, r: 1 });
    }
    this.smokeIdx = 0;
    // --- sparks: one Points cloud, slots recycled round-robin.
    this.sparkPos = new Float32Array(SPARK_MAX * 3);
    this.sparkVel = new Float32Array(SPARK_MAX * 3);
    this.sparkLife = new Float32Array(SPARK_MAX);
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(this.sparkPos, 3));
    this.sparkPoints = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffd27a, size: 0.09, transparent: true, opacity: 0.95 }));
    this.sparkPoints.frustumCulled = false;
    scene.add(this.sparkPoints);
    this.sparkIdx = 0;
    // --- muzzle flash: a small additive quad at the gun tip plus a point light.
    this.flashLight = new THREE.PointLight(0xffc98a, 0, 9, 1.6);
    scene.add(this.flashLight);
    this.flashLife = 0;
  }
  tracer(from, to, color = 0xffe9a8) {
    const t = this.tracers[this.tracerIdx]; this.tracerIdx = (this.tracerIdx + 1) % TRACER_MAX;
    const p = t.line.geometry.attributes.position.array;
    p[0] = from.x; p[1] = from.y; p[2] = from.z; p[3] = to.x; p[4] = to.y; p[5] = to.z;
    t.line.geometry.attributes.position.needsUpdate = true;
    t.line.material.color.setHex(color);
    t.line.material.opacity = 0.9;
    t.line.visible = true; t.life = t.max;
  }
  muzzle(pos) {
    this.flashLight.position.copy(pos);
    this.flashLight.intensity = 26; this.flashLife = 0.05;
  }
  sparks(pos, n, spread = 2.2) {
    for (let k = 0; k < n; k++) {
      const i = this.sparkIdx; this.sparkIdx = (this.sparkIdx + 1) % SPARK_MAX;
      this.sparkPos[i * 3] = pos.x; this.sparkPos[i * 3 + 1] = pos.y; this.sparkPos[i * 3 + 2] = pos.z;
      this.sparkVel[i * 3] = (Math.random() - 0.5) * spread;
      this.sparkVel[i * 3 + 1] = Math.random() * spread * 0.8;
      this.sparkVel[i * 3 + 2] = (Math.random() - 0.5) * spread;
      this.sparkLife[i] = 0.35 + Math.random() * 0.25;
    }
  }
  smoke(x, y, z, radius, life) {
    const s = this.smokes[this.smokeIdx]; this.smokeIdx = (this.smokeIdx + 1) % SMOKE_MAX;
    s.x = x; s.y = y; s.z = z; s.r = radius; s.life = life; s.max = life;
    s.mesh.position.set(x, y, z); s.mesh.scale.setScalar(radius); s.mesh.visible = true;
    s.mesh.material.opacity = 0.6;
  }
  // Is the line of sight from a to b blocked by any live smoke cloud?
  smokeBlocks(ax, ay, az, bx, by, bz) {
    for (const s of this.smokes) {
      if (s.life <= 0) continue;
      // Segment-to-point distance, squared, against the puff's radius.
      const vx = bx - ax, vy = by - ay, vz = bz - az;
      const wx = s.x - ax, wy = s.y - ay, wz = s.z - az;
      const len2 = vx * vx + vy * vy + vz * vz;
      let t = len2 > 0 ? (vx * wx + vy * wy + vz * wz) / len2 : 0;
      t = Math.max(0, Math.min(1, t));
      const dx = ax + vx * t - s.x, dy = ay + vy * t - s.y, dz = az + vz * t - s.z;
      if (dx * dx + dy * dy + dz * dz < s.r * s.r * 0.55) return true;
    }
    return false;
  }
  update(dt) {
    for (const t of this.tracers) {
      if (!t.line.visible) continue;
      t.life -= dt;
      t.line.material.opacity = Math.max(0, t.life / t.max) * 0.9;
      if (t.life <= 0) t.line.visible = false;
    }
    for (const s of this.smokes) {
      if (s.life <= 0) continue;
      s.life -= dt;
      const grow = 1 + (1 - s.life / s.max) * 0.5;
      s.mesh.scale.setScalar(s.r * grow);
      s.mesh.position.y = s.y + (1 - s.life / s.max) * 1.2;
      s.mesh.material.opacity = Math.min(0.6, (s.life / s.max) * 1.0);
      if (s.life <= 0) { s.mesh.visible = false; s.mesh.material.opacity = 0; }
    }
    let any = false;
    for (let i = 0; i < SPARK_MAX; i++) {
      if (this.sparkLife[i] <= 0) continue;
      any = true;
      this.sparkLife[i] -= dt;
      this.sparkPos[i * 3] += this.sparkVel[i * 3] * dt;
      this.sparkPos[i * 3 + 1] += this.sparkVel[i * 3 + 1] * dt;
      this.sparkPos[i * 3 + 2] += this.sparkVel[i * 3 + 2] * dt;
      this.sparkVel[i * 3 + 1] -= 6 * dt;
      if (this.sparkPos[i * 3 + 1] < 0.02) { this.sparkPos[i * 3 + 1] = 0.02; this.sparkVel[i * 3 + 1] *= -0.4; }
    }
    this.sparkPoints.geometry.attributes.position.needsUpdate = true;
    this.sparkPoints.material.opacity = any ? 0.95 : 0;
    if (this.flashLife > 0) {
      this.flashLife -= dt;
      if (this.flashLife <= 0) this.flashLight.intensity = 0;
    }
  }
}
