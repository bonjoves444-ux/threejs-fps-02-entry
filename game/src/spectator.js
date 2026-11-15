// Deathcam and spectator: when the player dies, the camera rides with a living
// teammate — click to cycle through them. Once the round ends, the camera is
// free: WASD flies it around the quay and dragging the mouse looks around, so
// the player can watch the rest of the round play out instead of staring at a
// black screen. No pointer lock is needed; it is a watch mode, not a play mode.
import * as THREE from 'three';
import { clamp } from './util.js';

export class Spectator {
  constructor(camera) {
    this.camera = camera;
    this.active = false;
    this.free = false;
    this.target = null;
    this.teammates = [];
    this.yaw = 0; this.pitch = -0.1;
    this.pos = new THREE.Vector3(0, 12, 0);
    this.dragging = false;
    this.keys = {};
    window.addEventListener('mousedown', (e) => {
      if (!this.active) return;
      if (e.button === 0) {
        if (this.free) this.dragging = true;
        else this.cycle();
      }
    });
    window.addEventListener('mouseup', () => { this.dragging = false; });
    window.addEventListener('mousemove', (e) => {
      if (this.dragging && this.free) {
        this.yaw -= e.movementX * 0.0022;
        this.pitch = clamp(this.pitch - e.movementY * 0.0022, -1.45, 1.45);
      }
    });
    window.addEventListener('keydown', (e) => {
      if (!this.active) return;
      this.keys[e.code] = true;
      if (e.code === 'KeyF') this.free = !this.free;
    });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
  }
  start(player, actors) {
    this.active = true; this.free = false;
    this.teammates = actors.filter((a) => a !== player && a.team === player.team && a.alive);
    this.target = this.teammates[0] || null;
    if (this.target) { this.yaw = this.target.yaw || 0; }
    this.pos.set(0, 14, 18); this.pitch = -0.35;
  }
  stop() { this.active = false; this.target = null; this.free = false; this.keys = {}; }
  cycle() {
    if (!this.teammates.length) return;
    const alive = this.teammates.filter((a) => a.alive);
    if (!alive.length) { this.free = true; return; }
    const i = alive.indexOf(this.target);
    this.target = alive[(i + 1) % alive.length];
  }
  setFree() {
    this.free = true;
    if (this.target) this.pos.set(this.target.pos.x, 8, this.target.pos.z + 8);
    this.pitch = -0.4;
  }
  update(dt) {
    if (!this.active) return;
    if (this.free || !this.target || !this.target.alive) {
      if (!this.free) this.setFree();
      const sp = 12;
      const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
      let fx = 0, fz = 0;
      if (this.keys.KeyW || this.keys.ArrowUp) { fx -= sin; fz -= cos; }
      if (this.keys.KeyS || this.keys.ArrowDown) { fx += sin; fz += cos; }
      if (this.keys.KeyA || this.keys.ArrowLeft) { fx -= cos; fz += sin; }
      if (this.keys.KeyD || this.keys.ArrowRight) { fx += cos; fz -= sin; }
      const len = Math.hypot(fx, fz) || 1;
      this.pos.x += (fx / len) * sp * dt * (fx || fz ? 1 : 0);
      this.pos.z += (fz / len) * sp * dt * (fx || fz ? 1 : 0);
      if (this.keys.Space) this.pos.y += sp * dt;
      if (this.keys.KeyC || this.keys.ControlLeft) this.pos.y -= sp * dt;
      this.pos.y = clamp(this.pos.y, 1, 40);
      this.pos.x = clamp(this.pos.x, -29, 29);
      this.pos.z = clamp(this.pos.z, -19, 19);
      this.camera.position.copy(this.pos);
      this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
      return;
    }
    const t = this.target;
    const eyeY = t.pos.y + 1.62;
    this.camera.position.set(t.pos.x, eyeY, t.pos.z);
    this.yaw = t.yaw || 0;
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }
}
