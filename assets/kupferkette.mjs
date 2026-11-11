// Kupferkette Ende-zu-Ende (Eddie 2026-11-11): rendert AUSSCHLIESSLICH /kupferkette/kette.json, den Export der Datenbank
// (scripts/analysis/kupferkette/kupferkette.py). Keine weiteren Daten, keine Berechnung von Mengen oder Werten.
// Unbekannte Angaben werden als "unbekannt" mit Grund gezeigt, nie als 0. Eine Datenbasis, zwei Ansichten (Eddie 2026-11-11):
// "Belegt" zeigt nur Ebene BELEGT, "Mit Annahmen" zusaetzlich Ebene ANNAHME, immer als Annahme markiert.
// Ausfall-Simulation: die Ergebnisse stehen fertig in kette.json (`ausfall`, gerechnet von scripts/analysis/kupferkette/ausfall.py);
// die Seite rechnet nichts nach, sie zeigt nur die Ansicht, die zum Umschalter passt.
import * as THREE from 'three';
import {OrbitControls} from './three/OrbitControls.js';

const FARBE = {VERARBEITUNG: 0xe39b3c, TRANSPORT: 0x38a8e0, HANDEL: 0x9a7fd6, LIEFERUNG: 0xe8643c};
const FARBE_ANNAHME = 0xd9dee3;
const ART_TEXT = {VERARBEITUNG: 'Verarbeitung', TRANSPORT: 'Transport', HANDEL: 'Handel (Verkauf)', LIEFERUNG: 'Lieferung'};
const FREIGABE_TEXT = {FREIGEGEBEN: 'freigegeben', KANDIDAT: 'Kandidat, nicht freigegeben', UNKNOWN: 'unbekannt', ANNAHME: 'nicht belegt'};
const EVIDENZ_TEXT = {FACT: 'Fakt laut Quelle', INFERENCE: 'Schlussfolgerung', CONFLICT: 'Quellen widersprechen sich', UNKNOWN: 'unbekannt', ANNAHME: 'Annahme',
  RECHNUNG: 'Rechnung aus belegten Werten'};
const UMFANG_TEXT = {DIREKT: 'direkter Anteil', INDIREKT: 'indirekter Anteil (nicht zu direkten addieren)', ZUGEHOERIG: 'zugehörig laut Quelle',
  AKTIONAER: 'Aktionär', AKTIONAERSSTRUKTUR: 'Aktionärsstruktur'};
const prozent = a => a === null ? '' : ` ${zahl(a)} %`;
const konf = k => k.toLocaleString('de-DE', {minimumFractionDigits: 2});
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const zahl = w => Number(w).toLocaleString('de-DE', {maximumFractionDigits: 2});
const $ = id => document.getElementById(id);
const status = {geladen: false, knoten: 0, boegen: 0, boegen_sichtbar: 0, auswahl: null, ansicht: 'belegt', ausfallModus: false, rot: []};
const zeigen = o => status.ansicht === 'annahmen' || o.ebene !== 'ANNAHME';
window.__kupferkette = status;

function wertText(m) {
  if (m.wert === null) return `<span class="unbekannt">unbekannt</span>`;
  const w = m.wert_von !== null ? `rund ${zahl(m.wert)} (${zahl(m.wert_von)} bis ${zahl(m.wert_bis)})`
    : m.wert_bis !== null ? `${zahl(m.wert)} bis ${zahl(m.wert_bis)}` : (m.ebene === 'ANNAHME' ? 'rund ' : '') + zahl(m.wert);
  return `${w} ${esc(m.einheit || '')}`;
}
function zeitraum(m) { return m.zeitraum ? `${m.zeitraum[0]} bis ${m.zeitraum[1]}` : ''; }
function chips(o) {
  if (o.ebene === 'ANNAHME') return `<span class="chip a">Annahme · ${esc(o.annahme.art)} · Konfidenz ${konf(o.annahme.konfidenz)}</span>`;
  const f = o.freigabe === 'FREIGEGEBEN' ? 'f' : o.freigabe === 'KANDIDAT' ? 'k' : '';
  return `<span class="chip">${esc(EVIDENZ_TEXT[o.evidenz] || o.evidenz)}</span><span class="chip ${f}">${esc(FREIGABE_TEXT[o.freigabe] || o.freigabe)}</span>`;
}
function belegeHtml(belege, quellen) {
  if (!belege.length) return '<p class="ub"><span class="unbekannt">Quelle: unbekannt</span></p>';
  return belege.map(b => {
    const q = quellen[b.quelle];
    const rolle = b.rolle === 'gegenprobe' ? 'Gegenprobe' : b.rolle === 'zusatzbeleg' ? 'Zusatzbeleg' : 'Beleg';
    return `<blockquote data-beleg>„${esc(b.zitat)}“<cite>${rolle} · Zitat aus: <a href="${esc(q.url)}" target="_blank" rel="noopener">${esc(q.herausgeber)}: ${esc(q.titel)}</a>`
      + `${q.veroeffentlicht ? ` · veröffentlicht ${esc(q.veroeffentlicht)}` : ''} · gelesen ${esc(q.abgerufen)}${b.fundstelle ? ` · ${esc(b.fundstelle)}` : ''}</cite></blockquote>`;
  }).join('');
}
function annahmeHtml(a, quellen) {
  const q = quellen[a.quelle];
  return `<blockquote class="annahme" data-annahme>${esc(a.begruendung)}<cite>Annahme ${esc(a.id)} (${esc(a.art)}, Konfidenz ${konf(a.konfidenz)}) · `
    + `<a href="${esc(q.url)}" target="_blank" rel="noopener">${esc(q.herausgeber)}</a>, Stand ${esc(q.veroeffentlicht)} · nicht belegt, nicht freigegeben</cite></blockquote>`;
}
function mengeHtml(m, quellen) {
  if (m.ebene === 'ANNAHME') return `<div class="annahme-box" data-annahme-menge><b>${esc(m.groesse_text)} (Annahme):</b> ${wertText(m)} ${chips(m)}`
    + `<div class="hinweis">${esc(m.freigabe_herkunft || '')}</div>${annahmeHtml(m.annahme, quellen)}</div>`;
  if (m.wert === null) return `<div class="ub" data-unbekannt><b>${esc(m.groesse_text)}:</b> <span class="unbekannt">unbekannt</span><br>${esc(m.grund_unbekannt)}</div>`;
  return `<div><b>${esc(m.groesse_text)}:</b> ${wertText(m)}${m.zeitraum ? ` <small>(${esc(zeitraum(m))})</small>` : ''} ${chips(m)}`
    + `<div class="hinweis">${esc(m.freigabe_herkunft || '')}</div>${belegeHtml(m.belege, quellen)}</div>`;
}

