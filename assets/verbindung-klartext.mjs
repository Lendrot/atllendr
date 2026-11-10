/** Verbindungen in Klartext (Eddie 2026-11-10): oben steht, welche Verbindung es ist, warum sie besteht und die wichtigsten
 *  Angaben dazu; Kennungen, Koordinaten und Rohquellen stehen eingeklappt unter „Technische Angaben“.
 *  Eine Datei, byte-gleich in beiden Atlanten (Hauptatlas dist/assets + ma-intelligence/site/dist/assets, Annahmen-Atlas site/assets).
 *  Nur Anzeige: Evidenz- und Prüfstatus werden übersetzt, nie verändert. Unbekanntes bleibt „unbekannt“. */

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

// Art eines Standorts → [Wort, Genus m/f/n]. Schlüssel klein, ohne Klammerzusatz.
const ART = {
  mine: ['Mine', 'f'], mine_complex: ['Mine', 'f'], 'mine (kandidat, altliste)': ['Mine', 'f'], bergwerk: ['Bergwerk', 'n'],
  smelter: ['Hütte', 'f'], smelter_refinery: ['Hütte und Raffinerie', 'f'], refinery: ['Raffinerie', 'f'], raffinerie: ['Raffinerie', 'f'],
  hütte: ['Hütte', 'f'], concentrator: ['Aufbereitungsanlage', 'f'], sx_ew_plant: ['SX-EW-Anlage', 'f'],
  processing_facility: ['Verarbeitungsanlage', 'f'], processing_facility_reference: ['Verarbeitungsanlage', 'f'], processing_complex: ['Verarbeitungsanlage', 'f'],
  processing_group: ['Verarbeiter', 'm'], verarbeitung: ['Verarbeitungsanlage', 'f'], konversion: ['Konversionsanlage', 'f'],
  port: ['Hafen', 'm'], port_reference: ['Hafen', 'm'], hafen: ['Hafen', 'm'], terminal: ['Terminal', 'n'], 'logistik / terminal': ['Terminal', 'n'],
  company: ['Unternehmen', 'n'], unternehmen: ['Unternehmen', 'n'], corporate_group_reference: ['Konzern', 'm'], konzernsitz: ['Konzern', 'm'],
  'weiterer konzernsitz': ['Konzern', 'm'], 'konzernstandort': ['Standort', 'm'], downstream_company_reference: ['Abnehmer', 'm'],
  joint_venture: ['Gemeinschaftsunternehmen', 'n'], government: ['Staat', 'm'], händler: ['Händler', 'm'], abnehmer: ['Abnehmer', 'm']
};
const ARTIKEL = {nom: {m: 'der', f: 'die', n: 'das'}, akk: {m: 'den', f: 'die', n: 'das'}, dat: {m: 'dem', f: 'der', n: 'dem'}};
// Firmen stehen nur mit Namen im Satz („BHP besitzt …“), Anlagen mit Art („die Mine Carrapateena“).
const FIRMA = new Set(['Unternehmen', 'Konzern', 'Abnehmer', 'Händler', 'Verarbeiter', 'Gemeinschaftsunternehmen', 'Staat']);

/** Anzeigename ohne Zusatz wie „— berichtete Unternehmensgruppe“ oder „[Annahme]“. */
export function nameKurz(n) {
  return String(n || 'unbekannt').split(' — ')[0].replace(/\s*\[Annahme\]\s*$/, '').trim() || 'unbekannt';
}
function art(kind) {
  const k = String(kind || '').toLowerCase().replace(/\s*\(.*\)\s*$/, '').trim();
  return ART[k] || ART[k.replace(/ /g, '_')] || null;
}
/** „die Mine Carrapateena“ im passenden Fall; ohne bekannte Art nur der Name. */
function mit(p, fall) {
  const a = art(p.art), n = nameKurz(p.name);
  if (!a || FIRMA.has(a[0]) || n.toLowerCase().includes(a[0].toLowerCase())) return n;
  return ARTIKEL[fall][a[1]] + ' ' + a[0] + ' ' + n;
}
const gross = t => t.charAt(0).toUpperCase() + t.slice(1);
const zu = s => s.replace(/^dem /, 'zum ').replace(/^der /, 'zur ').replace(/^(?!zum |zur )/, 'nach ');

