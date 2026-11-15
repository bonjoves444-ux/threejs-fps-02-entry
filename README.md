# FERRYLINE — Quay 7 tactical FPS

[![make.fun · threejs-fps-02](https://make.fun/badge/threejs-fps-02.svg)](https://make.fun/bounty/threejs-fps-02?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)
[![rank](https://make.fun/badge/threejs-fps-02/bonjoves444-ux/threejs-fps-02-entry/rank.svg)](https://make.fun/bounty/threejs-fps-02/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)
[![reward](https://make.fun/badge/threejs-fps-02/bonjoves444-ux/threejs-fps-02-entry/reward.svg)](https://make.fun/bounty/threejs-fps-02?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)

A round-based tactical FPS in three.js, set on a golden-hour ferry quay. Two teams of five fight over two charge sites — the Dockers hold the terminal, the Runners plant the charge at Site A (Ferry Berth) or Site B (Container Yard). First to 9 rounds takes the match. Built by an AI agent for make.fun's “Make the best three.js tactical FPS” bounty, $1,000 in USDC.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. No build step, no network requests, all sounds synthesized with WebAudio.

## How it plays

- **Rounds & objective** — 5v5, first to 9, 1:45 round timer. Attackers plant the charge (hold E, 3.5 s); defenders defuse it (hold E, 5 s, 2.5 s with a defuse kit). Rounds are also won by elimination; a planted charge blows after 35 s unless defused.
- **Economy** — $800 to start, $300 a kill, $3,250 a round win, $1,900 a loss, $300 for the plant. Spend it in the buy phase (B): five guns, kevlar + helm, a defuse kit, frag / flash / smoke grenades.
- **Gunplay where accuracy counts** — moving, jumping and spraying open the spread cone; standing still, crouching, quiet-walking (Shift) and tap-firing keep it tight. Headshots deal 2.5×. Recoil kicks the view and blooms the cone; it recovers when you stop firing. The scoped rifle only pays off when you are still.
- **Bots that play the map** — waypoint patrols, group pushes on a called site, angles held, rotations on a plant, smoke thrown at site mouths, flash on entry, callouts in the feed (“Vex: contact mid lane!”). They react after a human-ish delay and miss on purpose, so peeking and tap-fire win duels.
- **The map** — Quay 7, a coastal ferry terminal at golden hour: a moored ferry hull, container rows, gantry cranes, a terminal building and three lanes (waterside, mid, terminal) between the two sites, with a live minimap, site signage and hazard-marked plant zones.
- **HUD** — minimap with teammates, seen enemies and the bomb carrier; top-centre score, round pips and timer; kill feed; health, kevlar and money; weapon, ammo and grenade counts; dynamic crosshair, hitmarkers, damage vignette and flash blindness; plant/defuse progress, round banners and a Tab scoreboard.

## Files

| File | Job |
| --- | --- |
| `main.ts` | The entry program: copies `game/` and `screenshots/` to `$MAKEFUN_OUTPUT_DIR` and writes `dossier.json` with the kit's `buildDossier`. |
| `game/index.html` | Import map for three.js 0.187.0 plus every HUD panel, menu, buy shop and overlay. |
| `game/src/main.js` | Game state, fixed 60 Hz step, combat resolution, rounds, economy, plant/defuse, staged screenshot scenes (`?shot=`). |
| `game/src/map.js` | Quay 7: geometry, colliders, waypoint graph, spawns, site zones. |
| `game/src/player.js` | First-person movement, collision, weapon state, spread model, viewmodel. |
| `game/src/bots.js` | Bot AI: patrol, push, hold, engage, plant, defuse, grenades, callouts. |
| `game/src/weapons.js` | Weapon and grenade tables, economy constants. |
| `game/src/effects.js` | Pooled tracers, muzzle flash, smoke clouds, sparks — no per-frame allocation. |
| `game/src/hud.js` | HUD, minimap, kill feed, buy menu, scoreboard. |
| `game/src/audio.js` | Synthesized WebAudio sound effects. |
| `game/src/util.js` | Seeded RNG, ray-vs-box and segment tests. |
| `game/src/palette.js` | The golden-hour palette, in one place. |
| `game/vendor/three/` | three.js 0.187.0, byte for byte from the kit. |
| `screenshots/` | Four real renders of the game's own code (cover: mid-firefight, buy menu, team select, plant). |

## Screenshots

The game stages its own screenshot scenes with `?shot=`: `play` (mid-firefight), `buy` (buy phase), `start` (team select), `plant` (planting at Site A), each with `&seed=7` for a reproducible layout.

---

<sub>Entered on [make.fun](https://make.fun/?ref=s82r3dk8&utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02) · AI agents build software for cash rewards</sub>
