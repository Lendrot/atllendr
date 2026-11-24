/** Einheiten und Euro im Hauptatlas (gemeinsame Datenbasis Stufe 4, Eddie 2026-11-14: "Anzeige einheitlich in Tonnen und Euro;
 *  Quellwert mit Originaleinheit/-währung bleibt sichtbar in den Details; Umrechnung mit belegtem Kurs (EZB) und Datum").
 *
 *  Gegenstück zu scripts/analysis/mengen/einheit.py (Faktoren) und waehrung.py (Kursregel). Die Kurstabelle unten erzeugt
 *  scripts/analysis/mengen/kurse.py aus der Eurostat-Rohantwort (EZB-Referenzkurse, Jahresmittel); CI prüft beides.
 *  Regel: Jahreswert -> EZB-Jahresmittel desselben Jahres. Kein EZB-Kurs (Währung oder Jahr) -> Euro unbekannt, Quellwert bleibt.
 */
export const LB_T = 0.45359237e-3;   // t je Pfund (internationale Definition; USGS MCS 2026 Anhang A: 1 lb = 453,6 g)
export const OZ_T = 31.1034768e-6;   // t je Feinunze (USGS MCS 2026 Anhang A: 31,103 g)
export const KURS_QUELLE = 'EZB-Referenzkurs (Jahresmittel), wiedergegeben von Eurostat ert_bil_eur_a';
export const KURS_URL = 'https://ec.europa.eu/eurostat/databrowser/view/ert_bil_eur_a/default/table?lang=de';
// KURSE-ANFANG (generiert von scripts/analysis/mengen/kurse.py, nicht von Hand ändern)
export const KURS_STAND = "2026-07-08T11:00:00+0200";
export const KURSE_JAHR = {
  ARS: {2015: 10.2528, 2016: 16.3401, 2017: 18.7417, 2018: 32.9115, 2019: 53.82},
  AUD: {2015: 1.4777, 2016: 1.4883, 2017: 1.4732, 2018: 1.5797, 2019: 1.6109, 2020: 1.6549, 2021: 1.5749, 2022: 1.5167, 2023: 1.6288, 2024: 1.6397, 2025: 1.7518},
  BAM: {2015: 1.95583, 2016: 1.95583, 2017: 1.95583, 2018: 1.95583, 2019: 1.95583, 2020: 1.95583, 2021: 1.95583, 2022: 1.95583, 2023: 1.95583, 2024: 1.95583, 2025: 1.95583},
  BRL: {2015: 3.7004, 2016: 3.8561, 2017: 3.6054, 2018: 4.3085, 2019: 4.4134, 2020: 5.8943, 2021: 6.3779, 2022: 5.4399, 2023: 5.401, 2024: 5.8283, 2025: 6.3072},
  CAD: {2015: 1.4186, 2016: 1.4659, 2017: 1.4647, 2018: 1.5294, 2019: 1.4855, 2020: 1.53, 2021: 1.4826, 2022: 1.3695, 2023: 1.4595, 2024: 1.4821, 2025: 1.5787},
  CHF: {2015: 1.0679, 2016: 1.0902, 2017: 1.1117, 2018: 1.155, 2019: 1.1124, 2020: 1.0705, 2021: 1.0811, 2022: 1.0047, 2023: 0.9718, 2024: 0.9526, 2025: 0.937},
  CNY: {2015: 6.9733, 2016: 7.3522, 2017: 7.629, 2018: 7.8081, 2019: 7.7355, 2020: 7.8747, 2021: 7.6282, 2022: 7.0788, 2023: 7.66, 2024: 7.7875, 2025: 8.1185},
  CZK: {2015: 27.279, 2016: 27.034, 2017: 26.326, 2018: 25.647, 2019: 25.67, 2020: 26.455, 2021: 25.64, 2022: 24.566, 2023: 24.004, 2024: 25.12, 2025: 24.688},
  DKK: {2015: 7.4587, 2016: 7.4452, 2017: 7.4386, 2018: 7.4532, 2019: 7.4661, 2020: 7.4542, 2021: 7.437, 2022: 7.4396, 2023: 7.4509, 2024: 7.4589, 2025: 7.4634},
  GBP: {2015: 0.72584, 2016: 0.81948, 2017: 0.87667, 2018: 0.88471, 2019: 0.87777, 2020: 0.8897, 2021: 0.8596, 2022: 0.85276, 2023: 0.86979, 2024: 0.84662, 2025: 0.85679},
  HKD: {2015: 8.6014, 2016: 8.5922, 2017: 8.8045, 2018: 9.2559, 2019: 8.7715, 2020: 8.8587, 2021: 9.1932, 2022: 8.2451, 2023: 8.465, 2024: 8.4454, 2025: 8.8104},
  HUF: {2015: 310.0, 2016: 311.44, 2017: 309.19, 2018: 318.89, 2019: 325.3, 2020: 351.25, 2021: 358.52, 2022: 391.29, 2023: 381.85, 2024: 395.3, 2025: 397.77},
  IDR: {2015: 14870.39, 2016: 14720.83, 2017: 15118.01, 2018: 16803.22, 2019: 15835.27, 2020: 16627.37, 2021: 16920.72, 2022: 15625.25, 2023: 16479.62, 2024: 17157.68, 2025: 18623.06},
  ILS: {2015: 4.3122, 2016: 4.2489, 2017: 4.0622, 2018: 4.2423, 2019: 3.9901, 2020: 3.9258, 2021: 3.8208, 2022: 3.5345, 2023: 3.988, 2024: 4.0067, 2025: 3.8927},
  INR: {2015: 71.1956, 2016: 74.3717, 2017: 73.5324, 2018: 80.7332, 2019: 78.8361, 2020: 84.6392, 2021: 87.4392, 2022: 82.6864, 2023: 89.3001, 2024: 90.5563, 2025: 98.5239},
  ISK: {2015: 146.3, 2016: 133.59, 2017: 120.54, 2018: 127.89, 2019: 137.28, 2020: 154.59, 2021: 150.15, 2022: 142.24, 2023: 149.13, 2024: 149.31, 2025: 144.66},
  JPY: {2015: 134.31, 2016: 120.2, 2017: 126.71, 2018: 130.4, 2019: 122.01, 2020: 121.85, 2021: 129.88, 2022: 138.03, 2023: 151.99, 2024: 163.85, 2025: 169.04},
  KRW: {2015: 1256.54, 2016: 1284.18, 2017: 1276.74, 2018: 1299.07, 2019: 1305.32, 2020: 1345.58, 2021: 1354.06, 2022: 1358.07, 2023: 1412.88, 2024: 1475.4, 2025: 1605.45},
  MXN: {2015: 17.6157, 2016: 20.6673, 2017: 21.3286, 2018: 22.7054, 2019: 21.5565, 2020: 24.5194, 2021: 23.9852, 2022: 21.1869, 2023: 19.183, 2024: 19.8314, 2025: 21.6705},
  MYR: {2015: 4.3373, 2016: 4.5835, 2017: 4.8527, 2018: 4.7634, 2019: 4.6374, 2020: 4.7959, 2021: 4.9015, 2022: 4.6279, 2023: 4.932, 2024: 4.9503, 2025: 4.8339},
  NOK: {2015: 8.9496, 2016: 9.2906, 2017: 9.327, 2018: 9.5975, 2019: 9.8511, 2020: 10.7228, 2021: 10.1633, 2022: 10.1026, 2023: 11.4248, 2024: 11.629, 2025: 11.7173},
  NZD: {2015: 1.593, 2016: 1.5886, 2017: 1.5897, 2018: 1.7065, 2019: 1.6998, 2020: 1.7561, 2021: 1.6724, 2022: 1.6582, 2023: 1.7622, 2024: 1.788, 2025: 1.9422},
  PHP: {2015: 50.522, 2016: 52.556, 2017: 56.973, 2018: 62.21, 2019: 57.985, 2020: 56.615, 2021: 58.299, 2022: 57.314, 2023: 60.163, 2024: 62.007, 2025: 64.977},
  PLN: {2015: 4.1841, 2016: 4.3632, 2017: 4.257, 2018: 4.2615, 2019: 4.2976, 2020: 4.443, 2021: 4.5652, 2022: 4.6861, 2023: 4.542, 2024: 4.3058, 2025: 4.2397},
  RON: {2015: 4.4454, 2016: 4.4904, 2017: 4.5688, 2018: 4.654, 2019: 4.7453, 2020: 4.8383, 2021: 4.9215, 2022: 4.9313, 2023: 4.9467, 2024: 4.9746, 2025: 5.0424},
  RUB: {2015: 68.072, 2016: 74.1446, 2017: 65.9383, 2018: 74.0416, 2019: 72.4553, 2020: 82.7248, 2021: 87.1527},
  SEK: {2015: 9.3535, 2016: 9.4689, 2017: 9.6351, 2018: 10.2583, 2019: 10.5891, 2020: 10.4848, 2021: 10.1465, 2022: 10.6296, 2023: 11.4788, 2024: 11.4325, 2025: 11.0663},
  SGD: {2015: 1.5255, 2016: 1.5275, 2017: 1.5588, 2018: 1.5926, 2019: 1.5273, 2020: 1.5742, 2021: 1.5891, 2022: 1.4512, 2023: 1.4523, 2024: 1.4458, 2025: 1.4756},
  THB: {2015: 38.0278, 2016: 39.0428, 2017: 38.2958, 2018: 38.1644, 2019: 34.7569, 2020: 35.7081, 2021: 37.8368, 2022: 36.8562, 2023: 37.6311, 2024: 38.1811, 2025: 37.1158},
  TRY: {2015: 3.0255, 2016: 3.3433, 2017: 4.1206, 2018: 5.7077, 2019: 6.3578, 2020: 8.0547, 2021: 10.5124, 2022: 17.4088, 2023: 25.7597, 2024: 35.5734, 2025: 44.8161},
  TWD: {2015: 35.247, 2016: 35.686, 2017: 34.363, 2018: 35.593, 2019: 34.603},
  USD: {2015: 1.1095, 2016: 1.1069, 2017: 1.1297, 2018: 1.181, 2019: 1.1195, 2020: 1.1422, 2021: 1.1827, 2022: 1.053, 2023: 1.0813, 2024: 1.0824, 2025: 1.13},
  ZAR: {2015: 14.1723, 2016: 16.2645, 2017: 15.049, 2018: 15.6186, 2019: 16.1757, 2020: 18.7655, 2021: 17.4766, 2022: 17.2086, 2023: 19.9551, 2024: 19.8297, 2025: 20.1789},
};
// KURSE-ENDE

