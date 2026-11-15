// Radio: bot roles and the team radio. Every bot has a job, and the radio
// lines carry real information — who, what role, where, and what to do about
// it — so the player can play off their teammates instead of guessing.
// Roles are shown in radio lines and on the scoreboard.
export const ROLE_FOR = {
  Kael: 'Anchor', Mara: 'Support', Ilya: 'Entry', Sef: 'Mid Lurk', Dune: 'Anchor',
  Vex: 'Entry', Jax: 'Support', Sol: 'Mid Lurk', Rook: 'AWPer', Nix: 'Anchor',
};

export class Radio {
  constructor(hud) { this.hud = hud; }
  line(bot, text) {
    const role = ROLE_FOR[bot.name] || 'Support';
    this.hud.radio(bot.name, role, text);
  }
  // Round-start team plan: attackers split — the carrier and one mate push the
  // site mouth, two more flank through Mid Arch. The flankers really do take
  // that route (main.js sets their planVia); the line is the plan, not flavour.
  plan(attackers, site, flankers) {
    const carrier = attackers.find((b) => b.carrier) || attackers[0];
    const direct = attackers.filter((b) => b !== carrier && !flankers.includes(b));
    const mouth = site === 'A' ? 'Bow Ramp' : 'Container Yard';
    const parts = [];
    if (carrier) parts.push(`${carrier.name} + ${direct[0] ? direct[0].name : 'me'} through ${mouth}`);
    if (flankers.length) parts.push(`${flankers.map((b) => b.name).join(' + ')} through Mid Arch`);
    this.hud.radio(carrier ? carrier.name : 'Vex', 'Entry',
      `Going ${site}: ${parts.join(' · ')} — execute on my mark`);
  }
  holdPlan(defenders) {
    const a = defenders[0], b = defenders[1];
    this.hud.radio(a ? a.name : 'Kael', 'Anchor',
      `Holding: ${a ? a.name : '—'} on Site A, ${b ? b.name : '—'} on Site B, rest mid`);
  }
  contact(bot, zone, count) {
    this.line(bot, `Contact ${zone} — ${count > 1 ? `${count} spotted!` : 'one spotted!'}`);
  }
  rotate(bot, site) {
    this.line(bot, `Gunfire heard — rotating to Site ${site}!`);
  }
  drop(bot, zone) {
    this.line(bot, `Charge dropped — ${zone}! Pick it up!`);
  }
  planted(site) {
    this.hud.radio('Rook', 'AWPer', `Charge planted — Site ${site}! Hold it!`);
  }
}
