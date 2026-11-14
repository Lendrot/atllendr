/** Lesehälfte (Eddie 2026-11-14, analysis/NEUES_DESIGN.md): ab 761 px Breite teilt sich der Bildschirm 50/50.
 *  Links die Lesehälfte (Seitenleiste + Ebenen/Legende + Detail), rechts der Globus. Kästen, die bisher als Fenster über dem
 *  Globus lagen (Standort-Schalter, Vernetzungen/VF, ausgewählter Eintrag), werden in die Lesehälfte umgehängt. Am Handy
 *  (bis 760 px) bleibt alles untereinander wie bisher; dort wird nichts umgehängt. Nur Anordnung, keine Daten, keine Logik:
 *  die Kästen behalten ihre ids und Handler, sie wechseln nur den Elternknoten. Im eingebetteten Modus (?embed=1) aus. */
const BREIT = matchMedia('(min-width:761px)');

const ATLAS_ZIELE = [['.space-top .direction-key', 'ebenen'], ['.sites-toggle', 'ebenen'], ['#gesamt-panel', 'ebenen'], ['#selection-card', 'detail']];

/** ziele: [Selektor, 'ebenen'|'detail'] in Anzeigereihenfolge; /minen/ übergibt eigene (mines-globe.js). */
export function installLesehaelfte({workspace, space, ziele: auswahl = ATLAS_ZIELE}) {
  if (!workspace || !space || document.documentElement.classList.contains('embedded')) return null;
  const ebenen = document.createElement('section');
  ebenen.className = 'lese-ebenen'; ebenen.setAttribute('aria-label', 'Ebenen und Legende des Globus');
  const detail = document.createElement('div');
  detail.className = 'lese-detail';
  workspace.insertBefore(ebenen, space); workspace.insertBefore(detail, space);
  const ziele = auswahl.map(([sel, z]) => [sel, z === 'detail' ? detail : ebenen]);
  const herkunft = new Map();
  const detailOffen = () => [...detail.children].some(c => !c.hidden);
  function verteile() {
    const breit = BREIT.matches;
    for (const [sel, ziel] of ziele) for (const el of document.querySelectorAll(sel)) {
      if (breit && el.parentElement !== ziel) { if (!herkunft.has(el)) herkunft.set(el, el.parentElement); ziel.append(el); }
    }
    if (!breit) for (const [el, eltern] of herkunft) if (el.parentElement !== eltern) eltern.append(el);
    document.body.classList.toggle('lesehaelfte', breit);
    workspace.classList.toggle('detail-offen', breit && detailOffen());
  }
  new MutationObserver(verteile).observe(space, {childList: true, subtree: true});
  new MutationObserver(verteile).observe(detail, {subtree: true, attributes: true, attributeFilter: ['hidden']});
  BREIT.addEventListener('change', verteile);
  verteile();
  return {ebenen, detail};
}

installLesehaelfte({workspace: document.querySelector('#app .workspace'), space: document.querySelector('#app .space')});
