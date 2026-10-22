# Marktatlas V28.0 — Architecture & Data Foundation Audit

**Stand:** 2026-09-30. **Elternrevision:** `e07ad84cad2813ad07010ddf6b7d010936e3cca7` (V27.3). **Auditstatus:** `NEEDS_RESEARCH` nach unabhängiger Stichprobenprüfung durch Rolle 07; die Freigabe durch Rolle 00 steht aus. Dies ist eine Prüfung der vorhandenen Snapshots, Schemas, Importlogik und Oberfläche. Die Originalquellen jedes globalen GEM-Eintrags wurden nicht einzeln erneut aufgerufen. Keine Datensätze wurden in diesem Audit als `APPROVED` hochgestuft.

**Reproduktion:** `python3 scripts/audit-v28.py` erzeugt `inventory.json`, `findings.json`, `id-collisions.csv`, `ownership-conflicts.csv`, `entity-resolution-candidates.csv`, `entity-resolution-alias-candidates.csv`, `geolocation-outliers.csv` und `geolocation-country-candidates.csv`. Die CSV-Dateien sind Prüflisten, keine bestätigten Korrekturen. Prüfliste, Testbericht und `DATA_AUDITOR_VERDICT.md` liegen zusätzlich in diesem Ordner. `inventory.json` enthält SHA-256-Hashes der geprüften JSON-Snapshots.

## 1. Tatsächlicher Ist-Zustand

| Ebene | Befund | Beleg |
| --- | --- | --- |
| Kernmodell | TypeScript/Zod modelliert `Company`, `Deal`, `Ownership`, `Asset`, `Commodity`, `Source`, `Event`, `Claim`; feste Präfix-IDs und referenzielle Prüfung. | `ma-intelligence/src/domain/entities.ts`, `ids.ts`, `store/integrity.ts` |
| Weitere Datenmodelle | Statische JSON-Snapshots für Gesamtatlas, Marktdaten, Indien-Materialien, Minen, Stahlwerke, Terminals, EPA TRI, Produktionsreihen und Unternehmensgraph. Nicht alle durchlaufen dasselbe Zod-Modell. | `ma-intelligence/site/dist/assets/*.json`, `src/ingest/atlas.ts` |
| Standortbestände | 7.894 GEM-Minenprojekte, 1.293 Stahlwerke, 466 Terminals, vier manuell recherchierte Minen, 148 alte Kandidaten und acht primäre Netzwerkknoten. **9.813 Datensätze**, 9.813 eindeutige Standort-IDs in diesen Dateien. | `inventory.json` |
| Eigentumsgraph | 9.608 Unternehmensreferenzen, 19.557 Beziehungszeilen. Typen: `owner_or_operator` (9.960) und `ultimate_parent` (9.597). Die Referenzen auf Unternehmen und Assets sind auf ID-Ebene auflösbar. | `intelligence-graph.json`, `inventory.json` |
| Andere Beziehungen | 14 gerichtete Primärnetzwerk-Kanten; 68 Atlas-Kanten (`customs_trade`, `ownership`, `supply`, `financing`); 1.000 Wikidata-Ortsbezüge. Kein gemeinsamer globaler Beziehungskatalog für alle Bestände. | `primary-network.json`, `atlas-connections.json`, `atlas-location-relations.json` |
| Kennzahlen | 108 BHP-Beobachtungen mit `FY_JUNE`, Start/Ende, Materialform und Quelle; 11.463 Kapazitätszeilen in Standortobjekten. Die allgemeinen `production`-Jahresfelder der großen GEM-Snapshots sind ohne Zahlen. | `production-observations.json`, `inventory.json` |
| M&A, Handel, Geld | 10.207 Markt-Unternehmenszeilen, 58 Markt-Entity-Einträge und 31 Marktdaten-Deals; die 22 `acquisitions.json`-Deal-IDs sind darin enthalten. Das Kernmodell hat 33 Deals, wovon die 23 `deutschland-ma.json`-IDs Teilmenge sind. Markt- und Kernmodell-Deal-IDs haben keine direkte Überschneidung; semantische Dubletten bleiben ungeprüft. Dazu 68 Atlas-Kanten einschließlich Handelswerten und Finanzierung. Ein Geldwert ist nicht automatisch eine Unternehmenszahlung. | `market-data.json`, `acquisitions.json`, `deutschland-ma.json`, `intelligence-globe.json`, `atlas-connections.json` |
| Abfall und Recycling | 13.367 EPA TRI-Anlagenzeilen für 2024 mit aggregierten Mengen, zusätzlich India-Materialien und Abfall-Erkundung. Kein globales, einheitliches Recycling-Anlagenschema mit durchgehendem Input-Output. | `tri-2024-facilities.json`, `india-materials.json`, `waste-discovery.json` |
| Speicher und Schnittstellen | Git-verwaltete JSON-Dateien und Browser-Fetch, kein nachgewiesener produktiver DB-Indexdienst für diese Karten. Die Doppelsicht lädt `/atlas/` und `/minen/` in getrennten iframes mit URL-isolierten Filtern. `dist/` ist eine Kopie des kanonischen `ma-intelligence/site/dist/`. | `.openai/hosting.json`, `scripts/prepare-site.mjs`, `dual-globe.mjs`, `mines-globe.js` |
| Datenstatus | `FACT/INFERENCE/ASSUMPTION/UNKNOWN` im Kernmodell, `OBSERVED/CALCULATED/ESTIMATED/UNKNOWN` in der Claim-Schicht sowie `NEEDS_RESEARCH`, `REVIEW`, `VALID`, `CONFLICT` in verschiedenen Teilbeständen. `VALID` bedeutet nur strukturelle Gültigkeit. | `domain/vocabulary.ts`, `claim-model.mjs`, `ownership-index.mjs` |

