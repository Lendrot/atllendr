// VF-Legende (Eddie 2026-11-09): dauerhaft sichtbare Legende aller Vernetzungsfraktionen (VF) auf dem Globus-Bildschirm.
// Klick auf eine VF: die Welt geht wieder auf die Gesamtansicht (wie beim Öffnen) und zeigt nur die Verbindungen dieser VF.
// Über das Menü "+ VF" lassen sich weitere VF hinzuschalten (oder wieder abschalten); "Alle" zeigt wieder alles.
// Dieselbe Datei steckt unverändert im Hauptatlas (Atlas-Lendrot) und im Annahmen-Atlas (atlaslendrot): gleiche Bedienlogik.
// Die Legende kennt keinen Globus: der Atlas liefert Gruppen, Zustand und zwei Rückrufe.
//   gruppen(): [{id, titel, items:[{id, name, farbe:'#rrggbb', strich:bool, zahl:Number|null}]}]
//   istAn(gruppe, item) -> bool
//   schalte([[gruppe, item, an], ...]) wendet alle Änderungen auf einmal an
//   fokus() fährt die Kamera auf die Gesamtansicht
//   extra: optionales HTML unter den VF (z. B. Standort-Arten), rein beschreibend
//   zu: true startet zugeklappt (nur Kopfzeile)
const STIL = `.vf{display:flex;flex-direction:column;gap:6px;pointer-events:auto;font-size:12.5px;line-height:1.3;color:#1d3247}
.vf-kopf{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.vf-kopf b{font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#3e5a74;margin-right:auto}
.vf-kopf small{color:#5b7690;font-variant-numeric:tabular-nums}
.vf button{font:inherit;cursor:pointer}
.vf-knopf{border:1px solid #c9d8e6;background:#fff;color:#0b4f92;border-radius:999px;padding:3px 10px;min-height:28px;font-weight:600}
.vf-knopf:hover{background:#eef6fd}
.vf-knopf[aria-expanded=true]{background:#0b4f92;color:#fff;border-color:#0b4f92}
.vf-liste{display:flex;flex-direction:column;gap:4px;max-height:var(--vf-hoehe,30vh);overflow:auto;overscroll-behavior:contain}
.vf-gruppe{display:flex;flex-wrap:wrap;align-items:center;gap:4px}
.vf-gruppe>span{font-size:11px;color:#5b7690;min-width:74px}
.vf-item{display:inline-flex;align-items:center;gap:6px;border:1px solid #c9d8e6;background:#fff;border-radius:8px;padding:3px 8px;min-height:28px;color:#1d3247;text-align:left}
.vf-item i{display:inline-block;width:18px;height:0;border-top:3px solid;flex:none}
.vf-item small{color:#5b7690;font-variant-numeric:tabular-nums}
.vf-item[aria-pressed=false]{opacity:.42;background:#f3f6f9}
.vf-item[aria-pressed=false] i{border-top-style:dotted}
.vf-item:hover{border-color:#1378ba;opacity:1}
.vf-item:focus-visible,.vf-knopf:focus-visible{outline:2px solid #1378ba;outline-offset:1px}
.vf-menue{border-top:1px solid #dbe5ee;padding-top:6px;display:flex;flex-direction:column;gap:0;max-height:var(--vf-hoehe,30vh);overflow:auto}
.vf-menue-offen .vf-liste{display:none}
.vf-menue[hidden]{display:none}
.vf-menue p{margin:0 0 2px;color:#3e5a74}
.vf-menue fieldset{border:0;margin:0 0 4px;padding:0;min-width:0}
.vf-menue legend{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#5b7690;padding:0}
.vf-menue label{display:flex;align-items:center;gap:8px;min-height:28px;cursor:pointer}
.vf-menue input{width:17px;height:17px;margin:0;accent-color:#1378ba}
.vf-menue label i{display:inline-block;width:16px;height:0;border-top:3px solid;flex:none}
.vf-menue label small{margin-left:auto;color:#5b7690}
.vf-extra{display:flex;flex-wrap:wrap;gap:4px 12px;color:#3e5a74}
.vf-extra:empty{display:none}
.vf-zu .vf-kopf{flex-wrap:nowrap}.vf-zu .vf-kopf b{margin-right:4px}
.vf-zu .vf-liste,.vf-zu .vf-menue,.vf-zu .vf-extra,.vf-zu [data-vf=menue],.vf-zu [data-vf=alle]{display:none}`;

const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const zahl = n => n == null ? '' : '<small>' + Number(n).toLocaleString('de-DE') + '</small>';
const strich = x => 'border-top-color:' + esc(x.farbe || '#888') + (x.strich ? ';border-top-style:dashed' : '');

