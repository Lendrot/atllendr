// Gemeinsamer Seitenkopf, Bereichsleiste und Klartext-Begriffe für alle Seiten (Eddie 2026-10-30, Ziel Note 1,5).
// Ersetzt nur den Seitenkopf und die sichtbare Beschriftung von Statuscodes; Daten und Evidenzstatus bleiben unverändert.
(function () {
  'use strict';
  var MENUE = [
    ['/atlas/', 'Globus', ['/atlas/', '/minen/', '/logistik/', '/verarbeitung/', '/indien/', '/karte/', '/deutschland/']],
    ['/kupfer/', 'Kupfer', ['/kupfer/']],
    ['/lithium/', 'Lithium', ['/lithium/']],
    ['/abfall/', 'Abfall', ['/abfall/', '/anlagen/', '/quellen/', '/recherche/']],
    ['/uebernahmen/', 'Übernahmen', ['/uebernahmen/']],
    ['/themen/', 'Fachatlanten', ['/themen/']],
    ['/daten/', 'Daten & Quellen', ['/daten/', '/datenluecken/', '/produktion/', '/audit/', '/foundation/']],
    ['/begriffe/', 'Begriffe', ['/begriffe/']]
  ];
  var UNTER = {
    '/atlas/': [['/atlas/', 'Gesamtglobus'], ['/minen/', 'Rohstoffwelt'], ['/indien/', 'Indien'], ['/deutschland/', 'Deutschland'], ['/karte/', '2D-Karte'], ['/minen/karte/', 'Minenkarte']],
    '/kupfer/': [['/kupfer/', 'Kupferketten'], ['/kupfer/markt/', 'Kupfermarkt'], ['/kupfer/markt/bericht/', 'Kettenbericht'], ['/kupfer/routenbelege/', 'Routenbelege']],
    '/lithium/': [['/lithium/', 'Lithium-Standorte'], ['/lithium/markt/', 'Lithiummarkt']],
    '/abfall/': [['/abfall/', 'Abfallanlagen Europa'], ['/anlagen/', 'EPA-Anlagen USA'], ['/quellen/', 'Abfallquellen'], ['/recherche/', 'Stoff- und Geldströme']],
    '/daten/': [['/daten/', 'Daten & Quellen'], ['/datenluecken/', 'Datenlücken'], ['/produktion/', 'Produktion'], ['/audit/', 'Methodik: Prüfbericht'], ['/foundation/', 'Methodik: Datenfundament']]
  };
  // Klartext für Statuscodes und englische Fachwörter. Der Code bleibt im Tooltip und in data-begriff erhalten.
  var BEGRIFFE = {
    APPROVED: ['freigegeben', 'Beziehung mit gelesener Quelle, ausdrücklich freigegeben (Status APPROVED).'],
    VERIFIED: ['quellengeprüft', 'Quelle wurde gelesen und stützt die Angabe; noch keine Freigabe (Status VERIFIED).'],
    CANDIDATE: ['vorläufig', 'Kandidat: würde gelten, sobald die zugehörigen Freigaben vorliegen (Status CANDIDATE).'],
    FACT: ['laut Quelle', 'Die Angabe steht so in einer Quelle; ob sie geprüft ist, zeigt der Prüfstatus (Evidenz FACT).'],
    INFERENCE: ['abgeleitet', 'Aus belegten Angaben geschlossen, nicht direkt belegt (Evidenz INFERENCE).'],
    ASSUMPTION: ['Annahme', 'Arbeitsannahme ohne Beleg (Evidenz ASSUMPTION).'],
    PROPOSED_ASSUMPTION: ['vorgeschlagene Annahme', 'Annahme, die noch nicht abgenommen ist (PROPOSED_ASSUMPTION).'],
    UNKNOWN: ['unbekannt', 'Nicht belegt. Unbekannt heißt nicht „kein Risiko“ (Status UNKNOWN).'],
    NEEDS_RESEARCH: ['Recherche offen', 'Noch nicht formal geprüft; Quelle muss gelesen werden (Status NEEDS_RESEARCH).'],
    Entities: ['Einträge', 'Unternehmen, Standorte und andere erfasste Akteure (Entities).'],
    Claims: ['Aussagen', 'Einzelne belegte Aussagen mit Quelle (Claims).'],
    Lineage: ['Herkunftskette', 'Nachvollziehbare Herkunft einer Angabe bis zur Quelle (Lineage).'],
    Dependency: ['Abhängigkeits', 'Abhängigkeit zwischen Standorten oder Unternehmen (Dependency).'],
    Scope: ['Umfang', 'Abgedeckter Ausschnitt (Scope).'],
    Knowledge: ['Wissen', 'Erfasste Daten mit Quellen (Knowledge).'],
    Analysis: ['Analyse', 'Auswertung der erfassten Daten (Analysis).'],
    Visualization: ['Darstellung', 'Anzeige auf Karte und Globus (Visualization).'],
    EXPLORE: ['Erkunden', 'Ansicht zum freien Erkunden (Explore).'],
    ANALYZE: ['Analysieren', 'Ansicht mit Auswertungen (Analyze).'],
    RESEARCH: ['Recherche', 'Ansicht mit offenen Prüfungen und Quellen (Research).']
  };
  // Weitere Systemcodes (GROSS_MIT_UNTERSTRICH) werden Wort für Wort eingedeutscht; der Code steht im Tooltip.
  var WORT = {PARTIALLY: 'teilweise', EVIDENCED: 'belegt', EVIDENCE: 'Beleg', CURRENT: 'aktuell', PERIOD: 'Zeitraum', ORIGIN: 'Herkunft', ATTRIBUTED: 'zugeordnet',
    SALES: 'Verkauf', REPORTED: 'berichtet', ROLE: 'Rolle', MATERIAL: 'Material', BASIS: 'Basis', IDENTITY: 'Identität', UNRESOLVED: 'ungeklärt',
    SINGLE: 'einzige', SOURCE: 'Quelle', SOURCES: 'Quellen', ONLY: 'nur', CONFLICT: 'Widerspruch', SHARE: 'Anteil', INVALID: 'ungültig', UNDEFINED: 'nicht festgelegt',
    RECORDED: 'erfasst', SCOPE: 'Umfang', UNVERIFIED: 'ungeprüft', VERIFIED: 'geprüft', NOT: 'nicht', NO: 'kein', RISK: 'Risiko', IS: 'ist', SIGNAL: 'Signal',
    BLOCKED: 'gesperrt', OWN: 'eigene', UNKNOWN: 'unbekannt', APPROVED: 'freigegeben', CANDIDATE: 'vorläufig', PENDING: 'ausstehend', REVIEW: 'Prüfung',
    READY: 'bereit', MISSING: 'fehlt', DATA: 'Daten', GAP: 'Lücke', OPEN: 'offen', CLOSED: 'geschlossen', CAPACITY: 'Kapazität', TRANSPORT: 'Transport',
    ROUTE: 'Route', SUPPLY: 'Lieferung', CUSTOMER: 'Kunde', OFFTAKE: 'Abnahme', SMELTER: 'Hütte', REFINERY: 'Raffinerie', MINE: 'Mine', VALID: 'gültig',
    VALIDITY: 'Gültigkeit', COMPLETE: 'vollständig', INCOMPLETE: 'unvollständig', PARTIAL: 'teilweise', ADMISSIBLE: 'zulässig', INADMISSIBLE: 'unzulässig',
    QUALITATIVE: 'qualitativ', ONLY_: 'nur', HISTORICAL: 'historisch', CONTEXT: 'Kontext', FOR: 'für', AND: 'und', OR: 'oder', WITH: 'mit', WITHOUT: 'ohne',
    FEED: 'Zulauf', QUANTITY: 'Menge', ALTERNATIVE: 'Alternative', NEEDS: 'braucht', RESEARCH: 'Recherche', PUBLIC: 'öffentlich', AVAILABLE: 'verfügbar',
    AVAILABILITY: 'Verfügbarkeit', SAFE: 'sicher', CONTAINED: 'abgegrenzt', ASSUMPTION: 'Annahme', PROPOSED: 'vorgeschlagen', DOWNSTREAM: 'nachgelagert', FACT: 'laut Quelle'};
  // Häufige Systemcodes als ganze Wendung; seltene fallen auf die Wortliste zurück
  var PHRASEN = {"QUELLE_UNGEPRUEFT": "Quelle ungeprüft","RESEARCH_INCOMPLETE": "Recherche unvollständig","SOURCE_TEXT_REVIEWED": "Quellentext gelesen","SOURCE_DATE_ONLY": "nur Quellendatum","SOURCE_SNAPSHOT_NOT_CURRENT_VALIDITY": "Stand der Quelle, keine aktuelle Gültigkeit","NO_UNSOURCED_FLOW_ALLOCATION": "keine Mengenaufteilung ohne Quelle","COMPANY_PRIMARY": "Unternehmensangabe (Primärquelle)","ANTEIL_UNKNOWN": "Anteil unbekannt","PRODUKTION_UNKNOWN": "Produktion unbekannt","NOT_AUDITED": "nicht geprüft (kein Audit)","NOT_INDEPENDENTLY_AUDITED": "nicht unabhängig geprüft","IDENTITY_SOURCE_SCOPED": "Identität nur laut dieser Quelle","SINGLE_SOURCE_ONLY": "nur eine Quelle","FISCAL_YEAR": "Geschäftsjahr","UNKNOWN_AVAILABILITY": "Verfügbarkeit unbekannt","NEEDS_REVIEW": "braucht Prüfung","KOORDINATE_FEHLT": "Koordinate fehlt","POINT_IN_TIME": "Stichtag","HISTORICAL_OPERATION_PRODUCTION_NOT_CURRENT_LOSS": "historische Produktion, kein aktueller Ausfall","NO_AUTOMATIC_EQUITY_ATTRIBUTION": "keine automatische Zurechnung nach Beteiligung","TRANSPORTS_TO": "transportiert zu","KOORDINATE_APPROXIMATE": "Koordinate ungefähr","SOURCE_SCOPED_REFERENCE": "Bezeichnung laut Quelle","REFINED_METAL": "raffiniertes Metall","EIGENTUEMER_ZUSAMMENGESETZT": "Eigentümer zusammengesetzt","UNKNOWN_PERIOD": "Zeitraum unbekannt","QUELLE_SAMMELLISTE": "Quelle ist Sammelliste","PROCESSES_AT": "verarbeitet bei","REFERENCE_PERIOD_UNKNOWN": "Bezugszeitraum unbekannt","CONTAINED_METAL": "Metallinhalt","PERIOD_UNKNOWN": "Zeitraum unbekannt","NO_QUANTIFIED_DISRUPTION": "kein bezifferter Ausfall","NO_FOUR_MINE_AGGREGATE_AS_ESCONDIDA_QUANTITY": "Summe der vier Minen nicht als Menge von Escondida","NO_PORT_TO_CUSTOMER_ROUTE_INFERENCE": "kein Schluss vom Hafen auf den Kunden","CUSTOMER_UNKNOWN": "Kunde unbekannt","PROCESSOR_UNKNOWN": "Verarbeiter unbekannt","NO_COMPLETE_DOWNSTREAM_CHAIN": "keine vollständige nachgelagerte Kette","NO_VERIFIED_SUBSTITUTION": "kein geprüfter Ersatz","PARTIALLY_OWNS": "besitzt anteilig","PORT_REFERENCE": "Hafenangabe","PUBLICLY_ACCESSIBLE": "öffentlich zugänglich","DO_NOT_CLOSE_ORIGINAL_GAP": "ursprüngliche Lücke nicht schließen","DO_NOT_INFER_FEED_FROM_SALES": "Zulauf nicht aus Verkäufen ableiten","DO_NOT_INFER_SPARE_CAPACITY": "freie Kapazität nicht ableiten","CORPORATE_GROUP_REFERENCE": "Konzernangabe","COMPANY_REFERENCE": "Unternehmensangabe","PROCESSING_GROUP": "Verarbeitungsgruppe","NO_COMPLETE_CURRENT_CUSTOMER_ROSTER": "keine vollständige aktuelle Kundenliste","NO_CONTRACTED_DELIVERY_MODEL": "kein Liefervertragsmodell","PRODUCTION_UNKNOWN": "Produktion unbekannt","NO_QUANTITATIVE_NETWORK_LOSS": "kein bezifferter Netzausfall","CAPACITY_UNKNOWN": "Kapazität unbekannt","NO_HISTORICAL_CAPACITY_TREND": "kein historischer Kapazitätsverlauf","OWNER_UNKNOWN": "Eigentümer unbekannt","NO_LEGAL_ENTITY_MERGE": "keine Zusammenführung von Rechtsträgern","NO_ULTIMATE_PARENT_INFERENCE": "kein Schluss auf die oberste Muttergesellschaft","EVIDENCE_INCOMPLETE": "Beleg unvollständig","NO_EXACT_FACILITY_MARKER": "keine genaue Anlagenposition","NO_CURRENT_ROUTE_CERTAINTY": "aktuelle Route nicht sicher","TRANSPORT_UNKNOWN": "Transport unbekannt","NO_VERIFIED_ALTERNATIVE": "keine geprüfte Alternative","NO_CONFIRMED_CURRENT_DELIVERY": "keine bestätigte aktuelle Lieferung","NO_CONFIRMED_DEMONSTRATION_COMPLETION": "Abschluss der Erprobung nicht bestätigt","PARTIALLY_EVIDENCED_CURRENT_PERIOD": "für den aktuellen Zeitraum teilweise belegt","ORIGIN_ATTRIBUTED_SALES_REPORTED": "Verkäufe nach Herkunft berichtet","NO_ORIGIN_SALES_TO_FEED_DMT_CONVERSION": "keine Umrechnung von Verkäufen in Zulaufmengen","NO_AGGREGATE_SMELTER_FEED_ALLOCATION": "keine Aufteilung des Hüttenzulaufs","NO_CONTINUOUS_VALIDITY_OUTSIDE_REPORTED_PERIOD": "gilt nur im berichteten Zeitraum","NO_SPARE_CAPACITY_FROM_NAMEPLATE_OR_TARGET": "freie Kapazität nicht aus Nenn- oder Zielwerten","COUNTRY_CONCENTRATION": "Länderkonzentration","EXACT_FACILITY": "genaue Anlage","DEV_ANALYSIS_NOT_RELEASE_CERTIFIED": "Arbeitsstand, nicht freigegeben","SIGNAL_IS_INFERENCE_NOT_FACT": "Signal ist abgeleitet, keine Tatsache","THRESHOLDS_ARE_ASSUMPTIONS_UNTIL_ACCEPTED": "Schwellen sind Annahmen bis zur Abnahme","TOPOLOGY_DOES_NOT_PROVE_EXCLUSIVE_DEPENDENCE": "Netzstruktur beweist keine alleinige Abhängigkeit","ATLAS_SCOPE_IS_SELECTED_CHAINS_NOT_GLOBAL": "nur ausgewählte Ketten, nicht weltweit","CANDIDATE_BASIS_USES_UNAPPROVED_RELATIONSHIPS": "vorläufige Basis nutzt nicht freigegebene Beziehungen","MINE_COMPLEX": "Minenkomplex","SAME_ENTITY_CONFIRMED": "gleiche Einheit bestätigt","DOWNSTREAM_COMPANY_REFERENCE": "nachgelagerte Unternehmensangabe","NOT_ESTIMABLE": "nicht schätzbar","HYPOTHETICAL_ONLY": "nur hypothetisch","ANNOUNCEMENT_NOT_COMPLETED_DELIVERY": "Ankündigung, keine erfolgte Lieferung","MIXED_REPORTING_PERIODS": "gemischte Berichtszeiträume","NOT_VERIFIED": "nicht geprüft","BOTTLENECK_FACILITY": "Engpass-Anlage","NO_MATERIAL_FLOWS_RECORDED": "keine Stoffströme erfasst","SOURCE_NAME_ONLY": "nur Quellenname","APPROXIMATE_FACILITY": "ungefähre Anlagenposition","DEPOSIT_CENTROID": "Mittelpunkt der Lagerstätte","UNKNOWN_ROLE": "Rolle unbekannt","UNKNOWN_MATERIAL_BASIS": "Materialbasis unbekannt","IDENTITY_UNRESOLVED": "Identität ungeklärt","ROLE_UNDEFINED": "Rolle nicht festgelegt","SHARE_INVALID": "Anteil ungültig","FACT_CONFLICT": "widersprüchliche Quellen","RECORDED_SCOPE_UNVERIFIED": "erfasster Umfang ungeprüft","UNKNOWN_IS_NOT_NO_RISK": "unbekannt heißt nicht kein Risiko","NO_SIGNAL": "kein Signal"};
  var SNAKE = /\b[A-Z][A-Z0-9]+(?:_[A-Z0-9]+)+\b/g;
  function snakeText(c) { return PHRASEN[c] || c.split('_').map(function (w) { return WORT[w] || (w.length <= 3 ? w : w.toLowerCase()); }).join(' '); }
  var CODE = new RegExp('\\b(' + Object.keys(BEGRIFFE).sort(function (a, b) { return b.length - a.length; }).join('|') + ')\\b', 'g');
  // Interne Entwicklerkennungen (Versionsstände, Commit-Kürzel, Projektziele) sind für Nutzer ohne Bedeutung.
  var INTERN = /\s*(?:·\s*)?\b(?:V\d{2}(?:\.\d+)?(?:\s*·\s*DEV)?|DEV|Ziel \d+\s*·)(?=\s|$|·|\)|,|:)/g;
  var P = (location.pathname.indexOf('/atllendr/') === 0) ? '/atllendr' : '';
  var pfad = location.pathname.slice(P.length) || '/';
  if (!/\/$/.test(pfad) && !/\.\w+$/.test(pfad)) pfad += '/';

  function bereich() {
    var best = null, len = -1;
    MENUE.forEach(function (m) { m[2].forEach(function (p) { if (pfad.indexOf(p) === 0 && p.length > len) { best = m; len = p.length; } }); });
    return best;
  }
  function el(tag, attrs, html) { var e = document.createElement(tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (html != null) e.innerHTML = html; return e; }
  function link(href, text, aktiv) { var a = el('a', {href: href}); a.textContent = text; if (aktiv) a.setAttribute('aria-current', 'page'); return a; }

  function kopfBauen(alt) {
    var b = bereich();
    var kopf = el('header', {'class': 'ss-kopf', 'data-site-shell': '', role: 'banner'});
    kopf.appendChild(el('a', {'class': 'ss-marke', href: '/atlas/', 'aria-label': 'Marktatlas Startseite'},
      '<i><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/></svg></i><span>marktatlas<b>.</b></span>'));
    var nav = el('nav', {'class': 'ss-menue', id: 'ss-menue', 'aria-label': 'Hauptmenü'});
    MENUE.forEach(function (m) {
      var a = link(m[0], m[1], b === m); if (m[0] === '/begriffe/') a.className = 'ss-rechts'; nav.appendChild(a);
      if (b === m && UNTER[m[0]]) {
        var u = el('div', {'class': 'ss-menue-unter'});
        UNTER[m[0]].forEach(function (x) { u.appendChild(link(x[0], x[1], x[0] === pfad)); });
        nav.appendChild(u);
      }
    });
    kopf.appendChild(nav);
    // Seiteneigene Bedienelemente (z. B. Quellen-Knopf der 2D-Karte) bleiben erhalten.
    if (alt) {
      var akt = el('div', {'class': 'ss-aktionen'});
      Array.prototype.forEach.call(alt.querySelectorAll('button[id],select[id],input[id]'), function (x) {
        // Der Quellen-Knopf der Ansicht heißt kurz „Quellen“, damit er nicht mit dem Menüpunkt verwechselt wird
        Array.prototype.forEach.call(x.childNodes, function (t) { if (t.nodeType === 3 && /Daten & Quellen/.test(t.nodeValue)) t.nodeValue = t.nodeValue.replace('Daten & Quellen', 'Quellen'); });
        akt.appendChild(x);
      });
      if (akt.children.length) kopf.appendChild(akt);
    }
    var knopf = el('button', {type: 'button', 'class': 'ss-knopf', 'data-menue-knopf': '', 'aria-controls': 'ss-menue', 'aria-expanded': 'false', 'aria-label': 'Menü öffnen'},
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>');
    knopf.addEventListener('click', function () {
      var offen = !kopf.hasAttribute('data-offen');
      if (offen) kopf.setAttribute('data-offen', ''); else kopf.removeAttribute('data-offen');
      knopf.setAttribute('aria-expanded', String(offen)); knopf.setAttribute('aria-label', offen ? 'Menü schließen' : 'Menü öffnen');
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && kopf.hasAttribute('data-offen')) knopf.click(); });
    kopf.appendChild(knopf);
    return kopf;
  }
  function unterBauen() {
    var b = bereich(); if (!b || !UNTER[b[0]]) return null;
    var nav = el('nav', {'class': 'ss-unter', 'data-site-shell': '', 'data-umschalter': '', 'aria-label': 'Seiten im Bereich ' + b[1]});
    UNTER[b[0]].forEach(function (x) { nav.appendChild(link(x[0], x[1], x[0] === pfad)); });
    return nav;
  }
  function altenKopfFinden() {
    var k = Array.prototype.find.call(document.querySelectorAll('body > header, body > .app > header, #app > header.topbar, header.topbar, header.top'),
      function (x) { return !x.hasAttribute('data-site-shell'); });
    if (!k) return null;
    if (k.querySelector('h1')) return null; // Kopf mit Seitentitel bleibt Inhalt (z. B. Routenbelege)
    return k;
  }
  var eingebaut = false;
  function einbauen() {
    if (eingebaut) return true;
    var alt = altenKopfFinden();
    var globus = !!document.querySelector('#app, .app .space, #globe');
    if (!alt && globus && document.readyState !== 'complete') return false; // Globus-Seiten bauen ihren Kopf per Skript
    var kopf = kopfBauen(alt), unter = unterBauen();
    if (globus) document.body.setAttribute('data-ss-globus', '');
    if (alt) {
      alt.parentNode.insertBefore(kopf, alt);
      if (unter && !globus) alt.parentNode.insertBefore(unter, alt);
      alt.remove();
    } else {
      document.body.insertBefore(kopf, document.body.firstChild);
      if (unter) kopf.after(unter);
    }
    if (unter && globus) { /* Globus-Seiten: Bereichsseiten nur im Menü, damit der Globus Platz behält */ }
    eingebaut = true;
    return true;
  }

  // Englische Sätze aus Datendateien, die angezeigt werden (Daten bleiben unverändert)
  var SAETZE = [
    ['Copper chains of the V29 copper ledger (18 selected source-bound chains, not global copper coverage).', 'Kupferketten aus dem Kupferbestand (18 ausgewählte, quellengebundene Ketten, keine weltweite Abdeckung).']
  ];
  // Globus-Seiten bauen ihren Kopf teils erst nach dem Laden der Daten: dann diesen nachträglich ersetzen
  function spaeterKopf() {
    var alt = altenKopfFinden(), kopf = document.querySelector('header.ss-kopf[data-site-shell]');
    if (!alt || !kopf) return;
    var akt = kopf.querySelector('.ss-aktionen');
    Array.prototype.forEach.call(alt.querySelectorAll('button[id],select[id],input[id]'), function (x) {
      if (!akt) { akt = el('div', {'class': 'ss-aktionen'}); kopf.insertBefore(akt, kopf.querySelector('.ss-knopf')); }
      akt.appendChild(x);
    });
    alt.remove();
  }
  var AUS = 'script,style,code,pre,textarea,option,select,input';
  // Technische Kennungen (UUID, Prüfsummen, Dateipfade) werden als Kennung gezeigt; der volle Wert steht im Tooltip.
  var KENNUNG = /(?:\bsha256\s+)?\b(?:[a-z][a-z-]*:)?(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|(?=[0-9]*[a-f])[0-9a-f]{12,64})\b…?|\b[\w.-]+(?:\/[\w.-]+)+\.(?:jsonl?|csv|md|sqlite)\b|\bV\d{2}(?:\.\d+)?-[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+\b|\b[a-z]+:v\d{3}:[\w:-]+/g;
  function klartext(t) { return t.replace(SNAKE, snakeText).replace(CODE, function (_, c) { return BEGRIFFE[c][0]; }); }
  function begriffeErsetzen(wurzel) {
    var w = document.createTreeWalker(wurzel, NodeFilter.SHOW_TEXT), liste = [];
    for (var n; (n = w.nextNode());) {
      var p = n.parentElement;
      if (!p || p.closest('[data-begriff],[data-roh],abbr,' + AUS)) continue;
      var v = n.nodeValue;
      for (var i = 0; i < SAETZE.length; i++) if (v.indexOf(SAETZE[i][0]) >= 0) { v = n.nodeValue = v.split(SAETZE[i][0]).join(SAETZE[i][1]); }
      CODE.lastIndex = 0; INTERN.lastIndex = 0; KENNUNG.lastIndex = 0; SNAKE.lastIndex = 0;
      if (CODE.test(v) || INTERN.test(v) || KENNUNG.test(v) || SNAKE.test(v)) liste.push(n);
    }
    liste.forEach(function (n) {
      var t = n.nodeValue, p = n.parentElement;
      if (p.closest('a[href^="http"]')) return;
      INTERN.lastIndex = 0; t = t.replace(INTERN, '');
      if (/^\s*(?:V\d{2}|DEV)\b/.test(n.nodeValue)) t = t.replace(/^\s*·\s*/, '');
      if (p.closest('svg')) { var k = klartext(t); if (k !== n.nodeValue) n.nodeValue = k; return; }
      var frag = document.createDocumentFragment(), last = 0, m, teile = [];
      CODE.lastIndex = 0; while ((m = CODE.exec(t))) teile.push({i: m.index, l: m[0].length, art: 'code', w: m[1]});
      KENNUNG.lastIndex = 0;
      while ((m = KENNUNG.exec(t))) {
        // Teile von Adressen (https://…/abc123…) bleiben unverändert
        var vor = t.charAt(m.index - 1), wort = t.slice(t.lastIndexOf(' ', m.index) + 1, m.index);
        if (vor === '/' || vor === '=' || vor === '#' || /:\/\//.test(wort)) continue;
        teile.push({i: m.index, l: m[0].length, art: 'id', w: m[0]});
      }
      SNAKE.lastIndex = 0; while ((m = SNAKE.exec(t))) teile.push({i: m.index, l: m[0].length, art: 'snake', w: m[0]});
      teile.sort(function (a, b) { return a.i - b.i; });
      teile.forEach(function (x) {
        if (x.i < last) return;
        if (x.i > last) frag.appendChild(document.createTextNode(t.slice(last, x.i)));
        var a;
        if (x.art === 'snake') {
          a = document.createElement('abbr'); a.setAttribute('data-begriff', x.w); a.title = 'Systemcode ' + x.w + ' · Erklärung unter „Begriffe“'; a.textContent = snakeText(x.w);
        } else if (x.art === 'code') {
          var b = BEGRIFFE[x.w]; a = document.createElement('abbr');
          a.setAttribute('data-begriff', x.w); a.title = b[1]; a.textContent = b[0];
        } else {
          var datei = x.w.indexOf('/') > 0, summe = /^sha256/.test(x.w);
          a = document.createElement('code'); a.className = 'ss-kennung'; a.setAttribute('data-roh', '');
          a.title = (datei ? 'Datei im Datenbestand: ' : summe ? 'Prüfsumme der Quelldatei: ' : 'Technische Kennung: ') + x.w.replace(/^sha256\s+/, '');
          a.textContent = datei ? 'Datei' : summe ? 'Prüfsumme' : 'Kennung';
        }
        frag.appendChild(a); last = x.i + x.l;
      });
      if (last < t.length) frag.appendChild(document.createTextNode(t.slice(last)));
      if (t !== n.nodeValue || last > 0) p.replaceChild(frag, n);
    });
  }
  // Seitentitel ohne Versionsnummern
  function titelBereinigen() { var t = document.title.replace(/\s*V\d{2}(\.\d+)?\s*·?\s*/g, ' ').replace(/\s+/g, ' ').trim(); if (t !== document.title) document.title = t; }

  var warte = null;
  function lauf() {
    einbauen();
    begriffeErsetzen(document.body);
  }
  function start() {
    titelBereinigen();
    lauf();
    // Nur geänderte Teile prüfen, nicht bei jeder Änderung die ganze Seite
    var offen = [];
    new MutationObserver(function (mut) {
      var kopf = false;
      for (var i = 0; i < mut.length; i++) {
        var m = mut[i];
        if (m.type === 'characterData') { if (m.target.parentNode) offen.push(m.target.parentNode); continue; }
        for (var j = 0; j < m.addedNodes.length; j++) {
          var n = m.addedNodes[j];
          if (n.nodeType === 1) { offen.push(n); if (n.tagName === 'HEADER' || n.querySelector('header')) kopf = true; }
          else if (n.nodeType === 3 && n.parentNode) offen.push(n.parentNode);
        }
      }
      if (kopf) { if (!eingebaut && altenKopfFinden()) einbauen(); else if (eingebaut) spaeterKopf(); }
      if (warte || !offen.length) return;
      warte = setTimeout(function () {
        warte = null;
        var liste = offen; offen = [];
        liste.forEach(function (n) { if (n.isConnected) begriffeErsetzen(n); });
      }, 60);
    }).observe(document.body, {childList: true, subtree: true, characterData: true});
    window.addEventListener('load', function () { einbauen(); setTimeout(sprungmarken, 1200); });
  }
  // Sprungmarken für lange Seiten: aus den Zwischenüberschriften, als Leiste unter dem Seitentitel
  function slug(t) { return 'abschnitt-' + t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40); }
  function sprungmarken() {
    if (document.querySelector('[data-sprungmarken]') || document.body.hasAttribute('data-ss-globus')) return;
    if (document.documentElement.scrollHeight < innerHeight * 4) return;
    var sichtbar = function (e) { return e.getClientRects().length > 0 && !e.closest('header,nav,aside,dialog,details:not([open])'); };
    // Überschriften einzelner Listeneinträge (Karten) sind keine Abschnitte
    var hs = Array.prototype.filter.call(document.querySelectorAll('h2'), function (h) { return sichtbar(h) && !h.closest('li, article, .card, .gap, [role=listitem]'); });
    hs = hs.filter(function (h, i) { return hs.indexOf(h) === i && h.textContent.trim(); });
    // Seiten mit Filterformular und Ergebnisliste: Sprung zu Filter und Ergebnissen
    var form = Array.prototype.find.call(document.querySelectorAll('main form[id]'), sichtbar), erg = document.getElementById('results');
    if (hs.length < 3 && form && erg) {
      var t1 = el('h2', {'class': 'ss-unsichtbar'}); t1.textContent = 'Filter'; t1.id = 'abschnitt-filter';
      var t2 = el('h2', {'class': 'ss-unsichtbar'}); t2.textContent = 'Ergebnisse'; t2.id = 'abschnitt-ergebnisse';
      form.before(t1); erg.before(t2); hs = hs.concat([t1, t2]);
      if (hs.length < 3) { var t0 = Array.prototype.find.call(document.querySelectorAll('h1'), sichtbar); if (t0) { if (!t0.id) t0.id = 'abschnitt-anfang'; hs.unshift(t0); } }
    }
    if (hs.length < 3) return;
    var nav = el('nav', {'class': 'ss-sprung', 'data-sprungmarken': '', 'aria-label': 'Abschnitte dieser Seite'});
    nav.appendChild(el('span', {}, 'Auf dieser Seite:'));
    var ids = {};
    hs.slice(0, 14).forEach(function (h) {
      if (!h.id) { var id = slug(h.textContent), n = id, k = 2; while (ids[n] || document.getElementById(n)) n = id + '-' + k++; h.id = n; }
      ids[h.id] = 1;
      var a = el('a', {href: '#' + h.id}); a.textContent = h.textContent.trim().replace(/\s+/g, ' ').slice(0, 48); nav.appendChild(a);
    });
    var h1 = Array.prototype.find.call(document.querySelectorAll('h1'), sichtbar);
    var ziel = h1 ? (h1.parentElement.tagName === 'HEADER' && !h1.parentElement.hasAttribute('data-site-shell') ? h1.parentElement : h1) : null;
    // Unter Titel und Einleitungsabsatz einfügen, damit der Seitenanfang lesbar bleibt
    if (ziel && ziel.nextElementSibling && ziel.nextElementSibling.tagName === 'P') ziel = ziel.nextElementSibling;
    if (ziel) ziel.after(nav); else document.querySelector('main, body').prepend(nav);
    var oben = el('a', {'class': 'ss-oben', href: '#', 'aria-label': 'Nach oben'}, '↑');
    oben.addEventListener('click', function (e) { e.preventDefault(); scrollTo({top: 0, behavior: 'smooth'}); });
    document.body.appendChild(oben);
    addEventListener('scroll', function () { oben.toggleAttribute('data-sichtbar', scrollY > innerHeight * 1.5); }, {passive: true});
  }
  window.SiteShell = {begriffe: BEGRIFFE};
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