**Skalierungsaussage:** Es gibt keine Messung mit 100.000 oder 1.000.000 Entitäten. Browserseitiges vollständiges Laden und Filtern ist als künftiges Skalierungsrisiko belegt, eine konkrete Grenze für bestimmte Hardware bleibt `UNKNOWN`. Eine Produktionsdatenbank oder Serverpagination wird im aktuellen UI-Pfad nicht genutzt.

## 2. Entity Resolution und IDs

Die Kern-IDs sind lesbar und präfixiert (`company_…`, `asset_…`, `ownership_…`), anfangs aber teilweise aus Namen erzeugt. Die Dokumentation untersagt eine spätere Neuberechnung bei Umbenennung. Im GEM-Import stehen projektbezogene IDs (`gem-…-P…`/`M…`), externe Unternehmens-IDs (`gem-company-E…`) und hashbasierte Namen (`name-…`) nebeneinander. Externe Quell-IDs sind keine allgemein gültigen Identitätsnachweise über verschiedene Tracker hinweg.

Der Unicode-taugliche Gleichnamenscan fand **16 Standortgruppen**, **263 GEM-Unternehmensgruppen**, **22 Markt-Unternehmensgruppen** und **494 TRI-Anlagen-Namensgruppen** mit jeweils verschiedenen IDs. Besonders bei TRI belegt derselbe Name im selben Bundesstaat keine identische Anlage. Bei Standorten überschreiten drei Gruppen Quellbestände (Western Cluster Bomi Hills, Western Cluster Mano River, Barapukuria). Ein zweiter Scan über Quell-Alternativnamen und einfache Rechtsformsuffixe fand **109 zusätzliche Kandidatenpaare**; er führt keine Fusionsentscheidung durch. Gleicher Name ist nur ein **INFERENCE-Kandidat**, besonders bei Komplex/Mine, Standortphase und identischer Firmenbezeichnung. `entity-resolution-candidates.csv` und `entity-resolution-alias-candidates.csv` enthalten die Prüflisten. Ehemalige und lokale Namen werden in einigen Datensätzen als `other_name` gehalten; ein systematisches Alias-/Umbenennungsregister über alle Bestände existiert nicht. Weitergehende Fuzzy-Varianten, ehemalige Firmen und Standortidentität sind **UNKNOWN – NICHT AUSREICHEND BEKANNT**.