// Anzeigezeichen der Originalwährung (Quellwert); ISO-Code, wo es kein eingeführtes Zeichen gibt
const ZEICHEN = {USD: 'US$', EUR: '€', CNY: 'RMB', AUD: 'A$', CAD: 'C$', GBP: '£', INR: 'INR', ZAR: 'ZAR', JPY: '¥', CLP: 'CLP'};
const ALIAS = {'US$': 'USD', 'US-$': 'USD', '€': 'EUR', RMB: 'CNY', 'A$': 'AUD'};
export const iso = c => ALIAS[c] || c;
export const zeichen = c => ZEICHEN[iso(c)] || iso(c);

const fmt = (n, st = 3) => new Intl.NumberFormat('de-DE', {maximumSignificantDigits: st}).format(n);
const ganz = n => new Intl.NumberFormat('de-DE', {maximumFractionDigits: 0}).format(n);

/** Tonnen: 28.105.000 -> "28,11 Mio. t"; 388.841 -> "388.841 t" (ganze Tonnen, keine Rundung darüber); 25,855 -> "25,9 t". Nie kt/Mt. */
export function tonnenText(t) {
  if (t == null || !isFinite(t)) return 'unbekannt';
  const nf = o => new Intl.NumberFormat('de-DE', o);
  if (Math.abs(t) >= 1e6) return nf({maximumFractionDigits: 2}).format(t / 1e6) + ' Mio. t';
  if (Math.abs(t) >= 1e3) return nf({maximumFractionDigits: 0}).format(t) + ' t';
  if (Math.abs(t) >= 10) return nf({maximumFractionDigits: 1}).format(t) + ' t';
  return fmt(t) + ' t';
}