function eigentumHtml(s, quellen) {
  if (!s.eigentum.length) return `<div class="ub" data-unbekannt><b>Eigentümer:</b> <span class="unbekannt">unbekannt</span><br>${esc(s.eigentum_unbekannt || 'Keine gelesene Quelle nennt einen Eigentümer.')}</div>`;
  return s.eigentum.map(e => `<div data-eigentum><b>${esc(e.eigentuemer)}</b>${prozent(e.anteil)} <small>(${esc(UMFANG_TEXT[e.umfang] || e.umfang)}, Stand ${esc(e.stand)})</small> ${chips(e)}`
    + `<div class="hinweis">${esc(e.freigabe_herkunft)}${e.einschraenkung ? ` · ${esc(e.einschraenkung)}` : ''}</div>${belegeHtml(e.belege, quellen)}</div>`).join('');
}
function risikoHtml(s, quellen) {
  if (!s.risiken.length) return `<div class="ub" data-unbekannt><b>Risiko:</b> <span class="unbekannt">unbekannt</span><br>${esc(s.risiko_unbekannt || 'Für diesen Standort liegt kein belegtes Risiko vor.')}</div>`;
  return s.risiken.map(r => `<div data-risiko><b>${esc(r.art_text)}:</b> ${esc(r.text)} ${chips(r)}`
    + `<div class="hinweis">${r.rechnung ? `Rechnung: ${esc(r.rechnung)} · ` : ''}${esc(r.freigabe_herkunft)} · Stand ${esc(r.stand)}</div>${belegeHtml(r.belege, quellen)}</div>`).join('');
}
function gliederHtml(daten) {
  return daten.standorte.map(s => {
    const e = s.eigentum, h = daten.verbindungen.filter(v => v.ebene === 'BELEGT' && (v.von === s.id || v.nach === s.id)).reduce((n, v) => n + v.hinweise.length, 0);
    const eig = e.length ? `${esc(e[0].eigentuemer)}${prozent(e[0].anteil)}${e.length > 1 ? ` und ${e.length - 1} weitere` : ''}` : '<span class="unbekannt">unbekannt</span>';
    const ri = s.risiken.length ? s.risiken.map(r => esc(r.art_text)).join(', ') : '';
    const risiko = ri || h ? [ri, h ? `${h} Störungshinweis${h > 1 ? 'e' : ''} an Verbindungen` : ''].filter(Boolean).join(' · ') : '<span class="unbekannt">unbekannt</span>';
    return `<li><button type="button" data-glied="${esc(s.id)}" aria-pressed="false"><b>${esc(s.stufe)}. ${esc(s.kurz)}</b><small>Eigentümer: ${eig}</small><small>Risiko: ${risiko}</small></button></li>`;
  }).join('');
}

