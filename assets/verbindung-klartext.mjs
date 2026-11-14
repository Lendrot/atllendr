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

// ---------------------------------------------------------------------------------------------------------------
// Verwendung (Eddie 2026-11-10): wofür der Käufer das Material an DIESER Verbindung einsetzt, z. B. Firma A kauft Lithium für
// Akkus, Firma B für Glas und Keramik. Gilt je Verbindung, nicht je Firma. Wirtschaftszweig des Einsatzes nach NACE Rev. 2
// (Eurostat-Codeliste NACE_R2, deutsche Titel), damit man danach filtern kann.
// v.verwendung = {zweck: Schlüssel aus VERWENDUNG, wie: 'belegt'|'annahme', grund, zitat, beleg:{label,url}, sicherheit, ueber}
// Hauptatlas: nur 'belegt' aus gelesener Quelle, sonst bleibt die Verwendung unbekannt. Annahmen-Atlas: verwendungSchaetzen().
export const VERWENDUNG = {
  batterien: ['Akkus und Batterien', '27.20', 'Herstellung von Batterien und Akkumulatoren'],
  e_auto: ['Elektroautos', '29.10', 'Herstellung von Kraftwagen und Kraftwagenmotoren'],
  energiespeicher: ['Stromspeicher', '27.20', 'Herstellung von Batterien und Akkumulatoren'],
  photovoltaik: ['Photovoltaik (Solarzellen)', '26.11', 'Herstellung von elektronischen Bauelementen'],
  kabel: ['Kabel, Draht und Leitungen', '27.32', 'Herstellung von sonstigen elektronischen und elektrischen Drähten und Kabeln'],
  magnete: ['Magnete für Elektromotoren und Generatoren', '27.11', 'Herstellung von Elektromotoren, Generatoren und Transformatoren'],
  windkraft: ['Windkraftanlagen', '28.11', 'Herstellung von Verbrennungsmotoren und Turbinen (ohne Motoren für Luft- und Straßenfahrzeuge)'],
  elektronik: ['Elektronik und Halbleiter', '26.11', 'Herstellung von elektronischen Bauelementen'],
  ruestung: ['Rüstung und Munition', '25.40', 'Herstellung von Waffen und Munition'],
  luftfahrt: ['Luftfahrt (Triebwerke)', '30.30', 'Luft- und Raumfahrzeugbau'],
  werkzeuge: ['Hartmetall-Werkzeuge', '25.73', 'Herstellung von Werkzeugen'],
  stahl: ['Stahlerzeugung', '24.10', 'Erzeugung von Roheisen, Stahl und Ferrolegierungen'],
  aluminium: ['Aluminiumerzeugung', '24.42', 'Erzeugung und erste Bearbeitung von Aluminium'],
  ne_metalle: ['NE-Metallerzeugung aus Schrott', '24.4', 'Erzeugung und erste Bearbeitung von NE-Metallen'],
  strom: ['Stromerzeugung', '35.11', 'Elektrizitätserzeugung'],
  kernkraft: ['Brennstoff für Kernkraftwerke', '35.11', 'Elektrizitätserzeugung'],
  feuerfest: ['Feuerfeste Werkstoffe', '23.20', 'Herstellung von feuerfesten keramischen Werkstoffen und Waren'],
  glas_keramik: ['Glas und Keramik', '23', 'Herstellung von Glas und Glaswaren, Keramik, Verarbeitung von Steinen und Erden'],
  bau: ['Bau (Recycling-Baustoff)', 'F', 'Baugewerbe/Bau'],
  gebaeude: ['Bau (Leitungen, Rohre, Dächer)', 'F', 'Baugewerbe/Bau'],
  zement: ['Zement', '23.51', 'Herstellung von Zement'],
  schmuck: ['Schmuck', '32.12', 'Herstellung von Schmuck, Gold- und Silberschmiedewaren (ohne Fantasieschmuck)'],
  muenzen: ['Münzen und Barren', '32.11', 'Herstellung von Münzen'],
  wertanlage: ['Wertanlage (Fonds, Barren)', '64.30', 'Treuhand- und sonstige Fonds und ähnliche Finanzinstitutionen'],
  zentralbank: ['Währungsreserve (Zentralbank)', '64.11', 'Zentralbanken'],
  flammschutz: ['Flammschutz und Kunststoffe', '20.16', 'Herstellung von Kunststoffen in Primärformen']
};