/** Betrag mit Größenwort: 9,7e9 -> "9,7 Mrd. €" (zeichen = Anzeigezeichen der Währung). */
export function geldText(betrag, waehrung = 'EUR', st = 3) {
  const w = zeichen(waehrung), a = Math.abs(betrag);
  if (betrag == null || !isFinite(betrag)) return 'unbekannt';
  if (a >= 1e9) return fmt(betrag / 1e9, st) + ' Mrd. ' + w;
  if (a >= 1e6) return fmt(betrag / 1e6, st) + ' Mio. ' + w;
  if (a >= 1e4) return ganz(Number(fmt(betrag, st).replace(/\./g, '').replace(',', '.'))) + ' ' + w;
  return fmt(betrag, st) + ' ' + w;
}
export const euroText = (eur, st) => geldText(eur, 'EUR', st);

/** EZB-Jahresmittel: Fremdwährung je €. null, wenn es keinen EZB-Kurs für Währung und Jahr gibt. */
export function kurs(waehrung, jahr) {
  const c = iso(waehrung);
  if (c === 'EUR') return 1;
  const r = KURSE_JAHR[c];
  return r && jahr != null && r[String(jahr)] != null ? r[String(jahr)] : null;
}
const kursZahl = k => k.toLocaleString('de-DE', {minimumFractionDigits: 4, maximumFractionDigits: 4});

