// Named zones: every square of Quay 7 has a name, the way a real callout map
// does. The zones tile the whole quay with no gaps, so zoneAt() always answers.
// Bots, radio lines, the minimap label and the site banners all read the same
// table — one name per place, everywhere, so a callout means something.
export const ZONES = [
  { name: 'BOW RAMP', minX: -30, maxX: -14, minZ: -20, maxZ: -8, site: 'A' },
  { name: 'FERRY DECK', minX: -30, maxX: -14, minZ: -8, maxZ: 8 },
  { name: 'CRANE ROW', minX: -30, maxX: -14, minZ: 8, maxZ: 20 },
  { name: 'CUSTOMS HALL', minX: -14, maxX: 2, minZ: -20, maxZ: -6 },
  { name: 'MID ARCH', minX: -14, maxX: 2, minZ: -6, maxZ: 6 },
  { name: 'QUAY STEPS', minX: -14, maxX: 2, minZ: 6, maxZ: 20 },
  { name: 'NORTH STACKS', minX: 2, maxX: 18, minZ: -20, maxZ: -8 },
  { name: 'CONNECTOR', minX: 2, maxX: 18, minZ: -8, maxZ: 0 },
  { name: 'OVERLOOK', minX: 2, maxX: 18, minZ: 0, maxZ: 8 },
  { name: 'CONTAINER YARD', minX: 2, maxX: 30, minZ: 8, maxZ: 20, site: 'B' },
  { name: 'DEPARTURES', minX: 18, maxX: 30, minZ: -20, maxZ: 8 },
];

export function zoneAt(x, z) {
  for (const zn of ZONES) {
    if (x >= zn.minX && x <= zn.maxX && z >= zn.minZ && z <= zn.maxZ) return zn.name;
  }
  return 'QUAY 7';
}
