// Weapon table for FERRYLINE. Nine guns, each with its own job: the sidearm is free
// and fast, the carbine is the all-rounder, the scoped rifle rewards a still aim,
// the shotgun owns close corners, the SMG owns the run-and-gun, the DMR taps heads
// at range, the LMG holds a lane with sixty rounds, the revolver deletes one
// target per slow shot, and the knife is free, silent and fast up close. Damage
// is per hit before the headshot multiplier (x2.5) and the range falloff the
// shooter applies. spread is the base cone in radians; moveSpread is added while
// moving, airSpread while airborne, bloomPerShot grows the cone as you hold the
// trigger. pattern is the deterministic recoil kick per shot in a burst: yaw and
// pitch offsets that climb then pull sideways, so bursts can be learned and
// controlled. ads marks weapons that zoom on right mouse.
export const WEAPONS = {
  p9: {
    id: 'p9', name: 'P9 SIDEARM', mode: 'SEMI · 9MM', price: 0,
    damage: 26, headMult: 2.5, fireRate: 6.5, auto: false,
    mag: 12, reserve: 36, reload: 1.1, spread: 0.006, moveSpread: 0.020,
    airSpread: 0.030, bloomPerShot: 0.004, bloomMax: 0.030, recoil: 0.011,
    range: 42, falloff: 0.55, tracer: 0xffe9a8, sound: 'pistol',
    pattern: [[0, 1], [0.1, 1], [-0.1, 1], [0.2, 0.9], [-0.2, 0.9], [0, 0.8]],
  },
  revolver: {
    id: 'revolver', name: 'SIDEWINDER .44', mode: 'SEMI · .44 MAG', price: 800,
    damage: 64, headMult: 2.5, fireRate: 2.2, auto: false,
    mag: 6, reserve: 24, reload: 1.9, spread: 0.004, moveSpread: 0.022,
    airSpread: 0.032, bloomPerShot: 0.012, bloomMax: 0.03, recoil: 0.032,
    range: 40, falloff: 0.6, tracer: 0xffd27a, sound: 'revolver',
    pattern: [[0, 1], [0.15, 1], [-0.15, 1]],
  },
  smg: {
    id: 'smg', name: 'K9 COMPACT SMG', mode: 'AUTO · 9MM', price: 1500,
    damage: 22, headMult: 2.5, fireRate: 11, auto: true,
    mag: 30, reserve: 90, reload: 1.6, spread: 0.011, moveSpread: 0.016,
    airSpread: 0.028, bloomPerShot: 0.003, bloomMax: 0.042, recoil: 0.008,
    range: 34, falloff: 0.5, tracer: 0xffe9a8, sound: 'smg',
    pattern: [[0, 1], [0.2, 1], [0.35, 0.9], [0.4, 0.9], [-0.3, 0.8], [-0.45, 0.8], [0.2, 0.7], [-0.2, 0.7]],
  },
  carbine: {
    id: 'carbine', name: 'AR-47 CARBINE', mode: 'AUTO · 5.56', price: 2700,
    damage: 31, headMult: 2.5, fireRate: 9, auto: true, ads: true,
    mag: 25, reserve: 75, reload: 2.1, spread: 0.005, moveSpread: 0.024,
    airSpread: 0.034, bloomPerShot: 0.005, bloomMax: 0.045, recoil: 0.014,
    range: 60, falloff: 0.7, tracer: 0xffd27a, sound: 'rifle',
    pattern: [[0, 1], [0.1, 1], [0.25, 1], [0.4, 0.95], [0.5, 0.9], [-0.4, 0.85], [-0.55, 0.8], [0.3, 0.75], [-0.3, 0.7], [0, 0.7]],
  },
  dmr: {
    id: 'dmr', name: 'TEMPEST 7.62', mode: 'SEMI · 7.62 DMR', price: 3800,
    damage: 54, headMult: 2.5, fireRate: 3.2, auto: false, ads: true,
    mag: 10, reserve: 30, reload: 2.4, spread: 0.004, moveSpread: 0.03,
    airSpread: 0.04, bloomPerShot: 0.012, bloomMax: 0.03, recoil: 0.024,
    range: 70, falloff: 0.85, tracer: 0xfff2c0, sound: 'dmr',
    pattern: [[0, 1], [0.1, 1], [-0.1, 0.9], [0.15, 0.9]],
  },
  lmg: {
    id: 'lmg', name: 'MAULER 5.56', mode: 'AUTO · 5.56 LMG', price: 4200,
    damage: 30, headMult: 2.5, fireRate: 10, auto: true, ads: true, moveSlow: 0.85,
    mag: 60, reserve: 120, reload: 3.4, spread: 0.012, moveSpread: 0.03,
    airSpread: 0.036, bloomPerShot: 0.004, bloomMax: 0.06, recoil: 0.016,
    range: 55, falloff: 0.65, tracer: 0xffd27a, sound: 'lmg',
    pattern: [[0, 1], [0.15, 1], [0.3, 0.95], [0.35, 0.9], [-0.35, 0.85], [-0.5, 0.8], [0.4, 0.75], [-0.3, 0.7]],
  },
  scoped: {
    id: 'scoped', name: 'LONGSHOT 7.62', mode: 'BOLT · SCOPED', price: 4750,
    damage: 88, headMult: 2.5, fireRate: 0.9, auto: false,
    mag: 5, reserve: 15, reload: 2.8, spread: 0.0008, moveSpread: 0.055,
    airSpread: 0.09, bloomPerShot: 0.05, bloomMax: 0.05, recoil: 0.055,
    range: 90, falloff: 0.95, tracer: 0xfff2c0, sound: 'sniper', scoped: true,
    pattern: [[0, 1]],
  },
  shotgun: {
    id: 'shotgun', name: 'BREACHER 12', mode: 'PUMP · 12GA', price: 1700,
    damage: 13, headMult: 2.0, fireRate: 1.4, auto: false, pellets: 8,
    mag: 6, reserve: 18, reload: 2.4, spread: 0.030, moveSpread: 0.020,
    airSpread: 0.034, bloomPerShot: 0.010, bloomMax: 0.040, recoil: 0.034,
    range: 16, falloff: 0.35, tracer: 0xffc98a, sound: 'shotgun',
    pattern: [[0, 1], [0.1, 0.9]],
  },
  knife: {
    id: 'knife', name: 'RIPPER KNIFE', mode: 'MELEE · SILENT', price: 0, melee: true,
    damage: 40, headMult: 1, fireRate: 1.8, auto: false,
    mag: 0, reserve: 0, reload: 0, spread: 0, moveSpread: 0,
    airSpread: 0, bloomPerShot: 0, bloomMax: 0, recoil: 0,
    range: 2.2, falloff: 1, tracer: 0xffffff, sound: 'knife',
    pattern: [[0, 0]],
  },
};