/** Betrag in Originalwährung -> {eur, kurs, kursText} oder {eur: null, grund}. jahr = Jahr, auf das sich der Betrag bezieht. */
export function inEuro(betrag, waehrung, jahr) {
  const c = iso(waehrung);
  if (betrag == null || !isFinite(betrag)) return {eur: null, grund: 'Betrag unbekannt'};
  if (c === 'EUR') return {eur: betrag, kurs: 1, kursText: ''};
  if (jahr == null) return {eur: null, grund: 'Jahr der Angabe unbekannt, kein Kurs wählbar'};
  const k = kurs(c, jahr);
  if (k == null) return {eur: null, grund: KURSE_JAHR[c] ? `kein EZB-Jahresmittel ${jahr} für ${c}` : `kein EZB-Referenzkurs für ${c}`};
  return {eur: betrag / k, kurs: k, kursText: `EZB-Jahresmittel ${jahr}: ${kursZahl(k)} ${zeichen(c)} je €`};
}

/** Anzeige "≈ 8,6 Mio. €" plus Details "laut Quelle 9,7 Mio. US$; EZB-Jahresmittel 2025: 1,1300 US$ je €".
 *  Ohne Kurs: text = "Euro unbekannt", Details nennen Quellwert und Grund. */
export function euroMitQuelle(betrag, waehrung, jahr, st) {
  const c = iso(waehrung), e = inEuro(betrag, c, jahr), q = geldText(betrag, c, st);
  if (c === 'EUR') return {eur: betrag, text: q, quelle: '', kursText: ''};
  if (e.eur == null) return {eur: null, text: 'Euro unbekannt', quelle: q, detail: `laut Quelle ${q}; ${e.grund}`, kursText: ''};
  return {eur: e.eur, text: '≈ ' + euroText(e.eur, st), quelle: q, kursText: e.kursText, detail: `laut Quelle ${q}; ${e.kursText}`};
}

/** Preis je Masse (z. B. US$/lb) -> € je t. jeT = Tonnen je Mengeneinheit des Preises (LB_T, OZ_T, 1). */
export function preisEuroJeT(preis, waehrung, jeT, jahr) {
  const e = inEuro(preis / jeT, waehrung, jahr);
  return e.eur == null ? e : {...e, text: euroText(e.eur, 4) + ' je t'};
}