**P0:** In `intelligence-graph.json` sind sechs Assertion-IDs doppelt (sechs zusätzliche Zeilen); fünf Gruppen haben verschiedene Nutzdaten. Darunter teilen `70 %` und `30 %` derselben Zeile dieselbe ID. Die Daten bleiben sichtbar, aber ein künftiger ID-Index könnte eine Aussage überschreiben. Keine automatische ID- oder Entity-Migration in V28.0. `id-collisions.csv` listet alle sechs Fälle.

## 3. Ontologie

Das Zod-Kernmodell definiert Asset-Typen und getrennte Eigentumsdatensätze. Die Rohstoffwelt bildet `MineNode`, `ProcessingNode`, `LogisticsNode`, `OperationGroupNode` in `resource-graph.mjs` aus drei Standortdateien und einem Netzwerksnapshot. GEM-Standorte sind im Quellsnapshot dagegen flach als `kind: mine/processor/terminal` modelliert. Ein „Complex Mine“ kann durch den Namen ein Komplex sein, während `kind: mine` stehen bleibt. Pit, Deposit, Exploration Project, Concentrator, Smelter, Refinery und Recycling Facility sind damit nicht global disjunkt modelliert.

`owner_or_operator` vermengt Eigentümer und Betreiber. `ultimate_parent` ist eine Quellangabe, keine automatisch belegte Kontrollquote. Die Primärkanten verwenden `processed_at`, `transport_to`, `operator`, `customer`; der Gesamtatlas verwendet etwa `customs_trade`, `supply`, `financing`, `ownership`. `customer` belegt keine konkrete Liefermenge und `customs_trade` keinen Vertrag zwischen zwei Firmen. Ein Richtungs- und Typvertrag für `OWNS`, `OPERATES`, `CONTROLS`, `SUPPLIES`, `OFFTAKE_AGREEMENT`, `ACQUIRED` usw. fehlt bestandsübergreifend. Alle 14 Primärkanten sind zwar gerichtet, aber nicht zu einer globalen Supply-Chain-Ontologie normiert.

## 4. Zeitmodell

Der Kern besitzt `valid_from/valid_to` für Ownership sowie Ankündigungs- und Vollzugsdaten für Deals; Atlas-Kanten haben Berichtsperioden und Beobachtungstage. GEM-Eigentumszeilen speichern `source_row`, `status_at_source` und Snapshotquelle, jedoch keinen eigenen sicheren Gültigkeitszeitraum. Aus einem Snapshot von 2026 folgt **nicht**, dass eine Beteiligung 2026 begann oder noch gilt. **Alle 11.463 Kapazitäten** haben `period_basis` unbekannt oder nicht gesetzt. Die 108 BHP-Produktionseinträge sind dagegen mit FY-Juni und `period_start/period_end` getrennt. Die UI verweist ausdrücklich auf diese Unterscheidung.

Für V28.1 benötigt jede Behauptung mindestens `valid_from`, `valid_to` (beide bei Unkenntnis nullable), `observed_at`, `source_published_at`, `reference_period`, `phase_id`, `transaction_status` je nach Typ. Eine Ankündigung wird erst bei belegtem Vollzug zur Eigentumsänderung. Bestehende Nullwerte dürfen nicht zu offenen aktuellen Gültigkeiten umgedeutet werden.

## 5. Quellen, Provenienz und Konflikte

Das Kernmodell verlangt `source_ids`, aber die Liste darf leer sein. Claims sind feldbezogen möglich. Die additive V25-Claim-Datei umfasst **1.463 Claims** (`446 VALID` strukturell, `1.017 REVIEW`; `330 OBSERVED`, `74 CALCULATED`, `1.059 UNKNOWN`). Daneben enthält der Kern-Snapshot 32 Claims mit anderem Schema. Sie decken die neuen GEM- und TRI-Snapshots nicht als einzelne Feldclaims ab. Produktionsbeobachtungen besitzen Quelle, Locator, Referenzperiode und Materialform. GEM-Kapazitäten besitzen `source_field`, `source_row`, `source_project_id`, aber nicht die volle publizierte Feldquelle mit Datum und Locator. **1.735 Kohle-Minenkoordinaten** haben einen Quellen-ID-Verweis, jedoch keinen direkten `coordinates.source_url`; ihre Präzision ist `UNKNOWN`.

