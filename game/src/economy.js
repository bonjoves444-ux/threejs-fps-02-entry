// Match economy: loss-bonus streaks, per-weapon kill rewards and MVP picks.
// CS-style: losing rounds in a row pays more each time, so a broke team can
// force-buy back; a knife kill pays like a statement, a scoped-rifle kill pays
// like a tax. All amounts are in the game's dollars.
export const LOSS_BONUS = [1900, 2400, 2900, 3400]; // 1st, 2nd, 3rd, 4th+ loss in a row
export const KILL_REWARD = {
  p9: 300, smg: 300, carbine: 300, shotgun: 300, dmr: 300, lmg: 300,
  revolver: 300, scoped: 100, knife: 1500, FRAG: 300, IGNIS: 300,
};
export function lossBonus(streak) {
  return LOSS_BONUS[Math.max(0, Math.min(streak - 1, LOSS_BONUS.length - 1))];
}
// MVP of a round: most kills wins; the planter or defuser breaks ties, then
// most damage dealt. Returns the actor or null.
export function roundMvp(actors, roundKills, planter, defuser) {
  let best = null, bestScore = -1;
  for (const a of actors) {
    const k = roundKills.get(a) || 0;
    let s = k * 100 + (a.damageDealt || 0) / 10;
    if (a === planter) s += 40;
    if (a === defuser) s += 60;
    if (s > bestScore) { bestScore = s; best = a; }
  }
  return best;
}