// One-line shop flavour per gun, shown under its name in the buy menu.
export const FLAVOUR = {
  p9: 'Cheap, fast, always there',
  revolver: 'One shot, one down — slow',
  smg: 'Fast, loose, cheap',
  carbine: 'Accurate all-rounder',
  dmr: 'Taps heads at range',
  lmg: 'Sixty rounds — hold the lane',
  scoped: 'One-shot body, scoped',
  shotgun: 'Eight pellets, owns close range',
  knife: 'Silent, fast, up close',
};

// Grenades: frag kills, flash blinds, smoke blocks sight (bots and players alike),
// Ignis lights a fire zone that denies an area for 7 seconds, and a flare
// lights a push for 8 seconds.
export const GRENADES = {
  frag: { id: 'frag', name: 'FRAG', price: 300, key: '4', radius: 7, damage: 95, flavour: 'Bouncing blast, 1.6 s fuse' },
  flash: { id: 'flash', name: 'FLASH', price: 200, key: '5', radius: 16, flavour: 'Blinds anyone looking at it' },
  smoke: { id: 'smoke', name: 'SMOKE', price: 300, key: '6', radius: 5, life: 14, flavour: 'Smoke cloud — blocks sight' },
  fire: { id: 'fire', name: 'IGNIS', price: 400, key: '7', radius: 3.5, life: 7, damage: 12, flavour: 'Fire zone — denies ground 7 s' },
  flare: { id: 'flare', name: 'FLARE', price: 250, key: '8', radius: 6, life: 8, flavour: 'Lights a push for 8 s' },
};

export const ARMOUR_PRICE = 650;   // kevlar + helm: halves body damage, blocks one headshot tier
export const KIT_PRICE = 400;      // defuse kit: halves defuse time (defenders only)
export const START_MONEY = 800;
export const KILL_MONEY = 300;
export const WIN_MONEY = 3250;
export const LOSS_MONEY = 1900;
export const PLANT_MONEY = 300;