// --- Globus ---------------------------------------------------------------------------------------------------------
function vec(lat, lon, r = 1) {
  const phi = (90 - lat) * Math.PI / 180, theta = (lon + 180) * Math.PI / 180;
  return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
}
function bogenPunkte(a, b) {
  const va = vec(a.lat, a.lon).normalize(), vb = vec(b.lat, b.lon).normalize();
  const winkel = va.angleTo(vb), hoehe = 0.01 + Math.min(0.16, winkel * 0.12), n = 64, pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, p = new THREE.Vector3().copy(va).lerp(vb, t).normalize();
    if (winkel > 1e-6) { const s = Math.sin(winkel); p.copy(va).multiplyScalar(Math.sin((1 - t) * winkel) / s).add(vb.clone().multiplyScalar(Math.sin(t * winkel) / s)); }
    pts.push(p.multiplyScalar(1.003 + hoehe * Math.sin(Math.PI * t)));
  }
  return pts;
}

function baueGlobus(daten, waehle) {
  const host = $('globus');
  const renderer = new THREE.WebGLRenderer({antialias: true, preserveDrawingBuffer: true});
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  host.prepend(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x06121c);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 100);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.minDistance = 1.25; controls.maxDistance = 6; controls.enablePan = false;
  const erde = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), new THREE.MeshBasicMaterial({color: 0x2a4a63}));
  scene.add(erde);
  new THREE.TextureLoader().load('/assets/earth-blue-marble.jpg', t => { t.colorSpace = THREE.SRGBColorSpace; erde.material.map = t; erde.material.color.set(0xffffff); erde.material.needsUpdate = true; zeichne(); });

  // Knoten: Standorte mit gleicher Koordinate teilen sich eine Marke (z. B. Mine, Aufbereitung und Huette am selben Ort).
  const gruppen = new Map();
  for (const s of daten.standorte) {
    if (s.ort.lat === null) continue;
    const k = `${s.ort.lat.toFixed(3)},${s.ort.lon.toFixed(3)}`;
    if (!gruppen.has(k)) gruppen.set(k, {lat: s.ort.lat, lon: s.ort.lon, standorte: []});
    gruppen.get(k).standorte.push(s);
  }
  const marken = [];
  for (const g of gruppen.values()) {
    const p = vec(g.lat, g.lon, 1.004);
    const kandidat = g.standorte.every(s => s.ort.freigabe !== 'FREIGEGEBEN');
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.012, 16, 12), new THREE.MeshBasicMaterial({color: kandidat ? 0xe8643c : 0xffd27a}));
    m.position.copy(p); scene.add(m);
    for (const [i, s] of g.standorte.entries()) {
      const b = document.createElement('button');
      b.className = 'marke'; b.type = 'button'; b.dataset.standort = s.id; b.setAttribute('aria-pressed', 'false');
      b.textContent = `${s.stufe}. ${s.kurz}`; b.title = `${s.rolle}: ${s.name}`;
      b.addEventListener('click', () => waehle({typ: status.ausfallModus && s.id !== daten.ausfall?.kunde ? 'ausfall' : 'standort', id: s.id}));
      host.append(b); marken.push({el: b, pos: p, versatz: i});
    }
  }
  status.knoten = marken.length;

  const boegen = [];
  const pos = Object.fromEntries(daten.standorte.map(s => [s.id, s.ort]));
  for (const v of daten.verbindungen) {
    const a = pos[v.von], b = pos[v.nach];
    if (a.lat === null || b.lat === null || (a.lat === b.lat && a.lon === b.lon)) continue;   // gleicher Ort: nur in der Liste
    // Roehre statt 1-px-Linie (gut sichtbar und antippbar); gestrichelt = Handel oder nicht freigegeben.
    const pts = bogenPunkte(a, b), gestrichelt = v.art === 'HANDEL' || v.freigabe !== 'FREIGEGEBEN';
    const mat = new THREE.MeshBasicMaterial({color: v.ebene === 'ANNAHME' ? FARBE_ANNAHME : FARBE[v.art], transparent: true, opacity: 1});
    const gruppe = new THREE.Group(); gruppe.userData.verbindung = v.id; gruppe.userData.ebene = v.ebene; gruppe.userData.farbe = mat.color.getHex(); gruppe.userData.mat = mat;
    const stuecke = gestrichelt ? [] : [pts];
    if (gestrichelt) for (let i = 0; i + 2 < pts.length; i += 4) stuecke.push(pts.slice(i, i + 3));
    for (const st of stuecke) {
      const r = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(st), Math.max(2, st.length * 2), 0.0055, 6, false), mat);
      r.userData.verbindung = v.id; gruppe.add(r);
    }
    scene.add(gruppe); boegen.push(gruppe);
  }
  status.boegen = boegen.length;

  // Bogen antippen -> Verbindung waehlen
  const ray = new THREE.Raycaster();
  let unten = null;
  renderer.domElement.addEventListener('pointerdown', e => { unten = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener('pointerup', e => {
    if (!unten || Math.hypot(e.clientX - unten[0], e.clientY - unten[1]) > 6) return;
    const r = renderer.domElement.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1), camera);
    const treffer = ray.intersectObjects(boegen.filter(g => g.visible), true)[0];
    if (treffer) waehle({typ: 'verbindung', id: treffer.object.userData.verbindung});
  });

  const blick = vec(8, 18, host.clientWidth < host.clientHeight * 1.1 ? 4.3 : 3.2); camera.position.copy(blick); controls.update();
  let anforderung = 0;
  function zeichne() { if (!anforderung) anforderung = requestAnimationFrame(bild); }
  function bild() {
    anforderung = 0;
    const w = host.clientWidth, h = host.clientHeight;
    if (renderer.domElement.width !== Math.floor(w * renderer.getPixelRatio())) { renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
    const bewegt = controls.update();
    renderer.render(scene, camera);
    const cam = camera.position.clone().normalize();
    // Marken projizieren und ueberlappende nach oben schieben (gierig, von unten nach oben).
    const belegt = [];
    const liste = marken.map(m => { const p = m.pos.clone().project(camera); return {m, x: (p.x + 1) / 2 * w, y: (1 - p.y) / 2 * h, sichtbar: m.pos.clone().normalize().dot(cam) > 0.15}; })
      .sort((a, b) => b.y - a.y);
    for (const e of liste) {
      e.m.el.classList.toggle('weg', !e.sichtbar);
      if (!e.sichtbar) continue;
      const bw = e.m.el.offsetWidth || 120, bh = (e.m.el.offsetHeight || 20) + 3;
      let y = e.y;
      for (let n = 0; n < 12; n++) {
        const k = belegt.find(r => Math.abs(r.x - e.x) < (r.w + bw) / 2 && Math.abs(r.y - y) < bh);
        if (!k) break; y = k.y - bh;
      }
      belegt.push({x: e.x, y, w: bw});
      e.m.el.style.left = `${e.x}px`; e.m.el.style.top = `${y}px`;
    }
    if (bewegt) zeichne();
  }
  controls.addEventListener('change', zeichne);
  addEventListener('resize', zeichne);
  zeichne();
  return {
    hebe(auswahl) {
      const aus = auswahl?.typ === 'ausfall' ? ausfallAnsicht(daten, auswahl.id) : null;
      status.rot = [];
      for (const g of boegen) {
        g.visible = zeigen(g.userData);
        const rot = aus ? aus.betroffene_wege.includes(g.userData.verbindung) : false;
        const blass = (auswahl?.typ === 'verbindung' && g.userData.verbindung !== auswahl.id) || (aus && !rot);
        g.userData.mat.color.setHex(rot ? 0xd32f2f : g.userData.farbe);
        g.userData.mat.opacity = blass ? 0.2 : 1;
        if (rot && g.visible) status.rot.push(g.userData.verbindung);
      }
      status.boegen_sichtbar = boegen.filter(g => g.visible).length;
      for (const m of marken) {
        m.el.setAttribute('aria-pressed', String(['standort', 'ausfall'].includes(auswahl?.typ) && m.el.dataset.standort === auswahl.id));
        m.el.classList.toggle('aus', auswahl?.typ === 'ausfall' && m.el.dataset.standort === auswahl.id);
      }
      zeichne();
    },
  };
}

