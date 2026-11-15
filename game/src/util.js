// Shared helpers for FERRYLINE: a seeded RNG so staged scenes and bot behaviour are
// reproducible, plus the small geometry tests the shooter and the bots both need.
// Everything here allocates nothing in the hot loop: callers pass scratch objects in.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
// Shortest signed angle difference, in radians.
export function angDiff(a, b) {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Ray vs axis-aligned box. Box is {minX,maxX,minY,maxY,minZ,maxZ}.
// Returns the ray distance to the first face, or -1 when the ray misses.
// Origin and direction are plain {x,y,z} objects; dir need not be unit length.
export function rayBox(ox, oy, oz, dx, dy, dz, b) {
  let tmin = 0, tmax = Infinity;
  const axes = [[ox, dx, b.minX, b.maxX], [oy, dy, b.minY, b.maxY], [oz, dz, b.minZ, b.maxZ]];
  for (let i = 0; i < 3; i++) {
    const o = axes[i][0], d = axes[i][1], lo = axes[i][2], hi = axes[i][3];
    if (Math.abs(d) < 1e-9) {
      if (o < lo || o > hi) return -1;
    } else {
      let t1 = (lo - o) / d, t2 = (hi - o) / d;
      if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
      if (t1 > tmin) tmin = t1;
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return -1;
    }
  }
  return tmin;
}

// Does the segment from p to q pass within radius r of sphere centre c?
export function segmentHitsSphere(px, py, pz, qx, qy, qz, cx, cy, cz, r) {
  const vx = qx - px, vy = qy - py, vz = qz - pz;
  const wx = cx - px, wy = cy - py, wz = cz - pz;
  const len2 = vx * vx + vy * vy + vz * vz;
  let t = len2 > 0 ? (vx * wx + vy * wy + vz * wz) / len2 : 0;
  t = clamp(t, 0, 1);
  const dx = px + vx * t - cx, dy = py + vy * t - cy, dz = pz + vz * t - cz;
  return dx * dx + dy * dy + dz * dz < r * r;
}

// Point-in-box test used for "is this actor inside a site zone".
export function inBox(x, y, z, b) {
  return x >= b.minX && x <= b.maxX && y >= b.minY && y <= b.maxY && z >= b.minZ && z <= b.maxZ;
}
