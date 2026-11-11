// Gemeinsamer Seitenkopf, Bereichsleiste und Klartext-Begriffe für alle Seiten (Eddie 2026-10-30, Ziel Note 1,5).
// Ersetzt nur den Seitenkopf und die sichtbare Beschriftung von Statuscodes; Daten und Evidenzstatus bleiben unverändert.
(function () {
  'use strict';
  // Neuordnung (Eddie 2026-11-10, "Ganzer Vorschlag"): fünf Menüpunkte wie im Annahmen-Atlas, dazu der Umschalter Belegt ⇄ Annahmen.
  var MENUE = [
    ['/atlas/', 'Globus', ['/atlas/', '/minen/', '/logistik/', '/verarbeitung/', '/indien/', '/karte/', '/deutschland/']],
    ['/themen/', 'Rohstoffe', ['/themen/', '/kupfer/', '/lithium/', '/gold/', '/uran/', '/seltene-erden/', '/graphit/', '/wolfram/', '/antimon/', '/abfall/', '/anlagen/', '/quellen/', '/recherche/']],
    ['/unternehmen/', 'Unternehmen', ['/unternehmen/', '/uebernahmen/', '/verbindungen/']],
    ['/analysen/', 'Analysen', ['/analysen/', '/datenluecken/']],
    ['/daten/', 'Quellen', ['/daten/', '/produktion/', '/audit/', '/foundation/', '/schnittstelle/', '/begriffe/']]
  ];
  var ANNAHMEN_ATLAS = 'https://lendrot.github.io/atlaslendrot/';
  // Bereichsleiste: der längste passende Pfad gewinnt (Rohstoffseiten zeigen ihre eigenen Seiten), sonst die Leiste des Menüpunkts.
  var UNTER = {
    '/atlas/': [['/atlas/', 'Gesamtglobus'], ['/minen/', 'Rohstoffwelt'], ['/indien/', 'Indien'], ['/deutschland/', 'Deutschland'], ['/karte/', '2D-Karte'], ['/minen/karte/', 'Minenkarte']],
    '/themen/': [['/themen/', 'Alle Rohstoffe'], ['/kupfer/', 'Kupfer'], ['/lithium/', 'Lithium'], ['/gold/', 'Gold'], ['/uran/', 'Uran'], ['/seltene-erden/', 'Seltene Erden'], ['/graphit/', 'Graphit'], ['/wolfram/', 'Wolfram'], ['/antimon/', 'Antimon'], ['/abfall/', 'Abfall']],
    '/kupfer/': [['/kupfer/', 'Kupferketten'], ['/kupfer/markt/', 'Kupfermarkt'], ['/kupfer/markt/bericht/', 'Kettenbericht'], ['/kupfer/routenbelege/', 'Routenbelege']],
    '/lithium/': [['/lithium/', 'Lithium-Standorte'], ['/lithium/markt/', 'Lithiummarkt']],
    '/gold/': [['/gold/', 'Gold-Standorte'], ['/gold/markt/', 'Goldmarkt']],
    '/uran/': [['/uran/', 'Uran-Standorte'], ['/uran/markt/', 'Uranmarkt']],
    '/seltene-erden/': [['/seltene-erden/', 'Seltenerd-Standorte'], ['/seltene-erden/markt/', 'Markt']],
    '/graphit/': [['/graphit/', 'Graphit-Standorte'], ['/graphit/markt/', 'Graphitmarkt']],
    '/wolfram/': [['/wolfram/', 'Wolfram-Standorte'], ['/wolfram/markt/', 'Wolframmarkt']],
    '/antimon/': [['/antimon/', 'Antimon-Standorte'], ['/antimon/markt/', 'Antimonmarkt']],
    '/abfall/': [['/abfall/', 'Abfallanlagen Europa'], ['/anlagen/', 'EPA-Anlagen USA'], ['/quellen/', 'Abfallquellen'], ['/recherche/', 'Stoff- und Geldströme']],
    '/unternehmen/': [['/unternehmen/', 'Übersicht'], ['/uebernahmen/', 'Übernahmen 2026'], ['/verbindungen/', 'Verbindungen zwischen Unternehmen']],
    '/analysen/': [['/analysen/', 'Übersicht'], ['/datenluecken/', 'Datenlücken']],
    '/daten/': [['/daten/', 'Daten & Quellen'], ['/produktion/', 'Produktion'], ['/audit/', 'Methodik: Prüfbericht'], ['/foundation/', 'Methodik: Datenfundament'], ['/schnittstelle/', 'Schnittstelle'], ['/begriffe/', 'Begriffe']]
  };
  // Pfade, die zu einer Rohstoff-Leiste gehören, ohne mit ihr zu beginnen
  var UNTER_ZU = {'/anlagen/': '/abfall/', '/quellen/': '/abfall/', '/recherche/': '/abfall/'};
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
  var SNAKE = /\b[A-Z][A-Z0-9]+(?:_[A-Z0-9]+)+\b/g;
  function snakeText(c) { return c.split('_').map(function (w) { return WORT[w] || w.toLowerCase(); }).join(' '); }
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
  function unterListe() {
    var b = bereich(); if (!b) return null;
    var best = null, len = -1;
    for (var k in UNTER) if (pfad.indexOf(k) === 0 && k.length > len && b[2].some(function (p) { return k.indexOf(p) === 0; })) { best = k; len = k.length; }
    for (var z in UNTER_ZU) if (pfad.indexOf(z) === 0) best = UNTER_ZU[z];
    return UNTER[best || b[0]] || null;
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
      var a = link(m[0], m[1], b === m); nav.appendChild(a);
      var ul = b === m ? unterListe() : null;
      if (ul) {
        var u = el('div', {'class': 'ss-menue-unter'});
        ul.forEach(function (x) { u.appendChild(link(x[0], x[1], x[0] === pfad)); });
        nav.appendChild(u);
      }
    });
    kopf.appendChild(nav);
    kopf.appendChild(sucheBauen());
    kopf.appendChild(el('a', {'class': 'ss-umschalter', href: ANNAHMEN_ATLAS, title: 'Zum Annahmen-Atlas wechseln'}, '<span class="an">Belegt</span><span>Annahmen</span>'));
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
  // Firmensuche im Seitenkopf (Eddie 2026-11-10: „eine direkte Suchleiste nach einer bestimmten Firma fehlt“).
  // Keine zweite Suche: sie nutzt den Suchindex der Unternehmensakte (/unternehmen/akte/daten/suche.json) und lädt ihn erst,
  // wenn jemand ins Feld tippt. Treffer öffnen die Akte; „Globus“ springt zur Firma auf dem Hauptglobus (?firma=).
  var AKTE = '/unternehmen/akte/';
  function nrm(s) { return String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim(); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]; }); }
  function sucheBauen() {
    var form = el('form', {'class': 'ss-suche', role: 'search', action: AKTE, 'data-site-shell-suche': ''});
    form.innerHTML = '<button type="button" class="ss-suche-auf" aria-label="Firma suchen" aria-expanded="false"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg></button>' +
      '<label class="ss-suche-feld"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>' +
      '<span class="ss-weg">Firma suchen</span><input type="search" name="firma" placeholder="Firma suchen, z. B. Siemens" autocomplete="off" spellcheck="false" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="ss-suche-liste"></label>' +
      '<div class="ss-suche-liste" id="ss-suche-liste" role="listbox" aria-label="Gefundene Unternehmen" hidden></div>';
    var auf = form.querySelector('.ss-suche-auf'), feld = form.querySelector('input'), liste = form.querySelector('.ss-suche-liste');
    var index = null, laedt = null, treffer = [], aktiv = -1, timer = null, gezeigt = '';
    function laden() {
      if (!laedt) laedt = fetch(AKTE + 'daten/suche.json').then(function (r) { if (!r.ok) throw Error('Suchindex'); return r.json(); })
        .then(function (d) { index = d.akten.map(function (a) { return [a, nrm(a[1])]; }); zeigen(); })
        .catch(function () { laedt = null; liste.innerHTML = '<p class="ss-suche-info">Der Suchindex konnte nicht geladen werden. <a href="' + AKTE + '">Zur Unternehmensakte</a></p>'; offen(true); });
      return laedt;
    }
    function offen(an) { liste.hidden = !an; feld.setAttribute('aria-expanded', String(an)); }
    function suchen(t) {
      var r = [];
      for (var i = 0; i < index.length; i++) { var x = index[i]; if (x[1].indexOf(t) >= 0 || (x[0][2] && x[0][2].indexOf(t) >= 0)) r.push(x); }
      // Wie die Akte: Namensanfang zuerst, dann Firmen mit mehr belegten Antworten, dann kürzere Namen
      r.sort(function (a, b) { var x = a[1].indexOf(t) === 0 ? 0 : 1, y = b[1].indexOf(t) === 0 ? 0 : 1; return x - y || b[0][4].replace(/U/g, '').length - a[0][4].replace(/U/g, '').length || a[1].length - b[1].length; });
      return r;
    }
    function zeigen() {
      var t = nrm(feld.value); aktiv = -1; feld.removeAttribute('aria-activedescendant');
      if (t.length < 2) { offen(false); liste.innerHTML = ''; treffer = []; return; }
      if (!index) { liste.innerHTML = '<p class="ss-suche-info">Suchindex wird geladen …</p>'; offen(true); laden(); return; }
      var alle = suchen(t); treffer = alle.slice(0, 8); gezeigt = t;
      liste.innerHTML = treffer.length ? treffer.map(function (x, i) {
        var a = x[0], belegt = a[4].replace(/U/g, '').length;
        return '<div class="ss-treffer" role="option" id="ss-treffer-' + i + '" aria-selected="false"><a href="' + AKTE + '#' + esc(a[0]) + '"><b>' + esc(a[1]) + '</b><small>' + esc(a[3] || 'Land unbekannt') + ' · ' + belegt + ' von 6 Fragen belegt</small></a>' +
          '<a class="ss-globus" href="/atlas/?firma=' + encodeURIComponent(a[1]) + '&amp;akte=' + esc(a[0]) + '" title="' + esc(a[1]) + ' auf dem Globus zeigen">Globus</a></div>';
      }).join('') + '<p class="ss-suche-info">' + alle.length.toLocaleString('de-DE') + ' Treffer in ' + index.length.toLocaleString('de-DE') + ' Unternehmensakten' + (alle.length > 8 ? ' · die 8 besten' : '') + '</p>'
        : '<p class="ss-suche-info">Kein Unternehmen mit diesem Namen im Atlas. Das heißt nicht, dass es die Firma nicht gibt.</p>';
      offen(true);
    }
    function markieren(i) {
      var z = liste.querySelectorAll('.ss-treffer'); if (!z.length) return;
      aktiv = (i + z.length) % z.length;
      Array.prototype.forEach.call(z, function (n, j) { n.setAttribute('aria-selected', String(j === aktiv)); });
      feld.setAttribute('aria-activedescendant', 'ss-treffer-' + aktiv); z[aktiv].scrollIntoView({block: 'nearest'});
    }
    feld.addEventListener('focus', function () { laden(); if (liste.innerHTML && nrm(feld.value).length >= 2) offen(true); });
    feld.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(zeigen, 120); });
    feld.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); markieren(aktiv + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); markieren(aktiv - 1); }
      else if (e.key === 'Escape') { offen(false); if (form.hasAttribute('data-offen')) auf.click(); }
    });
    // Enter öffnet den markierten oder den ersten Treffer
    form.addEventListener('submit', function (e) {
      e.preventDefault(); clearTimeout(timer);
      if (index && nrm(feld.value) !== gezeigt) zeigen();
      var z = treffer[aktiv < 0 ? 0 : aktiv];
      if (z) location.href = AKTE + '#' + z[0][0]; else if (!index) laden().then(function () { if (treffer[0]) location.href = AKTE + '#' + treffer[0][0][0]; });
    });
    // Handy: die Lupe öffnet das Feld unter dem Kopf
    auf.addEventListener('click', function () {
      var an = !form.hasAttribute('data-offen');
      if (an) { form.setAttribute('data-offen', ''); feld.focus(); } else { form.removeAttribute('data-offen'); offen(false); }
      auf.setAttribute('aria-expanded', String(an));
    });
    document.addEventListener('click', function (e) { if (!form.contains(e.target)) offen(false); });
    return form;
  }
  function unterBauen() {
    var b = bereich(), ul = unterListe(); if (!ul) return null;
    var nav = el('nav', {'class': 'ss-unter', 'data-site-shell': '', 'data-umschalter': '', 'aria-label': 'Seiten im Bereich ' + b[1]});
    ul.forEach(function (x) { nav.appendChild(link(x[0], x[1], x[0] === pfad)); });
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
    window.addEventListener('load', function () { einbauen(); });
  }
  // Bewegung (Eddie 2026-11-08, Grundsätze aus Lendrot/ClaudeAnimationBase): Karten blenden versetzt ein, sobald sie ins Bild
  // kommen, klickbare Karten heben sich beim Überfahren, Ladebalken beim Seitenwechsel. Nur Anzeige, keine Daten.
  // Aus bei reduzierter Bewegung, in automatisierten Tests (navigator.webdriver) und mit ?bewegung=0; ?bewegung=1 erzwingt.
  var KARTEN = '.card,.kpi,.we-kpi,.metric,.stufe,.panel,.risk-card,.entity-card,.india-card,.india-company,.finding,.mk-stage,.deal-item,.continent-hub-card';
  var HEBEN = 'a.card,button.entity-card,button.deal-item,button.india-card,a.kpi,a.panel';
  function bewegungAn() {
    var q = /[?&]bewegung=([01])/.exec(location.search);
    if (q) return q[1] === '1';
    if (navigator.webdriver) return false;
    return !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
  function bewegung() {
    var an = bewegungAn();
    var html = document.documentElement;
    // Seitenwechsel per View Transition: in Tests und bei ?bewegung=0 überspringen, damit Bildschirmfotos stabil bleiben
    ['pageswap', 'pagereveal'].forEach(function (t) {
      window.addEventListener(t, function (e) { var v = e.viewTransition; if (!v || an) return;
        // skipTransition() verwirft die Versprechen; abfangen, sonst meldet die Seite einen Fehler
        [v.ready, v.finished, v.updateCallbackDone].forEach(function (p) { if (p) p.catch(function () {}); });
        v.skipTransition(); });
    });
    if (!an) return;
    html.classList.add('ss-bewegt');
    // Ladebalken: vom Klick bis die nächste Seite steht
    document.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target.closest && e.target.closest('a[href]');
      if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
      var u = new URL(a.href, location.href);
      if (u.origin !== location.origin || (u.pathname === location.pathname && u.search === location.search)) return;
      if (/\.(json|csv|xlsx|pdf|zip|sqlite)$/i.test(u.pathname)) return;
      html.classList.add('ss-laedt');
    });
    window.addEventListener('pageshow', function () { html.classList.remove('ss-laedt'); });
    if (!('IntersectionObserver' in window)) return;
    var welle = [], welleTimer = null;
    var io = new IntersectionObserver(function (eintraege) {
      eintraege.forEach(function (x) { if (x.isIntersecting) { io.unobserve(x.target); welle.push(x.target); } });
      if (welleTimer || !welle.length) return;
      welleTimer = requestAnimationFrame(function () {
        welleTimer = null;
        var liste = welle; welle = [];
        // Lesereihenfolge: oben vor unten, links vor rechts; versetzt, nie alles gleichzeitig
        liste.sort(function (a, b) { var ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(); return (ra.top - rb.top) || (ra.left - rb.left); });
        liste.forEach(function (n, i) { n.style.setProperty('--ss-verzug', Math.min(i, 8) * 55 + 'ms'); n.classList.add('ss-da'); });
        setTimeout(function () { liste.forEach(function (n) { n.classList.remove('ss-einblenden', 'ss-da'); n.style.removeProperty('--ss-verzug'); }); }, 1300);
      });
    }, {rootMargin: '0px 0px -24px 0px'});
    function geeignet(n) {
      if (n.closest('[data-site-shell],dialog,[role=dialog]') || n.querySelector('canvas')) return false;
      var s = getComputedStyle(n);
      return s.position !== 'fixed' && s.position !== 'absolute' && s.display !== 'none';
    }
    var hoehe = window.innerHeight;
    function anmelden(wurzel, neu) {
      if (wurzel.nodeType !== 1) return;
      var liste = wurzel.matches(KARTEN) ? [wurzel] : [];
      Array.prototype.push.apply(liste, wurzel.querySelectorAll(KARTEN));
      liste.forEach(function (n) {
        if (n.hasAttribute('data-ss-gesehen')) return;
        n.setAttribute('data-ss-gesehen', '');
        if (n.matches(HEBEN)) n.classList.add('ss-hebt');
        if (!geeignet(n)) return;
        if (n.parentElement && n.parentElement.closest('.ss-einblenden')) return; // verschachtelt: die äußere Karte trägt die Bewegung
        // Schon sichtbare, bereits gezeichnete Inhalte nicht erneut verstecken (kein Flackern)
        if (!neu && n.getBoundingClientRect().top < hoehe) return;
        n.classList.add('ss-einblenden');
        io.observe(n);
      });
    }
    anmelden(document.body, false);
    new MutationObserver(function (mut) {
      mut.forEach(function (m) { Array.prototype.forEach.call(m.addedNodes, function (n) { if (n.nodeType === 1 && n.isConnected) anmelden(n, true); }); });
    }).observe(document.body, {childList: true, subtree: true});
  }
  try { bewegung(); } catch { /* Bewegung ist Zierde, darf nie die Seite stören */ }
  window.SiteShell = {begriffe: BEGRIFFE};
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