// Abnehmer → Verwendung, nur für den Annahmen-Atlas. Reihenfolge zählt: erste passende Regel gewinnt. r = Rohstoff (klein), t = Typ + Name des Abnehmers.
const REGELN = [
  [/seltene|selten|rare/, /e-auto|autobauer|elektroauto|fahrzeug/i, 'magnete', 'Abnehmer baut Elektroautos; Seltene Erden stecken dort in den Magneten der Antriebsmotoren'],
  [/seltene|selten|rare/, /magnet/i, 'magnete', 'Abnehmer ist ein Magnetwerk'],
  [null, /windkraft|wind turbine|goldwind|vestas|siemens gamesa/i, 'windkraft', 'Abnehmer baut Windkraftanlagen'],
  [null, /rüstung|munition|defen[cs]e|raytheon|lockheed|rheinmetall/i, 'ruestung', 'Abnehmer ist ein Rüstungsunternehmen'],
  [null, /triebwerk|luftfahrt|aerospace/i, 'luftfahrt', 'Abnehmer baut Flugzeugtriebwerke'],
  [null, /photovoltaik|solar/i, 'photovoltaik', 'Abnehmer stellt Solarzellen oder -module her'],
  [null, /batterie|akku|zellwerk|zellfertig|anodenwerk|anodenmaterial/i, 'batterien', 'Abnehmer stellt Batterien oder Batteriematerial her'],
  [/lithium|kobalt|nickel|mangan/, /kathodenmaterial|kathodenwerk|kathodenindustrie|kathodenhersteller|pcam|cam\b/i, 'batterien', 'Abnehmer stellt Kathodenmaterial für Batterien her'],
  [null, /energiespeicher|speicher/i, 'energiespeicher', 'Abnehmer baut Stromspeicher'],
  [/lithium|graphit|kobalt|nickel/, /autobauer|e-auto|elektroauto|tesla|volkswagen|bmw|geely|byd/i, 'batterien', 'Abnehmer baut Elektroautos; der Rohstoff geht dort in die Antriebsbatterie'],
  [null, /halbleiter|elektronik|\bchips?\b/i, 'elektronik', 'Abnehmer stellt Elektronik oder Halbleiter her'],
  [/kupfer|aluminium|bauxit|schrott/, /kabel|draht|leitung|prysmian|nexans|halbzeug/i, 'kabel', 'Abnehmer verarbeitet zu Kabel, Draht oder Halbzeug'],
  [null, /werkzeug|hartmetall|zerspan|bohren|fräsen/i, 'werkzeuge', 'Abnehmer stellt Werkzeuge her'],
  [null, /feuerfest|refractor/i, 'feuerfest', 'Abnehmer stellt feuerfeste Werkstoffe her'],
  [/uran/, /reaktor|kernkraft|kraftwerk/i, 'kernkraft', 'Abnehmer betreibt Kernkraftwerke'],
  [null, /hochofen|stahlwerk|stahl\b|steel/i, 'stahl', 'Abnehmer erzeugt Stahl'],
  [null, /kraftwerk/i, 'strom', 'Abnehmer betreibt Kraftwerke'],
  [null, /aluminiumhütte/i, 'aluminium', 'Abnehmer erzeugt Aluminium'],
  [null, /ne-metallhütte|ne-werke/i, 'ne_metalle', 'Abnehmer erzeugt NE-Metalle aus Schrott'],
  [null, /zentralbank|notenbank/i, 'zentralbank', 'Abnehmer ist eine Zentralbank'],
  [null, /münze|mint\b|barren/i, 'muenzen', 'Abnehmer prägt Münzen oder Barren'],
  [null, /\betf\b|fonds|anleger/i, 'wertanlage', 'Abnehmer ist ein Fonds oder Anleger'],
  [null, /schmuck|juwel|jewel/i, 'schmuck', 'Abnehmer stellt Schmuck her'],
  [null, /rc-baustoff|rc-einsatz|baustoff/i, 'bau', 'Abnehmer setzt Recycling-Baustoff im Bau ein'],
  [null, /zement/i, 'zement', 'Abnehmer stellt Zement her'],
  [null, /glas|keramik/i, 'glas_keramik', 'Abnehmer stellt Glas oder Keramik her']
];

/** Hauptverwendung je Rohstoff laut USGS Mineral Commodity Summaries 2026 (gelesen 2026-11-10); Rückfall, wenn der Abnehmer
 *  das Material nur weiterverarbeitet und im Netz kein Endabnehmer folgt. [Schlüssel, Satz aus der Quelle, Quelle]. */
export const HAUPTVERWENDUNG = {
  lithium: ['batterien', 'weltweit gehen schätzungsweise 88 % des Lithiums in Batterien', 'https://pubs.usgs.gov/periodicals/mcs2026/mcs2026-lithium.pdf'],
  gold: ['schmuck', 'weltweit gingen 40 % des Goldes in Schmuck, 24 % in Barren, 21 % an Zentralbanken', 'https://pubs.usgs.gov/periodicals/mcs2026/mcs2026-gold.pdf'],
  'seltene erden': ['magnete', 'die weltweit wichtigste Verwendung Seltener Erden sind Magnete', 'https://pubs.usgs.gov/periodicals/mcs2026/mcs2026-rare-earths.pdf'],
  wolfram: ['werkzeuge', 'in den USA gehen schätzungsweise 60 % des Wolframs in Hartmetall für Schneid- und Verschleißteile', 'https://pubs.usgs.gov/periodicals/mcs2026/mcs2026-tungsten.pdf'],
  eisenerz: ['stahl', 'in den USA gingen 98 % der Eisenerzprodukte in die Stahlindustrie', 'https://pubs.usgs.gov/periodicals/mcs2026/mcs2026-iron-ore.pdf'],
  bauxit: ['aluminium', 'in den USA gingen rund 70 % der Tonerde an Aluminiumhütten', 'https://pubs.usgs.gov/periodicals/mcs2026/mcs2026-bauxite-alumina.pdf'],
  aluminium: ['aluminium', 'in den USA gingen rund 70 % der Tonerde an Aluminiumhütten', 'https://pubs.usgs.gov/periodicals/mcs2026/mcs2026-bauxite-alumina.pdf'],
  'bauxit/aluminium': ['aluminium', 'in den USA gingen rund 70 % der Tonerde an Aluminiumhütten', 'https://pubs.usgs.gov/periodicals/mcs2026/mcs2026-bauxite-alumina.pdf'],
  kupfer: ['gebaeude', 'in den USA gingen 42 % in den Hochbau, 23 % in Elektro- und Elektronikprodukte, 18 % in Verkehrsmittel (laut Copper Development Association)', 'https://pubs.usgs.gov/periodicals/mcs2026/mcs2026-copper.pdf'],
  graphit: ['batterien', 'Naturgraphit wird vor allem in Batterien, Bremsbelägen, Schmierstoffen, Feuerfest und Stahl verwendet', 'https://pubs.usgs.gov/periodicals/mcs2026/mcs2026-graphite.pdf'],
  kobalt: ['batterien', 'Lithium-Ionen-Batterien sind die weltweit wichtigste Verwendung von Kobalt', 'https://pubs.usgs.gov/periodicals/mcs2026/mcs2026-cobalt.pdf'],
  antimon: ['flammschutz', 'in den USA gingen 49 % in Metallprodukte einschließlich Flammschutz, 40 % in Bleilegierungen und Munition', 'https://pubs.usgs.gov/periodicals/mcs2026/mcs2026-antimony.pdf']
};
const roh = r => String(r || '').toLowerCase().replace(/\s*\(.*\)$/, '').replace(/-/g, ' ').trim();

