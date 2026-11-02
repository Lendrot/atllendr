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
  window.SiteShell = {begriffe: BEGRIFFE};
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
