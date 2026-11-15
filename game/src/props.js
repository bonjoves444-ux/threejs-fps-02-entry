// Quay 7 dressing: everything that makes the quay feel like a working ferry
// terminal instead of an empty concrete slab. Barrels, pallets, sandbags, tires,
// cable reels, pipes, puddles, oil stains, lane paint, hazard stripes, container
// stencils, site banners and an arrivals board fill the ground; a stair-climbed
// overlook platform adds a second level; and the sky lives — drifting clouds,
// gulls, a travelling crane trolley, waving flags and shimmering water. All props
// share a handful of geometries and materials, so the whole set costs a few dozen
// draw calls. Solid props register colliders through the map's own box() helper.
import * as THREE from 'three';
import { PAL } from './palette.js';

function boardTexture(rows) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#0b0f14'; g.fillRect(0, 0, 512, 256);
  g.fillStyle = '#ffb02e'; g.font = '900 30px Arial'; g.textAlign = 'left';
  g.fillText('DEPARTURES — QUAY 7', 18, 38);
  g.fillStyle = '#9fb4bd'; g.font = '700 15px Arial';
  g.fillText('VESSEL', 18, 66); g.fillText('DESTINATION', 150, 66);
  g.fillText('TIME', 360, 66); g.fillText('STATUS', 440, 66);
  g.fillStyle = '#eef3f6'; g.font = '700 19px Arial';
  rows.forEach((r, i) => {
    const y = 96 + i * 38;
    g.fillStyle = i % 2 ? '#131c22' : '#0b0f14'; g.fillRect(0, y - 22, 512, 34);
    g.fillStyle = '#eef3f6';
    g.fillText(r[0], 18, y); g.fillText(r[1], 150, y); g.fillText(r[2], 360, y);
    g.fillStyle = r[3] === 'ON TIME' ? '#37d67a' : r[3] === 'BOARDING' ? '#ffb02e' : '#ff6b61';
    g.fillText(r[3], 440, y);
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function stencilTexture(text) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 96;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 256, 96);
  g.fillStyle = 'rgba(240,236,220,0.9)'; g.font = '900 44px Arial';
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 128, 50);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class QuayProps {
  constructor(map, scene) {
    this.map = map; this.scene = scene; this.group = map.group;
    this.animated = []; // {mesh, kind, phase, x0, z0, y0}
    this.buildGroundProps();
    this.buildOverlook();
    this.buildBoards();
    this.buildSky();
  }
  // --- helpers that reuse the map's shared box geometry ---
  solid(cx, cy, cz, sx, sy, sz, color) { return this.map.box(cx, cy, cz, sx, sy, sz, color, true); }
  decor(cx, cy, cz, sx, sy, sz, color) { return this.map.box(cx, cy, cz, sx, sy, sz, color, false); }
  cyl(r, h, color, seg = 12) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), this.map.mat(color));
    this.group.add(m); return m;
  }
  barrel(x, z, color) {
    const b = this.cyl(0.36, 0.95, color || PAL.rustDark);
    b.position.set(x, 0.48, z);
    this.map.colliders.push({ minX: x - 0.36, maxX: x + 0.36, minY: 0, maxY: 0.95, minZ: z - 0.36, maxZ: z + 0.36 });
    const rim = this.cyl(0.37, 0.08, PAL.steelDark);
    rim.position.set(x, 0.9, z);
    return b;
  }
  tire(x, z, n = 2) {
    for (let i = 0; i < n; i++) {
      const t = this.cyl(0.46, 0.22, 0x1e2428, 14);
      t.position.set(x, 0.11 + i * 0.23, z);
    }
    this.map.colliders.push({ minX: x - 0.46, maxX: x + 0.46, minY: 0, maxY: 0.23 * n, minZ: z - 0.46, maxZ: z + 0.46 });
  }
  sandbag(x, z, ry = 0) {
    const s = this.solid(x, 0.22, z, 1.3, 0.44, 0.55, 0x9a8a68);
    s.rotation.y = ry; return s;
  }
  pallet(x, z, ry = 0) {
    const p = this.decor(x, 0.07, z, 1.25, 0.13, 1.05, PAL.wood);
    p.rotation.y = ry;
    this.decor(x, 0.16, z, 1.1, 0.05, 0.9, 0x6e5433).rotation.y = ry;
    return p;
  }

  buildGroundProps() {
    // Barrel clusters tucked against the container rows and the ferry.
    for (const [x, z] of [[-13, -16], [-12.3, -15.3], [-13.2, -15.1], [22, 16], [22.7, 15.2], [-26, 8], [-26, 8.8], [16, -16]]) this.barrel(x, z);
    this.barrel(24.5, -15, PAL.tealDark); this.barrel(24.5, -14.2, PAL.tealDark);
    // Sandbag lines guarding both site mouths — low cover you can step over.
    this.sandbag(-16.5, -9.5, 0.3); this.sandbag(-15.2, -9.2, -0.2);
    this.sandbag(12.5, 7.2, 0.9); this.sandbag(13.8, 7.6, 0.4);
    this.sandbag(-4, -6.5, 0); this.sandbag(4, 10.5, 1.2);
    // Tire stacks as corner cover.
    this.tire(24, 14, 3); this.tire(-4, 16, 2); this.tire(16, -16, 2); this.tire(-24, -6, 2);
    // Cable reels near the terminal wall.
    for (const [x, z] of [[24, -14], [20, 18], [-24, 14]]) {
      const r = this.cyl(0.62, 0.5, PAL.wood, 14);
      r.rotation.z = Math.PI / 2; r.position.set(x, 0.62, z);
      this.map.colliders.push({ minX: x - 0.35, maxX: x + 0.35, minY: 0, maxY: 1.24, minZ: z - 0.62, maxZ: z + 0.62 });
    }
    // Pipes stacked along the east wall and the north wall.
    for (let i = 0; i < 3; i++) {
      const p = this.cyl(0.28, 9, PAL.steel, 10);
      p.rotation.x = Math.PI / 2; p.position.set(23.4, 0.3 + i * 0.55, 2 + i * 0.1);
    }
    this.map.colliders.push({ minX: 23.0, maxX: 23.8, minY: 0, maxY: 1.4, minZ: -2.5, maxZ: 6.5 });
    for (let i = 0; i < 2; i++) {
      const p = this.cyl(0.26, 7, PAL.steelDark, 10);
      p.rotation.z = Math.PI / 2; p.position.set(-6 + i * 0.2, 0.3 + i * 0.5, -19.2);
    }
    // Pallets with slats, scattered where a fight can use them as low cover.
    this.pallet(-8, 14, 0.4); this.pallet(4, -14, -0.3); this.pallet(18, -4, 1.1);
    this.pallet(-20, 14, 0.2); this.pallet(20, 6, -0.7); this.pallet(-2, 12, 0.9);
    // Extra crates of varied sizes — the lanes are no longer bare concrete.
    const crate = (x, z, s, c) => this.solid(x, s / 2, z, s, s, s, c || PAL.wood);
    crate(-18, -16, 1.6); crate(22, -10, 1.4, PAL.rust); crate(-26, 12, 1.1);
    crate(24, 2, 1.8, PAL.teal); crate(-6, 16, 1.3); crate(16, 16, 0.9);
    crate(-14, -2, 1.0); crate(26, -6, 1.2, PAL.cream); crate(2, 16, 1.5, PAL.rust);
    // Puddles: flat, slightly reflective-looking water the sun catches.
    const puddle = (x, z, r) => {
      const m = new THREE.Mesh(new THREE.CircleGeometry(r, 20),
        new THREE.MeshLambertMaterial({ color: 0x9fc4d8, transparent: true, opacity: 0.5 }));
      m.rotation.x = -Math.PI / 2; m.position.set(x, 0.035, z); this.group.add(m);
    };
    puddle(-2, 2, 1.6); puddle(14, -6, 1.2); puddle(-18, -2, 1.4); puddle(6, 14, 1.0); puddle(20, -14, 1.3);
    // Oil stains near the service road.
    const stain = (x, z, r) => {
      const m = new THREE.Mesh(new THREE.CircleGeometry(r, 18),
        new THREE.MeshLambertMaterial({ color: 0x14181c, transparent: true, opacity: 0.45 }));
      m.rotation.x = -Math.PI / 2; m.position.set(x, 0.032, z); this.group.add(m);
    };
    stain(0, -8, 1.1); stain(20, 4, 0.9); stain(-10, 6, 1.3);
    // Lane paint: white dashes down the service road, arrows at the junctions.
    for (let z = -18; z <= 18; z += 3) this.map.flat(2, z, 0.28, 1.5, 0xf4f6f6, 0.025);
    for (const [x, z, ry] of [[-8, 0, 0], [12, -6, 0], [-2, 12, Math.PI]]) {
      const a = this.decor(x, 0.03, z, 0.5, 0.02, 1.4, 0xf4f6f6); a.rotation.y = ry;
    }
    // Hazard stripes at the mid-connector mouths.
    for (let i = 0; i < 6; i++) {
      this.map.flat(5.4 + i * 0.35, -6, 0.3, 3.4, i % 2 ? PAL.yellow : 0x14181c, 0.028);
      this.map.flat(16.2 + i * 0.35, -6, 0.3, 3.4, i % 2 ? PAL.yellow : 0x14181c, 0.028);
    }
    // Container stencils: painted IDs so the stacks read as cargo, not grey boxes.
    const stencil = (x, y, z, ry, text) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.95),
        new THREE.MeshBasicMaterial({ map: stencilTexture(text), transparent: true }));
      m.position.set(x, y, z); m.rotation.y = ry; this.group.add(m);
    };
    stencil(2, 1.4, -10.6, 0, 'FLCU 2041'); stencil(-2, 1.4, -0.6, 0, 'MRKU 8817');
    stencil(8, 1.4, 9.4, 0, 'TCLU 5530'); stencil(20, 1.4, 12.6, Math.PI / 2, 'HLXU 1190');
    stencil(-6, 1.4, -10.6, 0, 'FLCU 0773');
  }

  buildOverlook() {
    // A watch platform over mid, reached by eight shallow steps — the map's
    // second level. Railings keep the edge readable; the stairs face east.
    const px = 10, pz = 4; // platform centre
    for (const [lx, lz] of [[7.6, 2.6], [12.4, 2.6], [7.6, 5.4], [12.4, 5.4]]) {
      this.solid(lx, 1.3, lz, 0.28, 2.6, 0.28, PAL.steelDark);
    }
    // Platform deck: solid, so bullets and feet treat it as a floor.
    this.solid(px, 2.72, pz, 5.2, 0.24, 3.2, PAL.steel);
    this.decor(px, 2.88, pz, 5.2, 0.04, 3.2, PAL.yellow);
    // Railings (visual only — no collider, so nobody gets snagged on them).
    const rail = (x, z, sx, sz) => this.decor(x, 3.35, z, sx, 0.08, sz, PAL.yellow);
    rail(px, 2.62, 5.2, 0.08); rail(7.62, pz, 0.08, 3.2); rail(12.38, 2.9, 0.08, 1.4);
    rail(12.38, 5.0, 0.08, 1.0); rail(px, 5.38, 5.2, 0.08);
    for (let i = 0; i < 8; i++) {
      const sx = 12.75 + i * 0.55, top = 0.325 * (i + 1);
      this.solid(sx, top - 0.1625, pz, 0.55, 0.325, 1.3, PAL.steelDark);
    }
    // A hanging banner over the platform, readable from the west lane.
    this.map.sign(px, 4.6, 2.5, 0, 6, 1.8, ['OVERLOOK', 'MID · QUAY 7'], '#0b0f14', '#ffd98a', PAL.teal);
  }

  buildBoards() {
    // Arrivals / departures board on the terminal wall, and big site banners.
    const board = new THREE.Mesh(new THREE.PlaneGeometry(7.5, 3.75),
      new THREE.MeshBasicMaterial({ map: boardTexture([
        ['MV MERIDIAN', 'HARBOUR ISLE', '18:40', 'BOARDING'],
        ['MV KESTREL', 'NORTH PIER', '19:05', 'ON TIME'],
        ['MV HALCYON', 'SOUTH BAY', '19:30', 'ON TIME'],
        ['MV OSPREY', 'HARBOUR ISLE', '20:15', 'DELAYED'],
      ]) }));
    board.position.set(23.8, 3.4, -8); board.rotation.y = -Math.PI / 2; this.group.add(board);
    this.map.sign(-16.8, 4.4, -13, -Math.PI / 2, 8, 2.2, ['SITE A', 'FERRY BERTH · MIND THE GAP'], '#7a1f16', '#ffd98a', PAL.yellow);
    this.map.sign(12.8, 4.4, 12, -Math.PI / 2, 8, 2.2, ['SITE B', 'CONTAINER YARD · STACKS 1–9'], '#0f3d33', '#ffd98a', PAL.teal);
    // Two waving flags on poles by the terminal doors.
    for (const [x, z, color] of [[23, -12, PAL.teal], [23, 12, PAL.orange]]) {
      this.solid(x, 2.5, z, 0.12, 5, 0.12, PAL.steelDark);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.8, 6, 1),
        new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide }));
      flag.position.set(x - 0.7, 4.4, z); this.group.add(flag);
      this.animated.push({ mesh: flag, kind: 'flag', phase: x });
    }
  }

  buildSky() {
    // Drifting clouds: big soft translucent planes high over the quay.
    for (let i = 0; i < 6; i++) {
      const c = new THREE.Mesh(new THREE.PlaneGeometry(26 + (i % 3) * 10, 9 + (i % 2) * 4),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, fog: false }));
      c.rotation.x = -Math.PI / 2; c.rotation.z = (i * 0.7) % 1.2;
      c.position.set(-40 + i * 16, 34 + (i % 3) * 5, -30 + (i * 13) % 55);
      this.scene.add(c);
      this.animated.push({ mesh: c, kind: 'cloud', phase: i * 2.1, x0: c.position.x });
    }
    // Seagulls: two-triangle birds circling over the water.
    for (let i = 0; i < 5; i++) {
      const g = new THREE.Group();
      const m = new THREE.MeshBasicMaterial({ color: 0xf4f6f6, side: THREE.DoubleSide });
      const w1 = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.22), m);
      const w2 = w1.clone(); w1.position.x = -0.32; w2.position.x = 0.32;
      w1.rotation.z = 0.5; w2.rotation.z = -0.5;
      g.add(w1); g.add(w2); this.scene.add(g);
      this.animated.push({ mesh: g, kind: 'gull', phase: i * 1.3, x0: -30, y0: 13 + i * 1.6, z0: -8 + i * 5 });
    }
    // A travelling trolley on the north crane beam, hook swaying as it goes.
    const trolley = new THREE.Group();
    const tb = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 2.0), this.map.mat(PAL.steelDark));
    const cable = new THREE.Mesh(new THREE.BoxGeometry(0.2, 4.5, 0.2), this.map.mat(PAL.steelDark));
    cable.position.y = -2.9;
    const hook = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.7), this.map.mat(PAL.yellow));
    hook.position.y = -5.3;
    trolley.add(tb); trolley.add(cable); trolley.add(hook);
    trolley.position.set(0, 11.2, -17); this.scene.add(trolley);
    this.animated.push({ mesh: trolley, kind: 'trolley', phase: 0 });
    // Water shimmer: pale translucent sheets drifting on the harbour.
    for (let i = 0; i < 4; i++) {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(14, 3),
        new THREE.MeshBasicMaterial({ color: 0xffe9bb, transparent: true, opacity: 0.16, fog: false }));
      s.rotation.x = -Math.PI / 2; s.position.set(-45 - i * 8, -0.35, -14 + i * 9);
      this.scene.add(s);
      this.animated.push({ mesh: s, kind: 'shimmer', phase: i * 1.7, x0: s.position.x });
    }
  }

  update(dt, time) {
    for (const a of this.animated) {
      if (a.kind === 'cloud') {
        a.mesh.position.x = a.x0 + ((time * 0.55 + a.phase * 7) % 130);
        if (a.mesh.position.x > 70) a.mesh.position.x -= 130;
      } else if (a.kind === 'gull') {
        const t = time * 0.35 + a.phase;
        a.mesh.position.set(a.x0 + Math.cos(t) * 16, a.y0 + Math.sin(t * 1.7) * 1.2, a.z0 + Math.sin(t) * 12);
        a.mesh.rotation.y = -t;
        a.mesh.children[0].rotation.z = 0.5 + Math.sin(time * 6 + a.phase) * 0.35;
        a.mesh.children[1].rotation.z = -0.5 - Math.sin(time * 6 + a.phase) * 0.35;
      } else if (a.kind === 'trolley') {
        a.mesh.position.x = Math.sin(time * 0.045) * 20;
        a.mesh.children[1].rotation.z = Math.sin(time * 0.5) * 0.06;
        a.mesh.children[2].position.x = Math.sin(time * 0.5) * 0.35;
      } else if (a.kind === 'flag') {
        a.mesh.rotation.y = Math.sin(time * 2.2 + a.phase) * 0.35;
        a.mesh.scale.x = 1 + Math.sin(time * 3.1 + a.phase) * 0.08;
      } else if (a.kind === 'shimmer') {
        a.mesh.position.x = a.x0 + Math.sin(time * 0.12 + a.phase) * 6;
        a.mesh.material.opacity = 0.10 + Math.sin(time * 0.4 + a.phase) * 0.06;
      }
    }
  }
}