Der Ownership-Index markiert **drei Gruppen** widersprüchlicher Anteile derselben Quellenzeile als `CONFLICT`; die Werte werden nicht gemittelt. `ownership-conflicts.csv` listet die Paare. Der allgemeine Claim-Snapshot meldet derzeit keine automatischen Konflikte, was für nicht erfasste GEM-Claims keine Aussage ist. Widersprüche zwischen externen Quellen wurden hier nicht flächendeckend verglichen; Status `UNKNOWN`.

## 6. Einheiten, Formen und Mengen

Kapazitäten verwenden `1000 t/Jahr` (3.796), `Mio. t/Jahr` (7.665), `1000 t/Tag` (2). 7.144 Kohle- und 980 Eisenerz-Kapazitäten tragen eine nicht aufgelöste Materialform. Bei Stahlwerken sind `BF`, `BOF`, `EAF`, `DRI`, `IF` als `material_form` gespeichert, obwohl das Verfahren/Stufe und nicht die Stoffform ist. Die UI summiert diese Phasen bewusst nicht. Eine reine Einheitenkonversion t↔kt↔Mt macht unterschiedliche Produkte, Feuchtegehalte, Erz vs. Metall oder Kapazität vs. Produktion **nicht vergleichbar**.

Die 14 Primärkanten enthalten **keine Mengen**. Eine durchgehende Materialbilanz kann deshalb nicht gerechnet werden. Ein offensichtlicher `900.000 t > 500.000 t`-Fehler wurde im Primärgraphen nicht gefunden, weil die dafür nötigen vergleichbaren Mengen fehlen. Ergebnis der Bilanzprüfung: `UNKNOWN`, nicht „kein Widerspruch“.

## 7. Geolocation

In den 9.813 Standortobjekten: `EXACT` 1.888, `APPROXIMATE` 451, `UNKNOWN` 7.377 und ohne Punkt 97. Der numerische Bereichsscan fand **0** ungültige oder (0,0)-Koordinaten. **207** Koordinatenpaare sind jeweils mehrfach belegt; Co-Location kann eine reale gemeinsame Anlage, ein Komplex oder ein generalisierter Punkt sein, kein automatischer Dublettenbeweis. Ein Punkt-in-Länder-Abgleich gegen die **vereinfachte Atlas-Weltgeometrie** prüfte alle 9.716 Standortpunkte und markiert **312 Kandidaten außerhalb des jeweiligen Polygons** in `geolocation-country-candidates.csv`. Inseln, Küsten, Grenzanlagen, Offshore-Standorte und vereinfachte Geometrie können falsche Treffer verursachen; das ist keine Bestätigung eines Koordinatenfehlers. Eine Sichtprüfung jedes `EXACT`-Labels wurde nicht durchgeführt. Die Karte bezeichnet UNKNOWN-Punkte sichtbar als ungenaue Quellenpunkte. Das Zielvokabular `EXACT_FACILITY`, `APPROXIMATE_FACILITY`, `DEPOSIT_CENTROID`, `CITY`, `REGION`, `COUNTRY`, `UNKNOWN` braucht eine nachweisbare Zuordnung pro Quelle.

## 8. Negative Evidence und Forschungshistorie

Ein leeres `processors` oder `transport` in GEM-Assets kann „nicht recherchiert“, „nicht vorhanden“ oder „nicht öffentlich belegt“ bedeuten. `UNKNOWN` trägt noch keine feldbezogene Suchhistorie. Nötig: `research_status` (`UNSEARCHED`, `SEARCHED_NO_RELIABLE_SOURCE`, `VERIFIED`, `CONFLICT`), `last_checked`, `sources_checked`, `query_scope`, `result`, plus verantwortliche Prüfinstanz. Negative Evidence darf nicht als Beweis für das Nichtbestehen einer Lieferbeziehung gelten.

## 9. Schichtentrennung und Skalierung

