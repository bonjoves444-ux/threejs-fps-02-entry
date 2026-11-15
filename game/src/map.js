// Quay 7 — a coastal ferry terminal at golden hour. Three lanes run north-south:
// the waterside lane past the ferry hull, the middle lane through the container
// rows, and the terminal lane along the building. Site A (Ferry Berth) sits at the
// ferry's bow ramp; Site B (Container Yard) sits in the south-east stacks.
// The map builds plain boxes from one shared unit geometry, so the whole scene is
// a few dozen draw calls, and every solid box registers one AABB collider that the
// player, the bots and the bullets all test against.
import * as THREE from 'three';
import { PAL } from './palette.js';

export const MAP = {
  minX: -30, maxX: 30, minZ: -20, maxZ: 20,
  siteA: { x: -22, z: -13, minX: -28, maxX: -16, minY: 0, maxY: 4, minZ: -18, maxZ: -8, name: 'SITE A — FERRY BERTH' },
  siteB: { x: 18, z: 12, minX: 12, maxX: 24, minY: 0, maxY: 4, minZ: 6, maxZ: 18, name: 'SITE B — CONTAINER YARD' },
  runnerSpawn: [[22, -12], [22, 0], [22, 12], [20, -6], [20, 6]],
  dockerSpawn: [[-10, 0], [-14, -6], [-6, 6], [-16, -10], [-4, -12]],
};

// Waypoint graph the bots patrol and rotate on. Nodes are lane junctions and site
// mouths; edges join neighbours a bot can walk between without crossing a box.
// Nodes 21-23 run through the mid connector tunnel (z -6), so bots use the
// choke instead of only the open lanes.
const WP = [
  [22, 0], [20, -10], [20, 10], [12, -14], [12, 0], [12, 14],
  [2, -16], [2, -4], [2, 6], [-8, -14], [-8, -4], [-8, 8],
  [-16, -13], [-22, -13], [18, 12], [-16, 4], [22, -12], [22, 12],
  [-10, 0], [-2, 12], [6, -10], [8, -6], [12, -6], [15, -6],
];
const EDGES = [
  [0, 1], [0, 2], [0, 16], [0, 17], [1, 3], [1, 20], [2, 5], [3, 6], [3, 20],
  [4, 5], [4, 7], [5, 8], [5, 14], [6, 9], [7, 8], [7, 10], [7, 19],
  [8, 11], [8, 19], [9, 10], [9, 12], [10, 11], [10, 15], [11, 19], [12, 13],
  [12, 15], [14, 5], [14, 19], [15, 18], [16, 1], [17, 2], [18, 10], [18, 7],
  [19, 11], [20, 6], [2, 4], [7, 20], [1, 23], [23, 22], [22, 21], [21, 7],
];