export function vfLegende(el, opt) {
  if (!document.getElementById('vf-stil')) { const s = document.createElement('style'); s.id = 'vf-stil'; s.textContent = STIL; document.head.appendChild(s); }
  let menueOffen = false;
  // Offen, außer der Atlas wünscht zugeklappt (opt.zu, z. B. auf dem Handy über dem Globus); zuklappen per Knopf.
  let zu = !!opt.zu;
  const alle = () => opt.gruppen().filter(g => g.items.length);
  function zeichne() {
    const gs = alle(), rollen = [...el.querySelectorAll('.vf-liste,.vf-menue')].map(x => x.scrollTop);
    if (!gs.length) { el.innerHTML = ''; el.hidden = true; return; }
    el.hidden = false;
    let n = 0, an = 0;
    gs.forEach(g => g.items.forEach(x => { n++; if (opt.istAn(g.id, x.id)) an++; }));
    el.classList.add('vf'); el.classList.toggle('vf-zu', zu); el.classList.toggle('vf-menue-offen', menueOffen && !zu);
    el.dataset.vfAktiv = an; el.dataset.vfGesamt = n;
    el.innerHTML = '<div class="vf-kopf"><b>' + (zu ? 'VF' : 'Vernetzungen (VF)') + '</b><small>' + an + ' von ' + n + (zu ? '' : ' aktiv') + '</small>' +
      '<button type="button" class="vf-knopf" data-vf="alle"' + (an === n ? ' disabled' : '') + '>Alle</button>' +
      '<button type="button" class="vf-knopf" data-vf="menue" aria-expanded="' + menueOffen + '" aria-controls="vf-menue">＋ VF</button>' +
      '<button type="button" class="vf-knopf" data-vf="zu" aria-expanded="' + !zu + '" aria-label="Legende ' + (zu ? 'aufklappen' : 'zuklappen') + '">' + (zu ? '▴' : '▾') + '</button></div>' +
      '<div class="vf-liste" role="group" aria-label="Vernetzungsfraktionen: Klick zeigt nur diese">' +
      gs.map(g => '<div class="vf-gruppe">' + (gs.length > 1 ? '<span>' + esc(g.titel) + '</span>' : '') +
        g.items.map(x => '<button type="button" class="vf-item" data-g="' + esc(g.id) + '" data-i="' + esc(x.id) + '" aria-pressed="' + opt.istAn(g.id, x.id) + '" title="Nur ' + esc(x.name) + ' zeigen">' +
          '<i style="' + strich(x) + '"></i>' + esc(x.name) + zahl(x.zahl) + '</button>').join('') + '</div>').join('') + '</div>' +
      '<div class="vf-menue" id="vf-menue"' + (menueOffen ? '' : ' hidden') + '><p>Weitere Vernetzungen hinzuschalten:</p>' +
      gs.map(g => '<fieldset data-gruppe="' + esc(g.id) + '"><legend>' + esc(g.titel) + '</legend>' + g.items.map(x => '<label><input type="checkbox" data-g="' + esc(g.id) + '" data-i="' + esc(x.id) + '"' +
        (opt.istAn(g.id, x.id) ? ' checked' : '') + '><i style="' + strich(x) + '"></i>' + esc(x.name) + zahl(x.zahl) + '</label>').join('') + '</fieldset>').join('') + '</div>' +
      '<div class="vf-extra">' + (opt.extra ? opt.extra() : '') + '</div>';
    el.querySelectorAll('.vf-liste,.vf-menue').forEach((x, i) => { x.scrollTop = rollen[i] || 0; });
  }
  // Klick auf eine VF: in ihrer Gruppe nur sie, alle anderen Gruppen ganz an (damit die ganze Fraktion sichtbar ist), dann Gesamtansicht.
  function nur(gid, iid) {
    const ae = [];
    alle().forEach(g => g.items.forEach(x => ae.push([g.id, x.id, g.id === gid ? x.id === iid : true])));
    opt.schalte(ae); opt.fokus(); zeichne();
  }
  el.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || !el.contains(b)) return;
    if (b.dataset.vf === 'alle') { const ae = []; alle().forEach(g => g.items.forEach(x => ae.push([g.id, x.id, true]))); opt.schalte(ae); opt.fokus(); zeichne(); }
    else if (b.dataset.vf === 'menue') { menueOffen = !menueOffen; zeichne(); }
    else if (b.dataset.vf === 'zu') { zu = !zu; if (zu) menueOffen = false; zeichne(); }
    else if (b.classList.contains('vf-item')) nur(b.dataset.g, b.dataset.i);
  });
  el.addEventListener('change', e => {
    const c = e.target; if (!c.matches('.vf-menue input')) return;
    opt.schalte([[c.dataset.g, c.dataset.i, c.checked]]); opt.fokus(); zeichne();
    const neu = el.querySelector('.vf-menue input[data-g="' + CSS.escape(c.dataset.g) + '"][data-i="' + CSS.escape(c.dataset.i) + '"]'); if (neu) neu.focus();
  });
  zeichne();
  return {zeichne, nur};
}