/** Wahrscheinlichste Verwendung aus Typ und Name des Abnehmers (nur Annahmen-Atlas). null = Abnehmer verarbeitet nur weiter. */
export function verwendungVomAbnehmer(nach, rohstoff) {
  const t = String(nach?.art || '') + ' ' + nameKurz(nach?.name), r = roh(rohstoff);
  for (const [rr, re, zweck, grund] of REGELN) if ((!rr || rr.test(r)) && re.test(t)) return {zweck, grund: grund + ' (' + nameKurz(nach?.name) + ').'};
  return null;
}
/** Rückfall: Hauptverwendung des Rohstoffs (USGS). */
export function verwendungRohstoff(rohstoff) {
  const h = HAUPTVERWENDUNG[roh(rohstoff)];
  return h ? {zweck: h[0], grund: 'Wichtigste Verwendung des Rohstoffs: ' + h[1] + ' (USGS Mineral Commodity Summaries 2026).', beleg: {label: 'USGS MCS 2026', url: h[2]}} : null;
}

/** Verbindungsarten ohne Warenlieferung (Eigentum, Betrieb, Sitz, Geld): dort gibt es keine Verwendung, das Feld entfällt. */
export const OHNE_WARE = new Set(['OWNS', 'PARTIALLY_OWNS', 'OPERATES', 'CONTROLS', 'DEAL', 'FINANCING', 'HEADQUARTERS', 'COUNTERFLOW', 'betreibt']);

/** Verwendung in Klartext. ton wie status(); ohne Angabe: unbekannt. */
export function verwendungText(w) {
  const z = w && VERWENDUNG[w.zweck];
  if (!z) return {ton: 'offen', wort: 'unbekannt', nace: null, lang: 'Keine gelesene Quelle sagt, wofür der Käufer das Material an dieser Verbindung einsetzt.'};
  const nace = 'NACE ' + z[1] + ' ' + z[2];
  if (w.wie === 'belegt') return {ton: 'ok', wort: z[0], nace, lang: 'Laut Quelle.'};
  return {ton: 'annahme', wort: z[0], nace, lang: 'Annahme' + (w.sicherheit ? ' (Sicherheit ' + w.sicherheit + ')' : '') + ', nicht belegt.'};
}