function signTexture(lines, bg, fg, accent) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 192;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 512, 192);
  g.fillStyle = accent; g.fillRect(0, 0, 18, 192);
  g.fillStyle = fg; g.textAlign = 'left'; g.textBaseline = 'middle';
  g.font = '900 64px Arial'; g.fillText(lines[0], 44, lines[1] ? 74 : 96);
  if (lines[1]) { g.font = '700 34px Arial'; g.fillStyle = accent; g.fillText(lines[1], 44, 142); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function letterTexture(letter, color) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 256, 256);
  g.fillStyle = color; g.font = '900 210px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(letter, 128, 138);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class QuayMap {
  constructor(scene) {
    this.colliders = [];
    this.group = new THREE.Group();
    scene.add(this.group);
    this.boxGeo = new THREE.BoxGeometry(1, 1, 1);
    this.mats = new Map();
    this.build();
  }
  mat(color) {
    if (!this.mats.has(color)) {
      this.mats.set(color, new THREE.MeshLambertMaterial({ color }));
    }
    return this.mats.get(color);
  }
  // Solid box: mesh + AABB collider. (cx, cy, cz) is the centre, (sx, sy, sz) size.
  box(cx, cy, cz, sx, sy, sz, color, collide = true) {
    const m = new THREE.Mesh(this.boxGeo, this.mat(color));
    m.position.set(cx, cy, cz); m.scale.set(sx, sy, sz);
    this.group.add(m);
    if (collide) this.colliders.push({ minX: cx - sx / 2, maxX: cx + sx / 2, minY: cy - sy / 2, maxY: cy + sy / 2, minZ: cz - sz / 2, maxZ: cz + sz / 2 });
    return m;
  }
  flat(cx, cz, sx, sz, color, y = 0.02) {
    const m = new THREE.Mesh(this.boxGeo, this.mat(color));
    m.position.set(cx, y, cz); m.scale.set(sx, 0.02, sz);
    this.group.add(m); return m;
  }
  sign(cx, cy, cz, ry, w, h, lines, bg, fg, accent) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: signTexture(lines, bg, fg, accent) }));
    m.position.set(cx, cy, cz); m.rotation.y = ry;
    this.group.add(m); return m;
  }
  build() {
    // --- ground: sun-bleached concrete quay, with a darker service road down mid.
    this.flat(0, 0, 62, 42, PAL.quay, 0.0);
    this.flat(2, 0, 10, 40, PAL.asphalt, 0.015);
    // Hazard rings around both sites, and painted site letters on the concrete.
    this.flat(-22, -13, 12.4, 0.35, PAL.yellow); this.flat(-22, -8, 12.4, 0.35, PAL.yellow);
    this.flat(-28.2, -13, 0.35, 10.4, PAL.yellow); this.flat(-15.8, -13, 0.35, 10.4, PAL.yellow);
    this.flat(18, 6, 12.4, 0.35, PAL.yellow); this.flat(18, 18, 12.4, 0.35, PAL.yellow);
    this.flat(11.8, 12, 0.35, 12.4, PAL.yellow); this.flat(24.2, 12, 0.35, 12.4, PAL.yellow);
    const la = new THREE.Mesh(new THREE.PlaneGeometry(7, 7), new THREE.MeshBasicMaterial({ map: letterTexture('A', 'rgba(255,176,46,0.85)'), transparent: true }));
    la.rotation.x = -Math.PI / 2; la.position.set(-22, 0.03, -13); this.group.add(la);
    const lb = la.clone(); lb.material = new THREE.MeshBasicMaterial({ map: letterTexture('B', 'rgba(255,176,46,0.85)'), transparent: true });
    lb.position.set(18, 0.03, 12); this.group.add(lb);
    // --- water: the harbour west of the quay, teal and flat in the low sun.
    const water = new THREE.Mesh(new THREE.PlaneGeometry(90, 90),
      new THREE.MeshLambertMaterial({ color: PAL.water, roughness: 0.25 }));
    water.rotation.x = -Math.PI / 2; water.position.set(-75, -0.5, 0); this.group.add(water);
    // --- the ferry: a white hull with a teal stripe, moored along the west edge.
    this.box(-27, 2.2, -2, 7, 4.4, 30, 0xe8e2d4);
    this.box(-23.4, 1.4, -2, 0.3, 1.0, 30, PAL.teal);
    this.box(-27, 4.9, -2, 6.4, 0.9, 28, 0xd8d2c2);
    this.box(-27, 5.6, -8, 5.4, 1.1, 4, PAL.steelDark); // bridge block
    this.box(-25, 1.1, -14.5, 4, 2.2, 0.6, PAL.wood);   // bow ramp down to Site A
    this.sign(-23.3, 3.4, -2, Math.PI / 2, 14, 5, ['FERRYLINE', 'MV MERIDIAN · QUAY 7'], '#0b0f14', '#f2e8d5', PAL.yellow);
    // --- terminal building along the east edge, with a lit window band.
    this.box(28, 4.5, 0, 8, 9, 30, PAL.cream);
    this.box(23.9, 5.6, 0, 0.25, 1.6, 26, 0x2a3f4a);
    this.box(23.9, 2.6, 0, 0.25, 0.9, 26, PAL.steelDark);
    this.sign(23.8, 7.6, 0, -Math.PI / 2, 12, 3.4, ['TERMINAL', 'QUAY 7 · DEPARTURES'], '#0b0f14', '#f2e8d5', PAL.teal);
    // --- container stacks: the mid-lane maze. Rust, teal and cream boxes, 6 x 2.6.
    const cont = (x, z, color, stack = 1, rot = 0) => {
      const long = rot ? 2.6 : 6, wide = rot ? 6 : 2.6;
      this.box(x, 1.3, z, long, 2.6, wide, color);
      if (stack > 1) this.box(x + 0.2, 3.9, z, long, 2.6, wide, color === PAL.rust ? PAL.rustDark : PAL.tealDark);
      this.box(x, 2.62, z, long + 0.1, 0.12, wide + 0.1, PAL.steelDark); // lid shadow line
    };
    cont(-6, -12, PAL.rust); cont(2, -12, PAL.teal, 2); cont(10, -12, PAL.cream);
    cont(-10, -2, PAL.teal); cont(-2, -2, PAL.rust, 2); cont(6, -2, PAL.cream); cont(14, -2, PAL.rust);
    cont(-8, 8, PAL.cream); cont(0, 8, PAL.rust, 2); cont(8, 8, PAL.teal);
    cont(20, 14, PAL.rust, 2); cont(15, 16.5, PAL.teal);
    cont(-14, 4, PAL.rust, 1, 1); cont(-14, -8, PAL.teal, 1, 1); cont(-18, 6, PAL.cream, 1, 1);
    // --- crates: low cover dotted along the lanes.
    const crate = (x, z, s = 1.2) => this.box(x, s / 2, z, s, s, s, PAL.wood);
    crate(-12, -8); crate(-12, -7.4, 0.8); crate(-4, -14, 1.4); crate(8, -7.6); crate(16, -6);
    crate(-4, 2); crate(10, 4, 1.4); crate(-14, 12); crate(4, 14); crate(14, 8, 0.9);
    crate(-20, -6); crate(22, 2); crate(-24, 2, 1.4); crate(6, 12);
    // --- the mid connector: a roofed container tunnel at z -6, the map's choke.
    // Two parallel walls, open at both ends, with a window cut into the north
    // wall (x 10–12, y 1.0–1.9) to shoot through — the fight over mid is a fight
    // over this window. The roof stops grenades arcing over it.
    this.box(8, 1.5, -8, 4, 3, 0.5, PAL.steelDark);            // north wall, west
    this.box(14, 1.5, -8, 4, 3, 0.5, PAL.steelDark);           // north wall, east
    this.box(11, 0.5, -8, 2, 1.0, 0.5, PAL.steelDark);         // window sill
    this.box(11, 2.45, -8, 2, 1.1, 0.5, PAL.steelDark);        // window lintel
    this.box(11, 1.5, -4, 10, 3, 0.5, PAL.rust);               // south wall
    this.box(11, 3.15, -6, 10.4, 0.3, 4.4, PAL.steelDark);     // roof
    this.sign(6.2, 2.2, -6, Math.PI / 2, 3.4, 1.3, ['MID', 'CONNECTOR'], '#0b0f14', '#ffd98a', PAL.yellow);
    this.sign(15.8, 2.2, -6, -Math.PI / 2, 3.4, 1.3, ['MID', 'CONNECTOR'], '#0b0f14', '#ffd98a', PAL.yellow);
    // --- two gantry cranes over the yard; their legs are real cover.
    for (const z of [-17, 16]) {
      for (const x of [-24, -8, 8, 24]) this.box(x, 6, z, 0.7, 12, 0.7, PAL.yellow);
      this.box(0, 12.2, z, 52, 1.0, 1.4, PAL.yellow);
      this.box(4, 11.2, z, 2.2, 1.4, 2.0, PAL.steelDark); // trolley
      this.box(4, 8, z, 0.25, 5.5, 0.25, PAL.steelDark);   // hook cable
    }
    // --- bollards along the water edge, lamp posts, site signs.
    for (let z = -18; z <= 18; z += 6) this.box(-29.6, 0.5, z, 0.5, 1.0, 0.5, PAL.yellow);
    for (const [x, z] of [[-12, -16], [8, 16], [-13, 12], [16, -16]]) {
      this.box(x, 2.6, z, 0.22, 5.2, 0.22, PAL.steelDark);
      this.box(x, 5.3, z, 0.9, 0.35, 0.5, PAL.yellow);
    }
    // Site signs face the site mouths, so a player pushing in reads them.
    this.sign(-16.8, 2.6, -13, -Math.PI / 2, 7, 2.6, ['SITE A', 'FERRY BERTH'], '#0b0f14', '#ffd98a', PAL.yellow);
    this.sign(12.8, 2.6, 12, -Math.PI / 2, 7, 2.6, ['SITE B', 'CONTAINER YARD'], '#0b0f14', '#ffd98a', PAL.yellow);
    // --- perimeter: low quay walls north/south so nobody walks into the water.
    this.box(0, 0.8, -20.6, 62, 1.6, 0.8, PAL.quayDark);
    this.box(0, 0.8, 20.6, 62, 1.6, 0.8, PAL.quayDark);
    // Invisible walls at the playable edge keep actors on the quay.
    this.colliders.push({ minX: -31, maxX: -30, minY: 0, maxY: 6, minZ: -22, maxZ: 22 });
    this.colliders.push({ minX: 30, maxX: 31, minY: 0, maxY: 6, minZ: -22, maxZ: 22 });
  }
  // Breadth-first path over the waypoint graph; returns an array of [x, z] points.
  findPath(fromX, fromZ, toX, toZ) {
    const start = this.nearestWP(fromX, fromZ), goal = this.nearestWP(toX, toZ);
    const prev = new Array(WP.length).fill(-1);
    const q = [start]; prev[start] = start;
    while (q.length) {
      const n = q.shift();
      if (n === goal) break;
      for (const [a, b] of EDGES) {
        const m = a === n ? b : b === n ? a : -1;
        if (m >= 0 && prev[m] < 0) { prev[m] = n; q.push(m); }
      }
    }
    const path = [];
    if (prev[goal] < 0) { path.push([toX, toZ]); return path; }
    let n = goal;
    const nodes = [];
    while (n !== start) { nodes.unshift(n); n = prev[n]; }
    for (const i of nodes) path.push([WP[i][0], WP[i][1]]);
    path.push([toX, toZ]);
    return path;
  }
  nearestWP(x, z) {
    let best = 0, bd = Infinity;
    for (let i = 0; i < WP.length; i++) {
      const d = (WP[i][0] - x) ** 2 + (WP[i][1] - z) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }
  // Axis-separated AABB collision for a capsule-ish actor (radius r, height h).
  // Moves pos by (dx, dz) one axis at a time; returns nothing, edits pos in place.
  // Boxes whose top is within STEP_UP of the actor's feet are stepped over, not
  // blocked — that is what lets a player walk up the overlook stairs and jump
  // onto crates. Boxes taller than that still stop you cold.
  collide(pos, r, h, dx, dz) {
    const c = this.colliders;
    const STEP_UP = 0.55;
    const hit = (x, z) => {
      for (let i = 0; i < c.length; i++) {
        const b = c[i];
        if (b.maxY <= pos.y + STEP_UP) continue; // low enough to step onto
        if (pos.y + h > b.minY && pos.y < b.maxY &&
            x + r > b.minX && x - r < b.maxX && z + r > b.minZ && z - r < b.maxZ) return true;
      }
      return false;
    };
    const nx = pos.x + dx;
    if (!hit(nx, pos.z)) pos.x = nx;
    const nz = pos.z + dz;
    if (!hit(pos.x, nz)) pos.z = nz;
    pos.x = Math.max(MAP.minX + r, Math.min(MAP.maxX - r, pos.x));
    pos.z = Math.max(MAP.minZ + r, Math.min(MAP.maxZ - r, pos.z));
  }
  // Highest solid top under (x, z) that the actor can stand on: the top of any
  // collider containing the point whose top is no more than 0.6 above the
  // actor's current feet, else the quay at 0. Used for landing on crates, the
  // overlook deck and the stairs.
  groundHeight(x, z, feetY) {
    let g = 0;
    for (let i = 0; i < this.colliders.length; i++) {
      const b = this.colliders[i];
      if (b.maxY > feetY + 0.6 || b.maxY <= g) continue;
      if (x > b.minX && x < b.maxX && z > b.minZ && z < b.maxZ) g = b.maxY;
    }
    return g;
  }
}
