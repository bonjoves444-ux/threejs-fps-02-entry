// Settings: mouse sensitivity, volume, crosshair, FOV, damage numbers and
// quality, persisted in localStorage and applied to the player, the sound engine,
// the HUD and the renderer. The panel is built into the pause overlay and the
// main menu, so it is reachable before a match and mid-round alike. Defaults
// match round 1's feel, so an existing player notices nothing unless they open it.
export const DEFAULT_SETTINGS = {
  sensitivity: 1.0, volume: 0.32, crosshair: 'cross', crosshairColor: '#ffffff',
  crosshairSize: 1.0, fov: 74, damageNumbers: true, quality: 'high',
};
const KEY = 'ferryline-settings-v2';

export class Settings {
  constructor() {
    this.values = { ...DEFAULT_SETTINGS };
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) Object.assign(this.values, JSON.parse(raw));
    } catch { /* private mode or no storage: defaults stand */ }
  }
  get(k) { return this.values[k]; }
  set(k, v) {
    this.values[k] = v;
    try { localStorage.setItem(KEY, JSON.stringify(this.values)); } catch { /* ignore */ }
  }
  apply(player, sfx, hud, renderer) {
    if (player) player.lookSens = this.values.sensitivity;
    if (sfx) sfx.setVolume(this.values.volume);
    if (hud) hud.applySettings(this.values);
    if (renderer) renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.values.quality === 'high' ? 1.75 : 1.0));
  }
  // Builds the settings panel inside a host element (pause card / menu card).
  // `onChange` is called after every change so the game can re-apply live.
  buildPanel(host, onChange) {
    const div = document.createElement('div');
    div.className = 'settings';
    div.innerHTML = `
      <h3>SETTINGS</h3>
      <div class="srow"><label>MOUSE SENSITIVITY <span id="setSensVal">${this.values.sensitivity.toFixed(2)}</span></label>
        <input type="range" min="0.3" max="2.5" step="0.05" value="${this.values.sensitivity}" data-k="sensitivity"></div>
      <div class="srow"><label>VOLUME <span id="setVolVal">${Math.round(this.values.volume * 100)}%</span></label>
        <input type="range" min="0" max="1" step="0.05" value="${this.values.volume}" data-k="volume"></div>
      <div class="srow"><label>FIELD OF VIEW <span id="setFovVal">${this.values.fov}°</span></label>
        <input type="range" min="60" max="100" step="1" value="${this.values.fov}" data-k="fov"></div>
      <div class="srow"><label>CROSSHAIR SIZE <span id="setXVal">${Math.round(this.values.crosshairSize * 100)}%</span></label>
        <input type="range" min="0.6" max="1.8" step="0.1" value="${this.values.crosshairSize}" data-k="crosshairSize"></div>
      <div class="srow"><label>CROSSHAIR STYLE</label>
        <select data-k="crosshair">
          <option value="cross" ${this.values.crosshair === 'cross' ? 'selected' : ''}>Cross</option>
          <option value="dot" ${this.values.crosshair === 'dot' ? 'selected' : ''}>Dot</option>
          <option value="circle" ${this.values.crosshair === 'circle' ? 'selected' : ''}>Circle</option>
        </select></div>
      <div class="srow"><label>CROSSHAIR COLOUR</label>
        <select data-k="crosshairColor">
          <option value="#ffffff" ${this.values.crosshairColor === '#ffffff' ? 'selected' : ''}>White</option>
          <option value="#37d67a" ${this.values.crosshairColor === '#37d67a' ? 'selected' : ''}>Green</option>
          <option value="#ffb02e" ${this.values.crosshairColor === '#ffb02e' ? 'selected' : ''}>Amber</option>
          <option value="#2ea8ff" ${this.values.crosshairColor === '#2ea8ff' ? 'selected' : ''}>Blue</option>
        </select></div>
      <div class="srow"><label>QUALITY</label>
        <select data-k="quality">
          <option value="high" ${this.values.quality === 'high' ? 'selected' : ''}>High (sharp)</option>
          <option value="low" ${this.values.quality === 'low' ? 'selected' : ''}>Low (fast)</option>
        </select></div>
      <div class="srow"><label>DAMAGE NUMBERS</label>
        <select data-k="damageNumbers">
          <option value="true" ${this.values.damageNumbers ? 'selected' : ''}>On</option>
          <option value="false" ${!this.values.damageNumbers ? 'selected' : ''}>Off</option>
        </select></div>`;
    div.addEventListener('input', (e) => {
      const el = e.target.closest('[data-k]');
      if (!el) return;
      const k = el.dataset.k;
      let v = el.value;
      if (el.type === 'range') v = Number(v);
      if (k === 'damageNumbers') v = v === 'true';
      this.set(k, v);
      const lab = { sensitivity: 'setSensVal', volume: 'setVolVal', fov: 'setFovVal', crosshairSize: 'setXVal' }[k];
      const span = lab && div.querySelector('#' + lab);
      if (span) span.textContent = k === 'sensitivity' ? v.toFixed(2) : k === 'volume' ? `${Math.round(v * 100)}%` : k === 'fov' ? `${v}°` : `${Math.round(v * 100)}%`;
      onChange && onChange();
    });
    host.appendChild(div);
    return div;
  }
}