// --- Ausfall-Simulation ----------------------------------------------------------------------------------------------
const STATUS_TEXT = {BELEGT: ['belegt', 'f'], RECHNUNG: ['Rechnung aus belegten Werten', 'r'], ANNAHME: ['Annahme', 'a'], UNBEKANNT: ['unbekannt', 'u']};
const statusChip = st => `<span class="chip ${STATUS_TEXT[st][1]}" data-status="${esc(st)}">${esc(STATUS_TEXT[st][0])}</span>`;
function ausfallAnsicht(daten, id) { return daten.ausfall.glieder.find(g => g.standort === id).ansichten[status.ansicht]; }
function ausfallKnoepfe(daten) {
  const S = Object.fromEntries(daten.standorte.map(s => [s.id, s])), m = daten.ausfall.messung;
  $('ausfall-text').textContent = daten.ausfall.frage + ' Ergebnisse gerechnet aus der Datenbank; Unbekanntes bleibt unbekannt.';
  $('ausfall-knoepfe').innerHTML = daten.ausfall.glieder.map(g => `<button type="button" data-ausfall="${esc(g.standort)}" aria-pressed="false">${esc(S[g.standort].stufe)}. ${esc(S[g.standort].kurz)}</button>`).join('');
  const an = status.ansicht === 'annahmen';
  $('ausfall-mess').innerHTML = `Simulierbar: <b>${m.simulierbar} von ${m.glieder}</b> Gliedern · belegte Eingaben ${m.eingaben_belegt} von ${m.eingaben_gesamt} (${zahl(m.anteil_belegt_prozent)} %)`
    + (an ? ` · <span class="am">mit Annahmen ${m.eingaben_mit_annahmen} von ${m.eingaben_gesamt} (${zahl(m.anteil_mit_annahmen_prozent)} %)</span>` : '');
}
function wegText(daten, w) {
  const S = Object.fromEntries(daten.standorte.map(s => [s.id, s])), V = Object.fromEntries(daten.verbindungen.map(v => [v.id, v]));
  return w.map(id => V[id]).map((v, i) => (i ? '' : esc(S[v.von].kurz)) + ` → ${esc(S[v.nach].kurz)}${v.ebene === 'ANNAHME' ? ' <i class="am">(Annahme)</i>' : ''}`).join('')
    + ` <small>(${w.map(esc).join(', ')})</small>`;
}
function ausfallHtml(daten, id) {
  const S = Object.fromEntries(daten.standorte.map(s => [s.id, s])), Q = daten.quellen, a = ausfallAnsicht(daten, id), g = daten.ausfall.glieder.find(x => x.standort === id);
  const R = Object.fromEntries(daten.standorte.flatMap(s => s.risiken.map(r => [r.id, r])));
  const X = Object.fromEntries(daten.standorte.flatMap(s => (s.ersatz || []).map(e => [e.id, e])));
  const V = Object.fromEntries(daten.verbindungen.map(v => [v.id, v]));
  const kunde = S[daten.ausfall.kunde].kurz;
  const einordnung = (ids, ohne) => ids.map(i => R[i]).map(r => `<div data-einordnung><b>${esc(r.art_text)} (belegt, ${ohne}):</b> ${esc(r.text)} ${chips(r)}${belegeHtml(r.belege, Q)}</div>`).join('');
  const t = a.tonnen;
  let tonnen = t.status === 'BELEGT' ? `<b>${zahl(t.kt)} kt</b>` : `<b>Belegt:</b> <span class="unbekannt">unbekannt</span>. ${esc(t.grund)}`;
  if (t.obergrenze) tonnen += `<div data-obergrenze>Obergrenze: höchstens <b>${zahl(t.obergrenze.kt)} kt</b> ${statusChip('RECHNUNG')}<div class="hinweis">${esc(t.obergrenze.rechnung)} · ${esc(t.obergrenze.hinweis)}</div></div>`;
  if (t.annahme) tonnen += `<div class="annahme-box" data-annahme-ausfall><b>Annahme:</b> rund ${zahl(t.annahme.kt)} ${esc(t.annahme.einheit)} (${zahl(t.annahme.von)} bis ${zahl(t.annahme.bis)}) `
    + `<span class="chip a">Annahme · ${t.annahme.annahmen.map(esc).join(', ')} · Konfidenz ${konf(t.annahme.konfidenz)}</span><div class="hinweis">Rechnung: ${esc(t.annahme.rechnung)} · nicht belegt, nicht freigegeben</div></div>`;
  const e = a.ersatz;
  let ersatz = e.wege.length ? `<p style="margin:2px 0">Erfasste Ausweichwege zu ${esc(kunde)}:</p><ul>${e.wege.map(w => `<li>${wegText(daten, w)}</li>`).join('')}</ul>` : '';
  ersatz += e.angaben.map(i => X[i]).map(x => `<div data-ersatz><b>${esc(S[x.id.split('-')[1]].kurz)}:</b> ${esc(x.text)} ${chips(x)}${belegeHtml(x.belege, Q)}</div>`).join('');
  if (e.status === 'UNBEKANNT') ersatz = `<div class="ub" data-unbekannt><b>Benannter Ersatzlieferant:</b> <span class="unbekannt">unbekannt</span><br>${esc(e.grund)}</div>` + ersatz;
  const folge = (titel, st, inhalt) => `<div class="folge" data-folge="${esc(titel)}"><h3>${esc(titel)} ${statusChip(st)}</h3>${inhalt}</div>`;
  const tst = t.status !== 'UNBEKANNT' ? t.status : t.annahme ? 'ANNAHME' : 'UNBEKANNT';
  return `<h2>Ausfall: ${esc(S[id].name)}</h2><p class="eyebrow">Ausfall-Simulation · Ansicht ${status.ansicht === 'annahmen' ? 'Mit Annahmen' : 'Belegt'} · Schlussfolgerung, kein Fakt</p>`
    + `<div class="lage" data-lage>${a.kunde_abgeschnitten ? '<b>Kette zu ' + esc(kunde) + ' unterbrochen.</b> ' : '<b>Kette zu ' + esc(kunde) + ' nicht unterbrochen.</b> '}${esc(a.lage)}</div>`
    + `<div class="folgen">`
    + folge(`Fehlende Tonnen bei ${kunde}`, tst, tonnen)
    + folge('Mehrkosten', a.mehrkosten.status, `${esc(a.mehrkosten.grund)}${einordnung(a.mehrkosten.einordnung, 'keine Mehrkosten-Zahl')}`)
    + folge('Dauer', a.dauer.status, `${esc(a.dauer.grund)}${einordnung(a.dauer.einordnung, 'nennt keine Dauer')}`)
    + folge('Ersatz', e.status, ersatz)
    + `</div><h3 style="font-size:14px;margin:10px 0 2px">Betroffene Verbindungen (rot auf dem Globus)</h3>`
    + (a.betroffene_wege.length ? `<ul>${a.betroffene_wege.map(v => `<li>${esc(v)} ${esc(S[V[v].von].kurz)} → ${esc(S[V[v].nach].kurz)}${V[v].ebene === 'ANNAHME' ? ' <i class="am">(Annahme)</i>' : ''}</li>`).join('')}</ul>` : '<p class="hinweis">keine</p>')
    + (g.m6_betroffen.length ? `<h3 style="font-size:14px;margin:10px 0 2px">Regel Meilenstein 6: wer verliert einen erfassten Abnehmer</h3><ul>${g.m6_betroffen.map(b => `<li>${esc(S[b.standort].kurz)}: `
      + (b.andere_gleicher_art.length ? `weitere erfasste Wege gleicher Art: ${b.andere_gleicher_art.map(x => esc(S[x].kurz)).join(', ')}` : 'kein weiterer erfasster Weg gleicher Art') + '</li>').join('')}</ul>` : '')
    + `<h3 style="font-size:14px;margin:10px 0 2px">Eingaben dieser Simulation: ${a.eingaben_belegt} von ${a.eingaben.length} belegt</h3><ul data-eingaben>${a.eingaben.map(x => `<li>${esc(x.text)}: ${statusChip(x.status)}</li>`).join('')}</ul>`
    + `<p class="hinweis">${daten.ausfall.regeln.map(esc).join(' ')}</p>`;
}