const MATERIAL = [[/copper_and_zinc/i, 'Kupfer- und Zinkkonzentrat'], [/concentrate_or_blister/i, 'Konzentrat oder Blisterkupfer'], [/leach/i, 'Laugungslösung'],
  [/concentrate/i, 'Konzentrat'], [/cathode/i, 'Kathoden'], [/anode/i, 'Anoden'], [/blister/i, 'Blisterkupfer'], [/matte/i, 'Kupferstein'],
  [/^ore$/i, 'Erz'], [/\bcoal\b/i, 'Kohle'], [/\b(copper )?rod\b/i, 'Draht'], [/sulph?uric acid/i, 'Schwefelsäure']];
/** Englische Materialangaben der Kupfer-Wissensbasis kurz eindeutschen; deutsche bleiben, wie sie sind. */
export function material(m, rohstoff) {
  if (!m) return null;
  const hit = /[äöüß]|[A-Z][a-z]+-/.test(m) ? null : MATERIAL.find(([re]) => re.test(m));
  if (!hit) return m;
  const r = /copper|kupfer/i.test(m) || /kupfer/i.test(rohstoff || '') ? 'Kupfer' : '';
  return r && !/Kupfer|Zink|Lösung/.test(hit[1]) ? r + hit[1].toLowerCase() : hit[1];
}

