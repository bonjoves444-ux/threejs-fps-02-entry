// Weapon table for FERRYLINE. Five guns, each with its own job: the sidearm is free
// and fast, the carbine is the all-rounder, the scoped rifle rewards a still aim,
// the shotgun owns close corners, the SMG owns the run-and-gun. Damage is per hit
// before the headshot multiplier (x2.5) and the range falloff the shooter applies.
// spread is the base cone in radians; moveSpread is added while moving, airSpread
// while airborne, bloomPerShot grows the cone as you hold the trigger.
export const WEAPONS = {
  p9: {
    id: 'p9', name: 'P9 SIDEARM', mode: 'SEMI · 9MM', price: 0,
    damage: 26, headMult: 2.5, fireRate: 6.5, auto: false,
    mag: 12, reserve: 36, reload: 1.1, spread: 0.006, moveSpread: 0.020,
    airSpread: 0.030, bloomPerShot: 0.004, bloomMax: 0.030, recoil: 0.011,
    range: 42, falloff: 0.55, tracer: 0xffe9a8, sound: 'pistol',
  },
  smg: {
    id: 'smg', name: 'K9 COMPACT SMG', mode: 'AUTO · 9MM', price: 1500,
    damage: 22, headMult: 2.5, fireRate: 11, auto: true,
    mag: 30, reserve: 90, reload: 1.6, spread: 0.011, moveSpread: 0.016,
    airSpread: 0.028, bloomPerShot: 0.003, bloomMax: 0.042, recoil: 0.008,
    range: 34, falloff: 0.5, tracer: 0xffe9a8, sound: 'smg',
  },
  carbine: {
    id: 'carbine', name: 'AR-47 CARBINE', mode: 'AUTO · 5.56', price: 2700,
    damage: 31, headMult: 2.5, fireRate: 9, auto: true,
    mag: 25, reserve: 75, reload: 2.1, spread: 0.005, moveSpread: 0.024,
    airSpread: 0.034, bloomPerShot: 0.005, bloomMax: 0.045, recoil: 0.014,
    range: 60, falloff: 0.7, tracer: 0xffd27a, sound: 'rifle',
  },
  scoped: {
    id: 'scoped', name: 'LONGSHOT 7.62', mode: 'BOLT · SCOPED', price: 4750,
    damage: 88, headMult: 2.5, fireRate: 0.9, auto: false,
    mag: 5, reserve: 15, reload: 2.8, spread: 0.0008, moveSpread: 0.055,
    airSpread: 0.09, bloomPerShot: 0.05, bloomMax: 0.05, recoil: 0.055,
    range: 90, falloff: 0.95, tracer: 0xfff2c0, sound: 'sniper', scoped: true,
  },
  shotgun: {
    id: 'shotgun', name: 'BREACHER 12', mode: 'PUMP · 12GA', price: 1700,
    damage: 13, headMult: 2.0, fireRate: 1.4, auto: false, pellets: 8,
    mag: 6, reserve: 18, reload: 2.4, spread: 0.030, moveSpread: 0.020,
    airSpread: 0.034, bloomPerShot: 0.010, bloomMax: 0.040, recoil: 0.034,
    range: 16, falloff: 0.35, tracer: 0xffc98a, sound: 'shotgun',
  },
};

// Grenades: frag kills, flash blinds, smoke blocks sight (bots and players alike).
export const GRENADES = {
  frag: { id: 'frag', name: 'FRAG', price: 300, key: '3', radius: 7, damage: 95 },
  flash: { id: 'flash', name: 'FLASH', price: 200, key: '4', radius: 16 },
  smoke: { id: 'smoke', name: 'SMOKE', price: 300, key: '5', radius: 5, life: 14 },
};

export const ARMOUR_PRICE = 650;   // kevlar + helm: halves body damage, blocks one headshot tier
export const KIT_PRICE = 400;      // defuse kit: halves defuse time (defenders only)
export const START_MONEY = 800;
export const KILL_MONEY = 300;
export const WIN_MONEY = 3250;
export const LOSS_MONEY = 1900;
export const PLANT_MONEY = 300;