// ---------------------------------------------------------------------------------------------------------------
// Ware (Eddie 2026-11-10: „klar, was genau geliefert wird“): die konkrete Ware an DIESER Verbindung, z. B. Kupferkonzentrat statt
// nur „Kupfer“, mit Zolltarifnummer. KN = Titel der Kombinierten Nomenklatur der EU (erste 6 Stellen = internationaler HS-Code),
// deutsch aus Eurostat Comext, Codeliste ESTAT:CXT_NC(11.0), abgerufen 2026-11-10; Prüfliste im Hauptatlas analysis/research/ware-v1.
export const KN = {
  '2603': 'Kupfererze und ihre Konzentrate', '2608': 'Zinkerze und ihre Konzentrate', '2607': 'Bleierze und ihre Konzentrate', '7408': 'Draht aus Kupfer', '7401': 'Kupfermatte; Zementkupfer',
  '7402': 'Kupfer, nichtraffiniert; Kupferanoden zum elektrolytischen Raffinieren', '740311': 'Kupfer, raffiniert, in Form von Kathoden oder Kathodenabschnitten',
  '740811': 'Draht aus raffiniertem Kupfer, mit einer größten Querschnittsabmessung von > 6 mm', '7404': 'Abfälle und Schrott, aus Kupfer',
  '8544': 'Drähte und Kabel für elektrotechnische Zwecke, isoliert', '280700': 'Schwefelsäure; Oleum',
  '253090': 'Andere mineralische Stoffe, a.n.g.', '283691': 'Lithiumcarbonate', '282520': 'Lithiumoxid und Lithiumhydroxid', '282739': 'Chloride (andere)',
  '284190': 'Salze der Säuren der Metalloxide (andere)', '284290': 'Salze der anorganischen Säuren (andere)', '850760': 'Lithium-Ionen-Akkumulatoren',
  '261220': 'Thoriumerze und ihre Konzentrate', '261590': 'Niobiumerze, Tantalerze oder Vanadiumerze und deren Konzentrate',
  '284690': 'Verbindungen der Seltenerdmetalle (ausg. Cerverbindungen)', '280530': 'Seltenerdmetalle, Scandium und Yttrium, auch gemischt oder legiert',
  '850511': 'Dauermagnete aus Metall', '261210': 'Uranerze und ihre Konzentrate', '284410': 'Uran, natürlich, und seine Verbindungen',
  '284420': 'Uran, an U 235 angereichert, und seine Verbindungen', '840130': 'Brennstoffelemente, nichtbestrahlt, für Kernreaktoren',
  '261690': 'Edelmetallerze und ihre Konzentrate (ausg. Silbererze)', '7108': 'Gold, in Rohform oder als Halbzeug oder Pulver',
  '710812': 'Gold, in Rohform, zu anderen als zu monetären Zwecken', '2504': 'Grafit, natürlich', '250410': 'Grafit, natürlich, in Pulverform oder in Flocken',
  '250490': 'Grafit, natürlich (ausg. in Pulverform oder in Flocken)', '380110': 'Grafit, künstlich', '380190': 'Zubereitungen auf der Grundlage von Grafit oder anderem Kohlenstoff',
  '271312': 'Petrolkoks, calciniert', '2611': 'Wolframerze und ihre Konzentrate', '284180': 'Wolframate', '284990': 'Carbide (andere)',
  '8101': 'Wolfram und Waren daraus', '810199': 'Waren aus Wolfram, a.n.g.', '261710': 'Antimonerze und ihre Konzentrate',
  '260111': 'Eisenerze und ihre Konzentrate, unagglomeriert', '260112': 'Eisenerze und ihre Konzentrate, agglomeriert',
  '2701': 'Steinkohle', '27011210': 'Kokskohle, bitumenhaltig, unagglomeriert', '27011290': 'Steinkohle, bitumenhaltig, unagglomeriert (ausg. Kokskohle)',
  '2606': 'Aluminiumerze und ihre Konzentrate', '281820': 'Aluminiumoxid (ausg. künstlicher Korund)', '7601': 'Aluminium in Rohform',
  '7602': 'Abfälle und Schrott, aus Aluminium', '7204': 'Abfälle und Schrott, aus Eisen oder Stahl', '2605': 'Cobalterze und ihre Konzentrate',
  '2822': 'Cobaltoxide und Cobalthydroxide', '810520': 'Cobaltmatte und andere Zwischenerzeugnisse; Cobalt in Rohform', '2517': 'Feldsteine, Kies und zerkleinerte Steine',
  '2520': 'Gipsstein; Anhydrit; Gips'
};
// Schlüssel → [Anzeige, KN-Codes, deren Titel die Ware nennen (gilt als Einreihung laut Tarif), wahrscheinlichste Codes ohne eigene Position (nur Annahmen-Atlas)].
export const WARE = {
  kupfererz: ['Kupfererz', ['2603']], kupferkonzentrat: ['Kupferkonzentrat', ['2603']],
  kupfer_zink_konzentrat: ['Kupferkonzentrat und Zinkkonzentrat', ['2603', '2608']], kupferstein: ['Kupferstein (Matte)', ['7401']],
  konzentrat_oder_blister: ['Kupferkonzentrat oder Blisterkupfer', ['2603', '7402']], blisterkupfer: ['Blisterkupfer', ['7402']],
  kupferanoden: ['Kupferanoden', ['7402']], kupferkathoden: ['Kupferkathoden', ['740311']], kupfer_raffiniert: ['Raffiniertes Kupfer (Kathoden und Anoden)', ['740311', '7402']],
  walzdraht: ['Kupfer-Walzdraht', ['740811']], kupferdraht: ['Kupferdraht', ['7408']], kathode_draht: ['Kupferkathoden und Kupferdraht', ['740311', '7408']],
  anoden_blister: ['Kupferanoden und Blisterkupfer', ['7402']], kupfer_vorstoff: ['Kupferkonzentrat, Blisterkupfer oder Anoden', ['2603', '7402']], kabel: ['Isolierte Kabel und Leitungen', ['8544']], kupferschrott: ['Kupferschrott', ['7404']],
  laugung: ['Kupferhaltige Laugungslösung (bleibt im Werk)', []], schwefelsaeure: ['Schwefelsäure', ['280700']],
  spodumen: ['Spodumenkonzentrat (Lithiumerz)', [], ['253090']], lithiumkonzentrat: ['Lithiumkonzentrat (Spodumen, Petalit)', [], ['253090']],
  lithiumcarbonat: ['Lithiumcarbonat', ['283691']], lithiumhydroxid: ['Lithiumhydroxid', ['282520']],
  lithiumsalze: ['Lithiumcarbonat und -hydroxid', ['283691', '282520']], lithiumchlorid: ['Lithiumchlorid', [], ['282739']],
  lithiumrohstoff: ['Lithiumrohstoff (Form laut Quelle offen)', []], lithiumsole: ['Lithiumsole (bleibt im Werk)', []],
  kathode_ncm: ['Kathodenmaterial NCM/NCA für Batterien', [], ['284190']], kathode_lfp: ['Kathodenmaterial LFP für Batterien', [], ['284290']],
  kathodenmaterial: ['Kathodenmaterial für Batterien', [], ['284190', '284290']], batteriezellen: ['Lithium-Ionen-Batteriezellen', ['850760']],
  se_konzentrat: ['Seltenerd-Konzentrat', [], ['253090']], monazit: ['Monazit-Konzentrat', [], ['261220']], loparit: ['Loparit-Konzentrat', [], ['261590']],
  se_verbindungen: ['Seltenerd-Verbindungen (Oxide, Carbonate, Chloride)', ['284690']], se_legierung: ['Seltenerdmetalle und -legierungen', ['280530']],
  magnete: ['Dauermagnete', ['850511']], uranerz: ['Uranerz', ['261210']], urankonzentrat: ['Urankonzentrat (U3O8, „Yellowcake“)', ['284410']],
  uf6_natur: ['Uranhexafluorid, natürlich', ['284410']], uran_angereichert: ['Angereichertes Uran (Uranhexafluorid)', ['284420']],
  uranverbindung: ['Natururan-Verbindung (UO2, UO3, UF4, Diuranat)', ['284410']], brennelemente: ['Brennelemente für Kernreaktoren', ['840130']],
  uranloesung: ['Uranhaltige Lösung oder Harz (bleibt im Werk)', []],
  gold_dore: ['Gold-Doré (Rohgold zur Raffination)', ['710812']], feingold: ['Feingold in Barren', ['710812']], gold: ['Gold (Form laut Quelle offen)', ['7108']],
  goldkonzentrat: ['Goldkonzentrat', ['261690']], gold_kupferkonzentrat: ['Kupferkonzentrat mit Gold', ['2603']], blei_zink_konzentrat: ['Blei- und Zinkkonzentrat (mit Gold und Silber)', ['2607', '2608']],
  graphit_flocken: ['Naturgraphit-Flocken (Konzentrat)', ['250410']], graphit_natur: ['Naturgraphit', ['2504']], graphit_stueck: ['Naturgraphit, stückig', ['250490']],
  anode_natur: ['Aktives Anodenmaterial aus Naturgraphit', [], ['380190']], anode_synth: ['Anodenmaterial aus synthetischem Graphit', [], ['380110']],
  kugelgraphit: ['Kugelgraphit (Naturgraphit, sphärisch)', [], ['250410']], nadelkoks: ['Nadelkoks', [], ['271312']],
  wolframkonzentrat: ['Wolframkonzentrat', ['2611']], apt: ['Ammoniumparawolframat (APT) und Wolframoxid', ['284180']],
  wolframcarbid: ['Wolframcarbid und Hartmetall', ['284990']], wolfram_halbzeug: ['Wolfram-Pulver, -Draht und -Halbzeug', ['8101']],
  wolfram_schwer: ['Wolfram-Schwermetall', [], ['810199']], antimonkonzentrat: ['Antimonkonzentrat', ['261710']],
  gold_antimon: ['Gold-Antimon-Konzentrat', [], ['261710']], eisenerz: ['Eisenerz (Fein- und Stückerz)', ['260111']], eisenerz_pellets: ['Eisenerz-Pellets', ['260112']],
  kokskohle: ['Kokskohle für Hochöfen', ['27011210']], kesselkohle: ['Kesselkohle für Kraftwerke', ['27011290']], kohle: ['Steinkohle (Sorte offen)', ['2701']],
  bauxit: ['Bauxit', ['2606']], tonerde: ['Tonerde (Aluminiumoxid)', ['281820']], aluminium: ['Aluminium in Rohform', ['7601']], alu_schrott: ['Aluminiumschrott', ['7602']],
  stahlschrott: ['Stahlschrott', ['7204']], ne_schrott: ['NE-Metallschrott (gemischt)', [], ['7404', '7602']],
  kobaltkonzentrat: ['Kobaltkonzentrat', ['2605']], kobalthydroxid: ['Kobalthydroxid', ['2822']], kobalt: ['Kobalt in Rohform', ['810520']],
  rc_koernung: ['RC-Gesteinskörnung (Recycling-Baustoff)', [], ['2517']], bauschutt: ['Bauschutt (Abfall)', []], gips: ['Recyclinggips', [], ['2520']]
};
// Materialangabe der Quelle → Schlüssel. Erste passende Regel gewinnt; deutsch und englisch (Kupfer-Wissensbasis).
const WARE_TEXT = [
  [/copper_and_zinc|kupfer- und zinkkonzentrat/i, 'kupfer_zink_konzentrat'], [/concentrate_or_blister|konzentrat oder blister/i, 'konzentrat_oder_blister'],
  [/kupferkonzentrat mit gold/i, 'gold_kupferkonzentrat'], [/blei-?\/?zinkkonzentrat/i, 'blei_zink_konzentrat'], [/leach|laugung/i, 'laugung'],
  [/kathode,? anoden|kathode und anoden|anoden und kathode/i, 'kupfer_raffiniert'],
  [/kathode und draht/i, 'kathode_draht'], [/^kupferdraht/i, 'kupferdraht'], [/anoden und blister/i, 'anoden_blister'],
  [/konzentrat, blister, anoden|konzentrat oder anoden/i, 'kupfer_vorstoff'], [/form nicht angegeben/i, null],
  [/concentrate$|^kupferkonzentrat/i, 'kupferkonzentrat'], [/^(copper[ _])?cathode$|kupferkathode/i, 'kupferkathoden'],
  [/^(copper[ _])?anodes?$|^anoden$/i, 'kupferanoden'], [/blister/i, 'blisterkupfer'], [/matte|kupferstein/i, 'kupferstein'], [/^(copper_)?ore$|^kupfererz$/i, 'kupfererz'],
  [/wire rod|walzdraht|\brod\b/i, 'walzdraht'], [/sulph?uric acid|schwefelsäure/i, 'schwefelsaeure'], [/kupferschrott|copper scrap/i, 'kupferschrott'],
  [/spodumenkonzentrat und lithiumcarbonat|lithiumphosphat/i, null], [/spodumen- und petalit|lithiumkonzentrat|lithiumerz|lepidolith/i, 'lithiumkonzentrat'],
  [/lithiumsole/i, 'lithiumsole'], [/lithiumsalze|lithiumchemie|lithiumverbindungen/i, 'lithiumsalze'], [/spodumen/i, 'spodumen'], [/lithiumrohstoff/i, 'lithiumrohstoff'],
  [/lithiumcarbonat und -?hydroxid|lithiumkarbonat und -?hydroxid/i, 'lithiumsalze'], [/lithiumcarbonat|lithiumkarbonat|\bLCE\b/i, 'lithiumcarbonat'],
  [/lithiumhydroxid/i, 'lithiumhydroxid'], [/lithiumchlorid/i, 'lithiumchlorid'], [/lfp- und ncm|kathodenmaterial$/i, 'kathodenmaterial'],
  [/lfp-kathode/i, 'kathode_lfp'], [/nc[ma]a?-kathode|ncma/i, 'kathode_ncm'], [/zellen|batterie/i, 'batteriezellen'],
  [/angereichert/i, 'uran_angereichert'], [/uranhexafluorid/i, 'uf6_natur'], [/brennelement/i, 'brennelemente'],
  [/uranlösung|harz/i, 'uranloesung'], [/uranerz/i, 'uranerz'], [/urankonzentrat|natururan|u3o8/i, 'urankonzentrat'],
  [/urandioxid|\bUO3\b|\bUF4\b|urantetrafluorid|diuranat/i, 'uranverbindung'],
  [/wolframkonzentrat|scheelit|wolframit/i, 'wolframkonzentrat'], [/\bAPT\b|wolframoxid/i, 'apt'], [/wolframcarbid|hartmetall/i, 'wolframcarbid'],
  [/wolfram-halbzeug/i, 'wolfram_halbzeug'], [/schwermetall/i, 'wolfram_schwer'], [/ausgangsstoff/i, 'graphit_natur'],
  [/monazit/i, 'monazit'], [/loparit/i, 'loparit'], [/seltenerd-konzentrat|稀土精矿/i, 'se_konzentrat'],
  [/magnete/i, 'magnete'], [/legierung/i, 'se_legierung'], [/oxid|mischkarbonat|chlorid/i, 'se_verbindungen'],
  [/goldkonzentrat\/-?doré|doré/i, 'gold_dore'], [/goldkonzentrat/i, 'goldkonzentrat'], [/feingold/i, 'feingold'], [/rohgold/i, 'gold_dore'], [/^gold$/i, 'gold'],
  [/aktives anodenmaterial|anodenmaterial \(naturgraphit\)/i, 'anode_natur'], [/anodenmaterial \(synthetisch\)/i, 'anode_synth'], [/kugelgraphit/i, 'kugelgraphit'],
  [/nadelkoks/i, 'nadelkoks'], [/flocken|flockengraphit|graphitkonzentrat/i, 'graphit_flocken'], [/venengraphit/i, 'graphit_stueck'],
  [/naturgraphit|amorpher graphit/i, 'graphit_natur'], [/gold-antimon/i, 'gold_antimon'], [/antimonkonzentrat/i, 'antimonkonzentrat'],
  [/rc-gesteinskörnung/i, 'rc_koernung'], [/recyclinggips/i, 'gips'], [/bauschutt|bauabfall|c&d|gipshaltig|public fill/i, 'bauschutt'],
  [/^stahlschrott/i, 'stahlschrott'], [/^aluminiumschrott/i, 'alu_schrott'], [/^ne-metallschrott/i, 'ne_schrott'],
  [/pellets/i, 'eisenerz_pellets'], [/eisenerz/i, 'eisenerz'], [/kokskohle/i, 'kokskohle'], [/kesselkohle/i, 'kesselkohle'],
  [/tonerde|alumina/i, 'tonerde'], [/bauxit/i, 'bauxit'], [/kobalthydroxid/i, 'kobalthydroxid'], [/kobaltkonzentrat/i, 'kobaltkonzentrat']
];
/** Schlüssel der Ware aus der Materialangabe einer Quelle; null, wenn die Angabe keiner bekannten Ware entspricht. */
export function wareSchluessel(text) {
  const t = String(text || '').trim();
  if (!t) return null;
  for (const [re, k] of WARE_TEXT) if (re.test(t)) return k;
  return null;
}
const kn = c => c.length > 4 ? c.slice(0, 4) + '.' + c.slice(4, 6) + (c.length > 6 ? ' ' + c.slice(6) : '') : c;
/** Ware in Klartext. w = {k: Schlüssel, aus: Angabe der Quelle, entsteht: Schlüssel oder Text des Erzeugnisses, wie: 'belegt'|'annahme', grund, sicherheit,
 *  schaetzen: true = wahrscheinlichen HS-Code auch zu belegter Ware zeigen (nur Annahmen-Atlas)}.
 *  HS-Code: im Hauptatlas (wie 'belegt') nur, wenn ein KN-Titel die Ware nennt; Annahmen-Atlas zeigt sonst den wahrscheinlichsten Code als Annahme. */