// Verbindungsart → Satz und Begründung. a = von, b = nach.
const TYP = {
  OWNS: {wort: 'Eigentum', satz: (a, b, v) => v.anteil != null && v.anteil < 100 ? `${a.n} besitzt ${fmt(v.anteil)} % an ${mit(b.p, 'dat')}.` : `${a.n} besitzt ${mit(b.p, 'akk')}.`,
    warum: 'Wer eine Anlage besitzt, entscheidet über Förderung, Investitionen und Verkauf.'},
  PARTIALLY_OWNS: {wort: 'Beteiligung', satz: (a, b, v) => `${a.n} ist an ${mit(b.p, 'dat')} beteiligt${v.anteil != null ? ` (${fmt(v.anteil)} %)` : ''}.`,
    warum: 'Ein Anteilseigner verdient am Ergebnis mit und redet bei wichtigen Entscheidungen mit.'},
  OPERATES: {wort: 'Betrieb', satz: (a, b) => `${a.n} betreibt ${mit(b.p, 'akk')}.`,
    warum: 'Der Betreiber führt den Standort im Alltag: Förderung, Personal und Anlagen.'},
  CONTROLS: {wort: 'Kontrolle', satz: (a, b) => `${a.n} kontrolliert ${mit(b.p, 'akk')}.`,
    warum: 'Die Muttergesellschaft steuert das Tochterunternehmen oder den Standort.'},
  PROCESSES_AT: {wort: 'Verarbeitung', satz: (a, b, v) => `${gross(mit(a.p, 'nom'))} lässt bei ${mit(b.p, 'dat')} verarbeiten${v.mat ? ' (Material: ' + v.mat + ')' : ''}.`,
    warum: 'Hier wird das Material zur nächsten Stufe der Lieferkette veredelt.'},
  TRANSPORTS_TO: {wort: 'Transport', satz: (a, b, v) => `${gross(mit(a.p, 'nom'))} bringt ${v.mat || 'Material'} ${zu(mit(b.p, 'dat'))}.`,
    warum: 'Über diesen Weg verlässt das Material den Standort.'},
  SUPPLIES: {wort: 'Lieferung', satz: (a, b, v) => `${gross(mit(a.p, 'nom'))} beliefert ${mit(b.p, 'akk')}${v.mat ? ' mit ' + v.mat : ''}.`,
    warum: 'Der Abnehmer bezieht Material von hier; fällt die Lieferung aus, fehlt ihm Ware.'},
  OFFTAKE_AGREEMENT: {wort: 'Abnahmevertrag', satz: (a, b, v) => `${b.n} hat einen Abnahmevertrag für ${v.mat || 'die Produktion'} aus ${mit(a.p, 'dat')}.`,
    warum: 'Mit einem Abnahmevertrag sichert sich der Käufer die Produktion schon im Voraus.'},
  MARKETS_VIA: {wort: 'Vermarktung', satz: (a, b, v) => `${gross(mit(a.p, 'nom'))} verkauft ${v.mat || 'die Produktion'} über ${mit(b.p, 'akk')}.`,
    warum: 'Der Händler bringt die Produktion zu den Käufern.'},
  TRADES_TO: {wort: 'Handel', satz: (a, b, v) => `${gross(mit(a.p, 'nom'))} liefert ${v.mat || 'Material'} an ${mit(b.p, 'akk')}.`,
    warum: 'Über diesen Handelsweg erreicht das Material seinen Käufer.'},
  DEAL: {wort: 'Firmenkauf oder Beteiligung', satz: (a, b, v) => `${a.n} ${v.vorgang || 'kauft Anteile an'} ${b.n}${v.jahr ? ' (' + v.jahr + ')' : ''}.`,
    warum: 'Mit dem Kauf ändert sich, wem das Unternehmen gehört und wer dort entscheidet.'},
  FINANCING: {wort: 'Finanzierung', satz: (a, b) => `${a.n} hat ${b.n} einen Kredit zugesagt.`,
    warum: 'Der Geldgeber finanziert Vorhaben des Empfängers und hat Interesse an dessen Erfolg.'},
  HEADQUARTERS: {wort: 'Firmensitz', satz: (a, b) => `${a.n} hat den Sitz in ${b.n}.`, warum: 'Der Sitz zeigt, wo das Unternehmen geführt wird.'},
  COUNTERFLOW: {wort: 'Gegenwert (modelliert)', satz: (a, b, v) => `Für ${v.mat || 'die Ware'} fließt Geld von ${a.n} an ${b.n}.`,
    warum: 'Schematische Gegenrichtung zum Warenstrom; keine beobachtete Zahlung.'}
};
const ALIAS = {'Transport nach': 'TRANSPORTS_TO', 'TRANSPORTED_TO': 'TRANSPORTS_TO', 'verarbeitet in': 'PROCESSES_AT', betreibt: 'OPERATES', 'liefert an': 'SUPPLIES',
  SUPPLIES_TO: 'SUPPLIES', OFFTAKE: 'OFFTAKE_AGREEMENT'};
const fmt = n => new Intl.NumberFormat('de-DE', {maximumFractionDigits: 1}).format(n);