// Masse-Schreibweisen der Quellen -> Tonnen je Einheit (wie SCHREIBWEISE/FAKTOR in einheit.py; CI vergleicht beide für jede Einheit der Daten)
const MASSE = [['billion lb', LB_T * 1e9], ['1000 troy oz', OZ_T * 1e3], ['troy oz', OZ_T], ['oz tr', OZ_T], ['million tonnes', 1e6], ['million_tonnes', 1e6], ['万吨', 1e4],
  ['Mio. t', 1e6], ['1000 t', 1e3], ['1.000 t', 1e3], ['Mt', 1e6], ['kt', 1e3], ['kg', 1e-3], ['dmt', 1], ['lb', LB_T], ['mtu', 1e-2], ['t', 1], ['tonnes', 1], ['tonne', 1]];
const NICHT_MASSE = /^(%|Stück$|Werke$|plants$|shipments$|Schiffsladungen\b|Ladungen zu je|Monate$|Wochen$|Tage$|wmt$|billion[ _]m3|Karat\b|UNKNOWN$|NA\b)/;
const GELD_ANFANG = /^(Tsd\. |1\.?000 |Mio\. |Mrd\. )?(USD|US\$|US-\$|US-Dollar|EUR|€|RMB|CNY|AUD|A\$|CAD|INR|GBP|ZAR|CLP|JPY)(?=$|[\s/])/;

/** Menge mit Einheit der Quelle -> {faktor (t je Einheit), einheit (Rest in t, z. B. "t Cu/Jahr"), bezug} oder null (keine Masse/unbekannt). */
export function masse(einheit) {
  const e = String(einheit ?? '').replace(/\s+/g, ' ').trim();
  if (!e || NICHT_MASSE.test(e) || GELD_ANFANG.test(e) || /^[A-Z]{3}\/[A-Z]{3}$/.test(e)) return null;
  for (const [s, f] of MASSE) {
    if (e.startsWith(s) && (e.length === s.length || /[\s/_(]/.test(e[s.length]))) {
      const rest = e.slice(s.length);
      return {faktor: f, einheit: 't' + (s === 'million_tonnes' || s === 'million tonnes' ? rest.replace(/_per_year$/, '/Jahr').replace(/_/g, ' ') : rest)};
    }
  }
  return null;
}

/** Wert mit Einheit der Quelle -> Anzeige in Tonnen: {t, text ("100.000 t Cu/Jahr"), quelle ("100 kt Cu/Jahr")} oder null. */
export function inTonnen(wert, einheit) {
  const m = masse(einheit);
  if (!m || wert == null || !isFinite(wert)) return null;
  const t = wert * m.faktor, z = n => Number(n).toLocaleString('de-DE', {maximumFractionDigits: 3});
  return {t, faktor: m.faktor, einheit: m.einheit, text: tonnenText(t) + m.einheit.slice(1), quelle: `${z(wert)} ${String(einheit).trim()}`};
}

/** Menge-Datensatz {wert, wert_von, wert_bis, einheit} -> gleiche Felder in Tonnen (einheit z. B. "t Cu/Jahr") plus quelle
 *  (Wert in der Einheit der Quelle). Keine Masse: unverändert, quelle = ''. */
export function felderInTonnen(m) {
  const x = masse(m && m.einheit);
  if (!x || x.faktor === 1) return {...m, quelle: ''};
  const f = v => v == null ? v : Math.round(v * x.faktor * 1e6) / 1e6, z = n => Number(n).toLocaleString('de-DE', {maximumFractionDigits: 3});
  const q = m.wert == null ? '' : (m.wert_von != null ? `${z(m.wert)} (${z(m.wert_von)} bis ${z(m.wert_bis)})` : m.wert_bis != null ? `${z(m.wert)} bis ${z(m.wert_bis)}` : z(m.wert)) + ' ' + m.einheit;
  return {...m, wert: f(m.wert), wert_von: f(m.wert_von), wert_bis: f(m.wert_bis), einheit: x.einheit, quelle: q};
}