// --- Panel ----------------------------------------------------------------------------------------------------------
function listenMenge(v) {
  const b = v.mengen.find(m => m.groesse === 'LIEFERMENGE' && m.ebene === 'BELEGT');
  const a = v.mengen.find(m => m.groesse === 'LIEFERMENGE' && m.ebene === 'ANNAHME');
  if (b && b.wert !== null) return wertText(b);
  if (status.ansicht === 'annahmen' && a) return `${wertText(a)} <i class="am">(Annahme)</i>`;
  return '<span class="unbekannt">unbekannt</span>';
}
function antwort(daten) {
  const S = Object.fromEntries(daten.standorte.map(s => [s.id, s]));
  const ende = Math.max(...daten.standorte.map(s => s.stufe));
  const z = daten.zaehler, an = status.ansicht === 'annahmen';
  const zuKunde = daten.verbindungen.filter(v => S[v.nach].stufe === ende && v.ebene === 'BELEGT');
  const zeilen = [`Belegter Weg bis zum Kunden: ${z.verbindungen} Verbindungen, ${z.verbindungen_freigegeben} freigegeben, ${z.verbindungen_kandidat} Kandidat.`];
  for (const v of zuKunde) {
    zeilen.push(`${esc(S[v.von].kurz)} → ${esc(S[v.nach].kurz)}: ${esc(FREIGABE_TEXT[v.freigabe])}.`);
    const b = v.mengen.find(m => m.groesse === 'LIEFERMENGE' && m.ebene === 'BELEGT');
    zeilen.push(b.wert === null ? `Menge: <span class="unbekannt">unbekannt</span> (${esc(b.grund_unbekannt)})` : `Menge: ${wertText(b)}`);
    const a = v.mengen.find(m => m.groesse === 'LIEFERMENGE' && m.ebene === 'ANNAHME');
    if (an && a) zeilen.push(`<span class="am">Annahme: ${wertText(a)}, ${esc(a.annahme.art)}, Konfidenz ${konf(a.annahme.konfidenz)}.</span>`);
  }
  if (an) zeilen.push(`<span class="am">Mit Annahmen: ${z.annahmen_verbindungen} angenommene Wege, ${z.annahmen_mengen} angenommene Mengen; Liefermenge an ${z.verbindungen_mit_liefermenge_inkl_annahmen} von ${z.verbindungen + z.annahmen_verbindungen} Verbindungen (belegt: ${z.verbindungen_mit_liefermenge}).</span>`);
  return `<div class="frage"><p class="eyebrow">Kundenfrage ${esc(daten.kundenfrage.kunde)}</p><p><b>${esc(daten.kundenfrage.frage)}</b></p><ul id="antwort">${zeilen.map(t => `<li>${t}</li>`).join('')}</ul></div>`;
}
function panel(daten) {
  const S = Object.fromEntries(daten.standorte.map(s => [s.id, s]));
  const z = daten.zaehler, an = status.ansicht === 'annahmen';
  $('titel').textContent = `${daten.rohstoff}: ${daten.kette.replaceAll('->', '→')}`;
  $('einleitung').textContent = daten.begruendung;
  for (const b of document.querySelectorAll('[data-ansicht]')) b.setAttribute('aria-pressed', String(b.dataset.ansicht === status.ansicht));
  $('ansicht-text').textContent = daten.ansichten[status.ansicht];
  $('frage').innerHTML = antwort(daten);
  $('kpis').innerHTML = [
    [an ? z.verbindungen + z.annahmen_verbindungen : z.verbindungen, an ? 'Verbindungen (inkl. Annahmen)' : 'Verbindungen'], [`${z.verbindungen_freigegeben}/${z.verbindungen}`, 'belegte freigegeben'], [z.standorte, 'Standorte'],
    [z.mengen_belegt, 'Werte belegt'], an ? [z.annahmen_mengen, 'Werte als Annahme'] : [z.mengen_unbekannt, 'Werte unbekannt'], [z.quellen, 'Quellen'],
  ].map(([w, t]) => `<div class="kpi"><strong>${esc(w)}</strong><span>${esc(t)}</span></div>`).join('');
  $('glieder').innerHTML = gliederHtml(daten);
  ausfallKnoepfe(daten);
  $('liste').innerHTML = daten.verbindungen.filter(zeigen).map(v => {
    const gleich = S[v.von].ort.lat === S[v.nach].ort.lat && S[v.von].ort.lon === S[v.nach].ort.lon;
    return `<li><button type="button" data-verbindung="${esc(v.id)}" data-ebene="${esc(v.ebene)}" aria-pressed="false"><b>${esc(v.id)}</b> ${esc(S[v.von].name)} → ${esc(S[v.nach].name)}`
      + `<small>${esc(ART_TEXT[v.art])} · ${esc(v.ware)} · Menge: ${listenMenge(v)}${gleich ? ' · am selben Standort' : ''}</small>${chips(v)}</button></li>`;
  }).join('');
  $('fuss').innerHTML = `Stand ${esc(daten.stand)} · Daten: <a href="/kupferkette/kette.json">kette.json</a> (${esc(daten.schema)}, aus ${esc(daten.db_schema)}) · ${daten.regeln.map(esc).join(' ')}`;
}