/** Prüfstatus in Klartext. ton: ok (freigegeben/geprüft), offen (laut Quelle, nicht geprüft), annahme, gesperrt. */
export function status(evidenz, pruef) {
  const e = String(evidenz || '').toUpperCase(), p = String(pruef || '').toUpperCase();
  if (p === 'REJECTED') return {ton: 'gesperrt', text: 'abgelehnt', lang: 'Bei der Prüfung abgelehnt.'};
  if (p === 'BLOCKED') return {ton: 'gesperrt', text: 'gesperrt', lang: 'Gesperrt: der Beleg reicht für eine Freigabe nicht aus.'};
  if (p === 'APPROVED' || p === 'FREIGEGEBEN') return {ton: 'ok', text: 'freigegeben', lang: 'Quelle gelesen und Verbindung bestätigt.'};
  if (p === 'REVIEWED_HISTORICAL') return {ton: 'ok', text: 'historisch geprüft', lang: 'Quelle gelesen; gilt für den genannten Zeitraum, nicht formal freigegeben.'};
  if (p === 'VERIFIED') return {ton: 'ok', text: 'quellengeprüft', lang: 'Quelle gelesen, sie stützt die Verbindung; noch nicht freigegeben.'};
  if (e === 'BELEGT') return {ton: 'ok', text: 'belegt', lang: 'Mit Quelle belegt (aus dem Hauptatlas).'};
  if (e === 'ASSUMPTION' || e === 'ANNAHME') return {ton: 'annahme', text: 'Annahme', lang: 'Begründete Annahme, nicht belegt.'};
  if (e === 'INFERENCE') return {ton: 'offen', text: 'abgeleitet', lang: 'Aus belegten Angaben geschlossen, nicht direkt belegt; noch nicht geprüft.'};
  if (p === 'NEEDS_RESEARCH') return {ton: 'offen', text: 'noch nicht geprüft', lang: 'Steht so in der Quelle; eine formale Prüfung steht noch aus.'};
  if (e === 'FACT') return {ton: 'offen', text: 'laut Quelle, noch nicht geprüft', lang: 'Steht so in der Quelle; die Prüfung steht noch aus.'};
  return {ton: 'offen', text: 'unbekannt', lang: 'Prüfstatus unbekannt.'};
}

/**
 * v: {typ, von:{name, art, land}, nach:{name, art, land}, rohstoff, material, anteil, evidenz, pruef,
 *     aussage (Satz aus der Quelle), zitat, hinweis, beleg:{label, url}, annahme (Begründung einer Annahme),
 *     vorgang + jahr (Firmenkauf), extra:[[Begriff, Wert]] weitere wichtige Angaben}
 * Ergebnis: {titel, satz, warum, beleg, status, fakten:[[Begriff, Wert]]}
 */
export function klartext(v) {
  const typ = v.typ in ALIAS ? ALIAS[v.typ] : v.typ, t = TYP[typ];
  const a = {n: nameKurz(v.von?.name), p: v.von || {}}, b = {n: nameKurz(v.nach?.name), p: v.nach || {}};
  const mat = material(v.material, v.rohstoff) || (v.rohstoff ? v.rohstoff.replace(/\s*\(.*\)$/, '') : null);
  const satz = t ? t.satz(a, b, {mat, anteil: v.anteil, vorgang: v.vorgang, jahr: v.jahr}) : `${a.n} ist mit ${b.n} verbunden (${String(v.typ || 'Art unbekannt').toLowerCase().replace(/_/g, ' ')}).`;
  const st = status(v.evidenz, v.pruef);
  const fakten = [['Art', t ? t.wort : String(v.typ || 'unbekannt')]];
  if (v.rohstoff) fakten.push(['Rohstoff', v.rohstoff]);
  if (mat && v.material) fakten.push(['Material', mat]);
  if (v.anteil != null) fakten.push(['Anteil', fmt(v.anteil) + ' %']);
  const ort = p => [art(p.art)?.[0], p.land && !/^unknown$/i.test(p.land) ? p.land : null].filter(Boolean).join(', ');
  for (const f of v.extra || []) if (f && f[1] != null && f[1] !== '') fakten.push(f);
  fakten.push(['Von', a.n + (ort(a.p) ? ' (' + ort(a.p) + ')' : '')], ['Nach', b.n + (ort(b.p) ? ' (' + ort(b.p) + ')' : '')]);
  return {titel: a.n + ' → ' + b.n, satz, warum: t ? t.warum : null, status: st, fakten};
}