Die Hauptansicht erzeugt Darstellungsobjekte aus Markt-, Atlas- und Materialdaten und stellt Claims separat bereit. Die Rohstoffwelt liest Standortdateien vollständig im Browser und erzeugt einen Graphen zur Darstellung. Iframes halten Interaktionen und URL-Filter getrennt; dies ist ein gutes Isolationsmerkmal, verursacht jedoch doppelte Laufzeit und unterschiedliche Modellpfade. Die Prüfung fand keine Löschung oder Mutation der Quelldaten wegen visueller Überlagerung. Ein gemeinsamer versionierter Knowledge-Layer mit serverseitigen Indizes für ID, Typ, Zeit, Geometrie und Graphkanten ist vor 100.000+ Entitäten sinnvoll. **Keine Laufzeitgarantie für Millionen Datensätze** ist aus dem aktuellen Zustand ableitbar.

## 10. Prioritäten und Migration V28.1

`findings.json` enthält pro Befund `ENTITY`, `ENTITY_TYPE`, `RELATIONSHIP`, `ISSUE`, `FACT_STATUS`, `CONFIDENCE`, `PRIORITY`, `EVIDENCE`, `RECOMMENDED_ACTION`. **Fünf P0** und **zehn P1** sind offen. Die ersten Migrationsschritte für V28.1:

1. Unveränderliche Assertion-ID getrennt von Entity-ID einführen; sechs Kollisionen verlustfrei remappen, alte IDs als Legacy-Verweis behalten und Vorher/Nachher-Referenzen prüfen.
2. Rohbehauptungen erhalten, Ontologievertrag für `OWNS`, `OPERATES`, `CONTROLS`, `PROCESSES_AT`, `TRANSPORTS_TO`, Handels- und M&A-Typen versionieren.
3. Feldbezogene Quellen- und Zeitclaims zuerst für Eigentum, Koordinate, Kapazität, Produktion und die 14 Primärkanten ergänzen; Unbekanntes bleibt unbekannt.
4. Materialform, Produkt, Prozessstufe, Feuchte, Einheit, Basis und FY/Kalenderjahr in getrennte Felder zerlegen. Rechenregeln blockieren inkompatible Kombinationen.
5. Entity-Resolution-Review-Queue mit Alias, Extern-ID, Legal-Entity-/Facility-/Complex-Trennung und Entscheidungshistorie. Keine automatisch fusionierten Kandidaten.
6. Referenz- und Konfliktgates vor Import; indexierte Abfragen und gekachelte Kartenpayloads an realen Desktop-/Mobil-Budgets messen, bevor große Datenmengen importiert werden.

V28.0 verändert weder Eigentumswerte noch Kapazitäten noch historische Aussagen. Der Audit belegt Migrationsbedarf; er ist **keine** Freigabe einer globalen Schema-Umstellung.

## 11. Regression und Grenzen

Siehe `REGRESSION_TEST_REPORT.md`. Statische und automatisierte Prüfungen decken Datenintegrität, Navigation, Filter, URL-Isolation und Builds ab. Die tatsächliche 3D-Interaktion wird nur dann als bestätigt ausgewiesen, wenn eine WebGL-fähige Browserprüfung gelingt. Ohne diesen Nachweis bleibt sie `UNKNOWN`.

## 12. Handoff an Data Auditor (Rolle 07)

**Datensatz:** V28.0 Auditordner, `inventory.json`, `findings.json`, CSV-Prüflisten und die unveränderten V27.3-Snapshots. **Offene Fragen:** Wie müssen die sechs Assertion-ID-Kollisionen und Phasen anhand der Originalzeilen behandelt werden, und sind alle drei Prozentsatzkonflikte semantisch vergleichbar? Stichproben für Koordinaten, Kapazitätsform und Jahresbasis anhand der Originalquellen durchführen. **Priorität:** P0 für `ID-01`, `ON-01`, `TM-01`, `PR-01`, `SC-01`. **Urteil von Rolle 07:** `NEEDS_RESEARCH`; die Stichprobe und ihre Grenzen stehen in `DATA_AUDITOR_VERDICT.md`. Rolle 00 hat noch nicht `APPROVED / NEEDS_RESEARCH / CONFLICT / REJECTED` als abschließende Freigabe erteilt. Kein Start von V28.1 in diesem Auftrag.