function detail(daten, auswahl) {
  const S = Object.fromEntries(daten.standorte.map(s => [s.id, s])), Q = daten.quellen;
  for (const b of document.querySelectorAll('[data-verbindung]')) b.setAttribute('aria-pressed', String(auswahl?.typ === 'verbindung' && b.dataset.verbindung === auswahl.id));
  for (const b of document.querySelectorAll('[data-glied]')) b.setAttribute('aria-pressed', String(auswahl?.typ === 'standort' && b.dataset.glied === auswahl.id));
  for (const b of document.querySelectorAll('[data-ausfall]')) b.setAttribute('aria-pressed', String(auswahl?.typ === 'ausfall' && b.dataset.ausfall === auswahl.id));
  if (!auswahl) { $('detail').innerHTML = '<p class="hinweis">Verbindung in der Liste, Bogen oder Ort auf dem Globus antippen: Quelle und Zitat erscheinen hier.</p>'; return; }
  if (auswahl.typ === 'ausfall') { $('detail').innerHTML = ausfallHtml(daten, auswahl.id); return; }
  if (auswahl.typ === 'verbindung') {
    const v = daten.verbindungen.find(x => x.id === auswahl.id);
    const quelle = v.ebene === 'ANNAHME' ? `<h3 style="font-size:14px;margin:10px 0 2px">Begründung (keine Quelle)</h3>${annahmeHtml(v.annahme, Q)}`
      : `<h3 style="font-size:14px;margin:10px 0 2px">Quelle</h3>${belegeHtml(v.belege, Q)}`;
    $('detail').innerHTML = `<h2>${esc(S[v.von].name)} → ${esc(S[v.nach].name)}</h2>${chips(v)}<dl>`
      + `<dt>Art</dt><dd>${esc(ART_TEXT[v.art])} (${esc(v.art_atlas)})${v.transportweg ? ', ' + esc(v.transportweg === 'RAIL' ? 'Bahn' : v.transportweg) : ''}</dd>`
      + `<dt>Ware</dt><dd>${esc(v.ware)}</dd><dt>Stand</dt><dd>${esc(v.stand)} (${v.ebene === 'ANNAHME' ? 'Stand des Annahmen-Atlas' : 'Datum der Quelle'})</dd>`
      + `<dt>Freigabe</dt><dd>${esc(v.freigabe_herkunft)}</dd>${v.einschraenkung ? `<dt>Einschränkung</dt><dd>${esc(v.einschraenkung)}</dd>` : ''}</dl>`
      + v.mengen.filter(zeigen).map(m => mengeHtml(m, Q)).join('')
      + v.hinweise.map(h => `<div class="ub"><b>Hinweis (${esc(h.stand)}):</b> ${esc(h.text)}${belegeHtml(h.belege, Q)}</div>`).join('')
      + quelle;
  } else {
    const s = S[auswahl.id];
    const ort = s.ort.lat === null ? '<span class="unbekannt">unbekannt</span>' : `${zahl(s.ort.lat)}, ${zahl(s.ort.lon)} (${esc(s.ort.genauigkeit)}, ${esc(FREIGABE_TEXT[s.ort.freigabe])})`;
    const mengen = s.mengen.filter(zeigen);
    $('detail').innerHTML = `<h2>${esc(s.name)}</h2><dl><dt>Rolle</dt><dd>${esc(s.stufe)}. ${esc(s.rolle)}</dd><dt>Land</dt><dd>${s.land ? esc(s.land) : '<span class="unbekannt">unbekannt</span>'}</dd>`
      + `<dt>Unternehmen</dt><dd>${s.firma ? esc(s.firma) : '<span class="unbekannt">unbekannt</span>'}${s.betreiber_einschraenkung ? ` <small>(${esc(s.betreiber_einschraenkung)})</small>` : ''}</dd>`
      + `<dt>Ort</dt><dd>${ort}</dd></dl>`
      + (mengen.length ? mengen.map(m => mengeHtml(m, Q)).join('') : '<div class="ub" data-unbekannt><b>Menge:</b> <span class="unbekannt">unbekannt</span><br>Für diesen Standort nennt keine gelesene Quelle eine Menge.</div>')
      + (s.betreiber_belege.length ? `<h3 style="font-size:14px;margin:10px 0 2px">Beleg Betreiber</h3>${belegeHtml(s.betreiber_belege, Q)}` : '')
      + `<h3 style="font-size:14px;margin:10px 0 2px">Eigentümer</h3>${eigentumHtml(s, Q)}`
      + `<h3 style="font-size:14px;margin:10px 0 2px">Risiko</h3>${risikoHtml(s, Q)}`
      + `<h3 style="font-size:14px;margin:10px 0 2px">Beleg Ort</h3>${belegeHtml(s.ort.belege, Q)}`;
  }
}