/** Gesamtes Fenster-Innenleben als HTML: Klartext oben, Technik eingeklappt. technik/aktionen sind fertiges HTML des Aufrufers. */
export function verbindungHtml(v, {technik = '', aktionen = ''} = {}) {
  const k = klartext(v);
  const beleg = v.beleg?.url && /^https:\/\//.test(v.beleg.url) ? `<a href="${esc(v.beleg.url)}" target="_blank" rel="noopener">${esc(v.beleg.label || 'Quelle')} ↗</a>` : v.beleg?.label ? esc(v.beleg.label) : '';
  const grund = (v.hinweis ? `<p>${esc(v.hinweis)}</p>` : '') + (v.annahme ? `<p><b>Annahme:</b> ${esc(v.annahme)}</p>` : v.aussage ? `<p><b>Laut Quelle:</b> ${esc(v.aussage)}</p>` : v.zitat ? `<p><b>Laut Quelle:</b> ${esc(v.zitat)}</p>` : '');
  return `<div class="vk" data-verbindung-klartext>`
    + `<p class="vk-satz">${esc(k.satz)}</p>`
    + `<p class="vk-status" data-ton="${k.status.ton}"><b>${esc(k.status.text)}</b> · ${esc(k.status.lang)}</p>`
    + `<section class="vk-warum"><h3>Warum diese Verbindung?</h3>${k.warum ? `<p>${esc(k.warum)}</p>` : ''}${grund}${beleg ? `<p class="vk-beleg">Beleg: ${beleg}</p>` : '<p class="vk-beleg">Beleg: keiner angegeben</p>'}</section>`
    + `<dl class="vk-fakten">${k.fakten.map(([d, w]) => `<div><dt>${esc(d)}</dt><dd>${esc(w)}</dd></div>`).join('')}</dl>`
    + (aktionen ? `<p class="vk-aktionen">${aktionen}</p>` : '')
    + (technik ? `<details class="vk-technik"><summary>Technische Angaben</summary>${technik}</details>` : '')
    + `</div>`;
}

/** Kurze Zeile für Listen (z. B. alle Verbindungen eines Punkts): Satz plus Status. */
export function verbindungZeile(v) {
  const k = klartext(v);
  return `<span class="vk-zeile">${esc(k.satz)} <small data-ton="${k.status.ton}">${esc(k.status.text)}</small></span>`;
}

const CSS = `.vk{display:flex;flex-direction:column;gap:14px}.vk-satz{font-size:20px;line-height:1.4;margin:0;font-weight:600}
.vk-status{margin:0;font-size:14px;line-height:1.5;padding:8px 12px;border-radius:8px;border:1px solid currentColor}
.vk-status[data-ton=ok],.vk-zeile small[data-ton=ok]{color:#1d6b3a}.vk-status[data-ton=offen],.vk-zeile small[data-ton=offen]{color:#8a5a00}
.vk-status[data-ton=annahme],.vk-zeile small[data-ton=annahme]{color:#6b4aa0}.vk-status[data-ton=gesperrt],.vk-zeile small[data-ton=gesperrt]{color:#a32020}
.vk-warum h3{font-size:15px;margin:0 0 6px;font-weight:600}.vk-warum p{margin:0 0 6px;font-size:15px;line-height:1.55}.vk-beleg{font-size:14px}
.vk-fakten{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px 18px;margin:0}.vk-fakten>div{padding:0!important;border:0!important}
.vk-fakten dt{font-size:12px!important;text-transform:uppercase;letter-spacing:.6px;opacity:.7;margin:0 0 2px!important}.vk-fakten dd{margin:0;font-size:15px!important;line-height:1.4!important}
.vk-aktionen{display:flex;flex-wrap:wrap;gap:8px 16px;margin:0;font-size:14px}.vk-technik{font-size:13px;opacity:.85}.vk-technik summary{cursor:pointer;font-size:14px;padding:6px 0}
.vk-zeile small{font-size:12px;margin-left:4px;white-space:nowrap}
@media(max-width:760px){.vk{gap:11px}.vk-satz{font-size:17px}.vk-warum p{font-size:14px}.vk-status{font-size:13px}}`;
if (typeof document !== 'undefined' && !document.getElementById('vk-css')) {
  const s = document.createElement('style'); s.id = 'vk-css'; s.textContent = CSS; document.head.append(s);
}
