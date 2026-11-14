/** Ruhestellung Afrika (Eddie 2026-11-14, analysis/NEUES_DESIGN.md): nach 7 s ohne Bedienung, wenn nichts offen ist, dreht sich
 *  der Globus sanft auf Afrika (0° N, 20° O) mit waagerechtem Äquator (Kamera auf dem Äquator, Norden oben) und
 *  Weltabstand. Jede Bedienung (Zeiger, Rad, Taste, Berührung) startet die 7 s neu. Die Seite sagt über `offen()`, ob gerade
 *  etwas geöffnet ist (Detail, Länderansicht, Dialog, Auswahl); dann bleibt der Globus, wo er ist.
 *  Automatisierte Browser (navigator.webdriver) sind ausgenommen, damit Tests mit fest berechneten Bildpunkten stabil
 *  bleiben; `?ruhe=<Sekunden>` schaltet es dort ein (Test der Funktion selbst). */
export const AFRIKA = {lat: 0, lon: 20};
const param = () => new URLSearchParams(location.search).get('ruhe');

// ruhe: Wert von ?ruhe= zum Ladezeitpunkt, für Seiten, die ihre Adresse vor dem Globus umschreiben (/indien/).
export function installRuhe(engine, {offen = () => false, sekunden = 7, ruhe = param()} = {}) {
  const p = ruhe;
  if (p === 'aus' || (navigator.webdriver && p === null)) return null;
  const warte = (p && Number(p) > 0 ? Number(p) : sekunden) * 1000;
  let camera = null;
  engine.addLayer(m => { camera = m.camera; });
  let letzte = performance.now(), zentriert = false;
  const bedient = () => { letzte = performance.now(); zentriert = false; delete document.documentElement.dataset.ruhe; };
  for (const t of ['pointerdown', 'pointermove', 'wheel', 'keydown', 'touchstart']) addEventListener(t, bedient, {passive: true, capture: true});
  const state = {zentriert: 0};
  const pruefe = () => {
    if (zentriert || document.hidden || performance.now() - letzte < warte) return;
    if (engine.isRotating?.() || document.body.classList.contains('globe-intro') || offen()) return;
    zentriert = true;
    camera?.up.set(0, 1, 0);
    engine.focusLocation(AFRIKA.lat, AFRIKA.lon, engine.homeDistance());
    state.zentriert++;
    document.documentElement.dataset.ruhe = 'afrika';
  };
  setInterval(pruefe, 500);
  window.__globusRuhe = state;
  return state;
}
