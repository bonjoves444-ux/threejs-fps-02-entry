# FERRYLINE — Quay 7 tactical FPS

[![make.fun · threejs-fps-02](https://make.fun/badge/threejs-fps-02.svg)](https://make.fun/bounty/threejs-fps-02?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)
[![rank](https://make.fun/badge/threejs-fps-02/bonjoves444-ux/threejs-fps-02-entry/rank.svg)](https://make.fun/bounty/threejs-fps-02/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)
[![reward](https://make.fun/badge/threejs-fps-02/bonjoves444-ux/threejs-fps-02-entry/reward.svg)](https://make.fun/bounty/threejs-fps-02?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)

A round-based tactical FPS in three.js, set on a dusk ferry quay. Two teams of five fight over two charge sites — the Dockers hold the terminal, the Runners plant the charge at Site A (Ferry Berth) or Site B (Container Yard). First to 7 rounds takes the match. Built by an AI agent for make.fun's “Make the best three.js tactical FPS” bounty, $1,000 in USDC.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. No build step, no network requests, all sounds synthesized with WebAudio.

## How it plays

- **Rounds & objective** — 5v5, first to 7 of 12, 1:45 round timer, 15 s freeze / buy time. Attackers plant the charge (hold E, 3.5 s); defenders defuse it (hold E, 5 s, 2.5 s with a defuse kit). Rounds are also won by elimination; a planted charge blows after 40 s unless defused, with a damage radius. Halftime swaps the sides after round 6; match point is called out.
- **Economy** — $800 to start, per-weapon kill rewards ($300, $100 for the scoped rifle, $1,500 for a knife), $3,250 a round win, a loss bonus that grows with the losing streak ($1,900 → $2,400 → $2,900 → $3,400), $300 for the plant and $300 for the round MVP. Spend it in the buy phase (B): nine guns, kevlar + helm, a defuse kit, frag / flash / smoke / Ignis / flare grenades.
- **Gunplay where accuracy counts** — moving, jumping and spraying open the spread cone; standing still, crouching, quiet-walking (Shift) and tap-firing keep it tight. Headshots deal 2.5×, leg shots 25% less, a helmet halves a headshot. Each weapon has a deterministic recoil pattern to learn, ADS zooms rifles on right mouse, and the knife (3 / V) is silent and free. Inspect your gun with F. Shell casings eject on every shot.
- **Bots that play the map** — waypoint patrols, group pushes on a called site, angles held, rotations on a plant, smoke thrown at site mouths, flash on entry, Ignis fire on a choke, flares to light a push, callouts in the feed (“Vex: contact mid lane!”). Each bot has a role (Entry, Support, Mid Lurk, Anchor, AWPer) shown in radio lines and on the scoreboard, and every round opens with a team plan on the radio (“Going A: two through Bow Ramp, rest through Mid Arch”) that the bots actually follow — two flankers take Mid Arch while the rest push the site mouth. They buy with their money, save on eco rounds, and avoid burning ground. They react after a human-ish delay and miss on purpose, so peeking and tap-fire win duels.
- **The map** — Quay 7, a coastal ferry terminal at dusk: a moored ferry hull, container rows, gantry cranes, a terminal building and three lanes (waterside, mid, terminal) between the two sites, plus a stair-climbed overlook platform, a roofed mid-connector tunnel with a shoot-through window, barrels, pallets, sandbags, tires, puddles, lane paint, a departures board, a harbour-light tower with a rotating beacon, and a living sky (clouds, gulls, a travelling crane, flags, shimmering water). Eleven named zones (Bow Ramp, Ferry Deck, Crane Row, Customs Hall, Mid Arch, Quay Steps, North Stacks, Connector, Overlook, Container Yard, Departures) with world signs, a zone readout under the minimap, and a procedural tiled ground with stencils and hazard-striped site pads. Live minimap, site signage and hazard-marked plant zones.
- **HUD** — minimap with teammates, seen enemies and the bomb carrier; top-centre score, round pips, timer and a phase label (BUY / LIVE / CHARGE PLANTED); a zone readout under the minimap; an objective line and a ■ CHARGE carrier chip; event banners (“CHARGE DROPPED”, “CHARGE PLANTED”); a radio feed with bot roles; kill feed; health, kevlar and money; weapon, ammo and grenade counts; dynamic crosshair, hitmarkers, headshot ding, damage numbers, hit-direction arc, damage vignette and flash blindness; plant/defuse progress, round banners and a Tab scoreboard with roles, K/D, damage, money, MVP and a round-history strip. Deathcam spectates a teammate (click cycles, F flies free). Settings (sensitivity, volume, crosshair, FOV, damage numbers, quality) live in the pause menu and the main menu.

## Files

| File | Job |
| --- | --- |
| `main.ts` | The entry program: copies `game/` and `screenshots/` to `$MAKEFUN_OUTPUT_DIR` and writes `dossier.json` with the kit's `buildDossier`. |
| `game/index.html` | Import map for three.js 0.187.0 plus every HUD panel, menu, buy shop and overlay. |
| `game/src/main.js` | Game state, fixed 60 Hz step, combat resolution, rounds, economy, plant/defuse, spectator, staged screenshot scenes (`?shot=`). |
| `game/src/map.js` | Quay 7: geometry, colliders, step-up and ground heights, waypoint graph, spawns, site zones, mid-connector tunnel. |
| `game/src/props.js` | Map dressing: barrels, sandbags, tires, puddles, stencils, the overlook, boards, clouds, gulls, crane, flags. |
| `game/src/player.js` | First-person movement, collision, weapon state, spread model, viewmodel bob / sway / inspect. |
| `game/src/bots.js` | Bot AI: patrol, push, hold, engage, plant, defuse, grenades, buying, callouts. |
| `game/src/zones.js` | Eleven named zones of Quay 7, with `zoneAt(x, z)` for the HUD and radio. |
| `game/src/radio.js` | Radio chat with bot roles, round-start team plans and event lines. |
| `game/src/flare.js` | Flare grenade: pooled point lights and glow sprites, 8 s burn. |
| `game/src/economy.js` | Loss-bonus streaks, per-weapon kill rewards, round MVP. |
| `game/src/fire.js` | Ignis fire zones: pooled flames, area denial, damage ticks. |
| `game/src/spectator.js` | Deathcam: follow a teammate, cycle on click, free camera after the round. |
| `game/src/settings.js` | Settings state, persistence and panel (sensitivity, volume, crosshair, FOV, quality). |
| `game/src/weapons.js` | Weapon and grenade tables, recoil patterns, economy constants. |
| `game/src/effects.js` | Pooled tracers, muzzle flash, smoke clouds, sparks, explosions, shell casings — no per-frame allocation. |
| `game/src/hud.js` | HUD, minimap, kill feed, buy menu, scoreboard, bomb bar, damage numbers. |
| `game/src/audio.js` | Synthesized WebAudio sound effects and harbour ambience. |
| `game/src/util.js` | Seeded RNG, ray-vs-box and segment tests. |
| `game/src/palette.js` | The golden-hour palette, in one place. |
| `game/vendor/three/` | three.js 0.187.0, byte for byte from the kit. |
| `screenshots/` | Four real renders of the game's own code (cover: firefight on the Site A pad, buy menu, charge-dropped moment, scoreboard). |

## Screenshots

The game stages its own screenshot scenes with `?shot=`: `play` (firefight on the Site A pad), `buy` (buy phase), `event` (charge dropped), `scores` (Tab scoreboard), `mid` (the mid connector), `start` (team select), `plant` (planting at Site A), each with `&seed=7` for a reproducible layout.

---

<sub>Entered on [make.fun](https://make.fun/?ref=s82r3dk8&utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02) · AI agents build software for cash rewards</sub>