export function wareText(w) {
  const z = w && WARE[w.k], wort = z ? z[0] : w?.aus ? material(w.aus) : null;
  if (!wort) return {ton: 'offen', wort: 'unbekannt', hs: null, lang: 'Keine gelesene Quelle nennt, welche Ware an dieser Verbindung geliefert wird.'};
  const codes = z ? (z[1].length ? z[1] : w.wie === 'annahme' || w.schaetzen ? z[2] || [] : []) : [], hsAnnahme = z && !z[1].length && codes.length > 0;
  const hs = codes.length ? codes.map(c => ({code: kn(c), titel: KN[c] || ''})) : null;
  const ent = w.entsteht ? (WARE[w.entsteht]?.[0] || material(w.entsteht)) : null;
  const lang = w.wie === 'belegt' ? 'Laut Quelle' + (w.aus && z && material(w.aus) !== wort ? ' („' + material(w.aus) + '“)' : '') + '.' : 'Annahme' + (w.sicherheit ? ' (Sicherheit ' + w.sicherheit + ')' : '') + ', nicht belegt.';
  return {ton: w.wie === 'belegt' ? 'ok' : 'annahme', wort, hs, hsAnnahme, hsLeer: !hs && !!z, entsteht: ent, lang};
}
/** Ware für Verbindungen ohne Materialangabe aus Rohstoff und Art der beiden Punkte (nur Annahmen-Atlas). */
export function wareSchaetzen(rohstoff, von, nach) {
  const r = roh(rohstoff), a = String(von?.art || '') + ' ' + nameKurz(von?.name), b = String(nach?.art || '') + ' ' + nameKurz(nach?.name);
  const regel = [
    [/kohle/, /\(met\)/i, null, 'kokskohle', 'Die Mine fördert Kokskohle (laut Minenliste).'],
    [/kohle/, null, /stahlwerk|hochofen/i, 'kokskohle', 'Der Abnehmer ist ein Hochofen-Stahlwerk; dort wird Kokskohle eingesetzt.'],
    [/kohle/, /\(thermal\)/i, null, 'kesselkohle', 'Die Mine fördert Kesselkohle (laut Minenliste).'],
    [/kohle/, null, /kraftwerk/i, 'kesselkohle', 'Der Abnehmer ist ein Kraftwerk.'],
    [/kohle/, null, null, 'kohle', 'Sorte (Koks- oder Kesselkohle) aus den Angaben nicht ableitbar.'],
    [/eisenerz/, /pellet/i, null, 'eisenerz_pellets', 'Der Lieferant ist eine Pelletanlage.'],
    [/eisenerz/, null, null, 'eisenerz', 'Eisenerz geht überwiegend unagglomeriert als Fein- oder Stückerz in den Handel; Pellets nur, wo eine Pelletanlage genannt ist.'],
    [/lithium/, /hartgestein|spodumen|lepidolith/i, null, 'spodumen', 'Hartgesteinsminen liefern Spodumenkonzentrat an die Verarbeitung.'],
    [/lithium/, /sole|dle/i, null, 'lithiumcarbonat', 'Sole-Betriebe erzeugen am Standort meist Lithiumcarbonat.'],
    [/lithium/, /verarbeitung/i, null, 'lithiumsalze', 'Verarbeiter liefern Lithiumcarbonat und -hydroxid an den Markt.'],
    [/bauxit|aluminium/, /mine|bauxit/i, null, 'bauxit', 'Bauxitminen liefern Bauxit an Tonerdewerke.'],
    [/bauxit|aluminium/, /tonerde|raffinerie|refinery/i, null, 'tonerde', 'Tonerdewerke liefern Aluminiumoxid an Hütten.'],
    [/bauxit|aluminium/, /hütte|smelter/i, null, 'aluminium', 'Aluminiumhütten liefern Rohaluminium.'],
    [/kobalt/, /mine/i, null, 'kobalthydroxid', 'Kobalt verlässt die Minen im Kongo überwiegend als Hydroxid.'],
    [/kobalt/, /raffinerie|refinery|verarbeitung/i, null, 'kobalt', 'Raffinerien liefern Kobalt in Rohform oder als Salz.'],
    [/kupfer/, /mine|bergwerk/i, null, 'kupferkonzentrat', 'Kupferminen liefern überwiegend Konzentrat.'],
    [/kupfer/, /hütte|smelter|raffinerie|refinery/i, null, 'kupferkathoden', 'Hütten und Raffinerien liefern Kathoden.'],
    [/schrott/, null, null, 'stahlschrott', 'Stahlschrott ist der größte Schrottstrom.'],
    [/bauschutt/, null, null, 'rc_koernung', 'Aufbereiteter Bauschutt geht als RC-Gesteinskörnung in den Bau.']
  ];
  for (const [rr, ra, rb, k, grund] of regel) if (rr.test(r) && (!ra || ra.test(a)) && (!rb || rb.test(b))) return {k, wie: 'annahme', sicherheit: 'niedrig', grund};
  return null;
}
function waHtml(wt, w) {
  const hs = wt.hs ? ` <small>(${wt.hs.map(h => `<abbr title="${esc(h.titel)}">HS ${esc(h.code)}</abbr>`).join(', ')}${wt.hsAnnahme ? ', wahrscheinlich' : ''})</small>` : wt.hsLeer ? ' <small>(HS-Code: keine eindeutige Position)</small>' : '';
  const ent = wt.entsteht ? ` Dort entsteht daraus: ${esc(wt.entsteht)}.` : '';
  return `<p class="vk-ware" data-ton="${wt.ton}" data-ware="${esc(w?.k || 'unbekannt')}"><b>Was geliefert wird:</b> ${esc(wt.wort)}${hs} · ${esc(wt.lang)}${w?.grund ? ' ' + esc(w.grund) : ''}${ent}</p>`;
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

/** Prüfstatus in Klartext. ton: ok (freigegeben/geprüft), offen (laut Quelle, nicht geprüft), annahme, gesperrt.
 *  Hauptatlas liefert den kanonischen Freigabestatus (scripts/analysis/freigabe/status.py: FREIGEGEBEN, KANDIDAT, GESPERRT,
 *  UNKNOWN); KANDIDAT fällt auf die Evidenz zurück. Die alten Rohwerte bleiben für den Annahmen-Atlas lesbar. */
export function status(evidenz, pruef) {
  const e = String(evidenz || '').toUpperCase(), p = String(pruef || '').toUpperCase();
  if (p === 'REJECTED') return {ton: 'gesperrt', text: 'abgelehnt', lang: 'Bei der Prüfung abgelehnt.'};
  if (p === 'BLOCKED' || p === 'GESPERRT') return {ton: 'gesperrt', text: 'gesperrt', lang: 'Gesperrt: der Beleg reicht für eine Freigabe nicht aus.'};
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
  const ohne = OHNE_WARE.has(typ) || OHNE_WARE.has(v.typ), st = status(v.evidenz, v.pruef), vw = ohne ? null : verwendungText(v.verwendung);
  const wa = ohne ? null : wareText(v.ware || (v.material ? {k: wareSchluessel(v.material), aus: v.material, entsteht: v.entsteht, wie: /^(ANNAHME|ASSUMPTION)$/i.test(v.evidenz || '') ? 'annahme' : 'belegt'} : null));
  const mat = (wa && wa.wort !== 'unbekannt' && WARE[(v.ware || {}).k || wareSchluessel(v.material)] ? wa.wort : null) || material(v.material, v.rohstoff) || (v.rohstoff ? v.rohstoff.replace(/\s*\(.*\)$/, '') : null);
  const satz = t ? t.satz(a, b, {mat, anteil: v.anteil, vorgang: v.vorgang, jahr: v.jahr}) : `${a.n} ist mit ${b.n} verbunden (${String(v.typ || 'Art unbekannt').toLowerCase().replace(/_/g, ' ')}).`;
  const fakten = [['Art', t ? t.wort : String(v.typ || 'unbekannt')]];
  if (vw) fakten.push(['Verwendung', vw.wort + (vw.nace ? ' (' + vw.nace.split(' ').slice(0, 2).join(' ') + ')' : '')]);
  if (v.rohstoff) fakten.push(['Rohstoff', v.rohstoff]);
  if (wa && wa.wort !== 'unbekannt') {
    fakten.push(['Ware', wa.wort]);
    if (wa.hs) fakten.push(['HS-Code', wa.hs.map(h => h.code).join(', ') + (wa.hsAnnahme ? ' (Annahme)' : '')]);
  } else if (mat && v.material) fakten.push(['Material', mat]);
  if (v.anteil != null) fakten.push(['Anteil', fmt(v.anteil) + ' %']);
  const ort = p => [art(p.art)?.[0], p.land && !/^unknown$/i.test(p.land) ? p.land : null].filter(Boolean).join(', ');
  for (const f of v.extra || []) if (f && f[1] != null && f[1] !== '') fakten.push(f);
  fakten.push(['Sender', a.n + (ort(a.p) ? ' (' + ort(a.p) + ')' : '')], ['Empfänger', b.n + (ort(b.p) ? ' (' + ort(b.p) + ')' : '')]);
  return {titel: a.n + ' → ' + b.n, satz, warum: t ? t.warum : null, status: st, verwendung: vw, ware: wa, fakten};
}

/** Gesamtes Fenster-Innenleben als HTML: Klartext oben, Technik eingeklappt. technik/aktionen sind fertiges HTML des Aufrufers. */
export function verbindungHtml(v, {technik = '', aktionen = ''} = {}) {
  const k = klartext(v);
  const beleg = v.beleg?.url && /^https:\/\//.test(v.beleg.url) ? `<a href="${esc(v.beleg.url)}" target="_blank" rel="noopener">${esc(v.beleg.label || 'Quelle')} ↗</a>` : v.beleg?.label ? esc(v.beleg.label) : '';
  const grund = (v.hinweis ? `<p>${esc(v.hinweis)}</p>` : '') + (v.annahme ? `<p><b>Annahme:</b> ${esc(v.annahme)}</p>` : v.aussage ? `<p><b>Laut Quelle:</b> ${esc(v.aussage)}</p>` : v.zitat ? `<p><b>Laut Quelle:</b> ${esc(v.zitat)}</p>` : '');
  return `<div class="vk" data-verbindung-klartext>`
    + `<p class="vk-satz">${esc(k.satz)}</p>`
    + `<p class="vk-status" data-ton="${k.status.ton}"><b>${esc(k.status.text)}</b> · ${esc(k.status.lang)}</p>`
    + (k.ware ? waHtml(k.ware, v.ware || {k: wareSchluessel(v.material)}) : '')
    + (k.verwendung ? vwHtml(v.verwendung, k.verwendung) : '')
    + `<section class="vk-warum"><h3>Warum diese Verbindung?</h3>${k.warum ? `<p>${esc(k.warum)}</p>` : ''}${grund}${beleg ? `<p class="vk-beleg">Beleg: ${beleg}</p>` : '<p class="vk-beleg">Beleg: keiner angegeben</p>'}</section>`
    + `<dl class="vk-fakten">${k.fakten.map(([d, w]) => `<div><dt>${esc(d)}</dt><dd>${esc(w)}</dd></div>`).join('')}</dl>`
    + (aktionen ? `<p class="vk-aktionen">${aktionen}</p>` : '')
    + (technik ? `<details class="vk-technik"><summary>Technische Angaben</summary>${technik}</details>` : '')
    + `</div>`;
}

function vwHtml(w, vw) {
  const grund = w?.grund ? ' ' + esc(w.grund) : '', zitat = w?.zitat ? ` <q>${esc(w.zitat)}</q>` : '';
  const beleg = w?.beleg?.url && /^https:\/\//.test(w.beleg.url) ? ` <a href="${esc(w.beleg.url)}" target="_blank" rel="noopener">${esc(w.beleg.label || 'Quelle')} ↗</a>` : '';
  const ueber = w?.ueber ? ` <span class="vk-ueber">${esc(w.ueber)}</span>` : '';
  return `<p class="vk-verwendung" data-ton="${vw.ton}" data-verwendung="${esc(w?.zweck || 'unbekannt')}"><b>Wofür:</b> ${esc(vw.wort)}${vw.nace ? ` <small>(${esc(vw.nace)})</small>` : ''} · ${esc(vw.lang)}${grund}${zitat}${beleg}${ueber}</p>`;
}

/** Kurze Zeile für Listen (z. B. alle Verbindungen eines Punkts): Satz plus Status. */
export function verbindungZeile(v) {
  const k = klartext(v);
  const vw = k.verwendung?.nace ? ` <small class="vk-wofuer" data-ton="${k.verwendung.ton}">für ${esc(k.verwendung.wort)}${k.verwendung.ton === 'annahme' ? ' (Annahme)' : ''}</small>` : '';
  return `<span class="vk-zeile">${esc(k.satz)} <small data-ton="${k.status.ton}">${esc(k.status.text)}</small>${vw}</span>`;
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
.vk-rolle{font-size:12px;font-weight:600;color:#3e5a74;white-space:nowrap}
.vk-ware{margin:0;font-size:15px;line-height:1.5}.vk-ware small{opacity:.75}.vk-ware abbr{text-decoration:none;border-bottom:1px dotted currentColor;cursor:help}.vk-ware[data-ton=annahme] b{color:#6b4aa0}.vk-ware[data-ton=ok] b{color:#1d6b3a}
.vk-verwendung{margin:0;font-size:15px;line-height:1.5}.vk-verwendung small{opacity:.75}.vk-verwendung[data-ton=annahme] b,.vk-wofuer[data-ton=annahme]{color:#6b4aa0}.vk-verwendung[data-ton=ok] b,.vk-wofuer[data-ton=ok]{color:#1d6b3a}.vk-ueber{display:block;font-size:13px;opacity:.8}
@media(max-width:760px){.vk{gap:11px}.vk-satz{font-size:17px}.vk-warum p{font-size:14px}.vk-status{font-size:13px}}`;
if (typeof document !== 'undefined' && !document.getElementById('vk-css')) {
  const s = document.createElement('style'); s.id = 'vk-css'; s.textContent = CSS; document.head.append(s);
}