async function start() {
  let daten;
  try {
    const r = await fetch('/kupferkette/kette.json');
    if (!r.ok) throw Error('kette.json ' + r.status);
    daten = await r.json();
    if (daten.schema !== 'atlas.kupferkette-globus/4') throw Error('unbekanntes Schema ' + daten.schema);
  } catch (e) { $('titel').textContent = 'Kupferkette konnte nicht geladen werden'; $('detail').innerHTML = `<p class="fehler">${esc(e.message)}</p>`; return; }
  const par = new URLSearchParams(location.search);
  status.ansicht = par.get('ansicht') === 'annahmen' ? 'annahmen' : 'belegt';
  panel(daten);
  let globus = null;
  const waehle = a => {
    if (a?.typ === 'verbindung' && !zeigen(daten.verbindungen.find(v => v.id === a.id))) a = null;
    status.auswahl = a; detail(daten, a); globus?.hebe(a);
    const url = new URL(location.href); url.searchParams.delete('w'); url.searchParams.delete('ausfall');
    if (a) url.searchParams.set(a.typ === 'ausfall' ? 'ausfall' : 'w', a.id);
    if (status.ansicht === 'annahmen') url.searchParams.set('ansicht', 'annahmen'); else url.searchParams.delete('ansicht');
    history.replaceState(null, '', url);
  };
  $('umschalter').addEventListener('click', e => {
    const b = e.target.closest('[data-ansicht]'); if (!b || b.dataset.ansicht === status.ansicht) return;
    status.ansicht = b.dataset.ansicht; panel(daten); waehle(status.auswahl);
  });
  $('ausfall-knoepfe').addEventListener('click', e => { const b = e.target.closest('[data-ausfall]'); if (b) waehle({typ: 'ausfall', id: b.dataset.ausfall}); });
  $('ausfall-an').addEventListener('click', () => {
    status.ausfallModus = !status.ausfallModus; $('ausfall-an').setAttribute('aria-pressed', String(status.ausfallModus));
    if (!status.ausfallModus && status.auswahl?.typ === 'ausfall') waehle(null);
  });
  $('glieder').addEventListener('click', e => { const b = e.target.closest('[data-glied]'); if (b) waehle({typ: 'standort', id: b.dataset.glied}); });
  $('liste').addEventListener('click', e => { const b = e.target.closest('[data-verbindung]'); if (b) waehle({typ: 'verbindung', id: b.dataset.verbindung}); });
  try { globus = baueGlobus(daten, waehle); } catch (e) { $('globus').insertAdjacentHTML('beforeend', `<p class="fehler">3D-Ansicht nicht verfügbar: ${esc(e.message)}</p>`); }
  const w = par.get('w'), af = par.get('ausfall');
  if (af && daten.ausfall.glieder.some(g => g.standort === af)) { status.ausfallModus = true; $('ausfall-an').setAttribute('aria-pressed', 'true'); waehle({typ: 'ausfall', id: af}); }
  else waehle(w && daten.verbindungen.some(v => v.id === w) ? {typ: 'verbindung', id: w} : w && daten.standorte.some(s => s.id === w) ? {typ: 'standort', id: w} : null);
  status.geladen = true;
}
start();
