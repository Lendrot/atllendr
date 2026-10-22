# Atlas V28.0 — P1-Probleme

10 offene Befunde. Keine Freigabe durch den Data Auditor.

## ER-01 — Gleiche normalisierte Standortnamen über Quellbestände werden als getrennte IDs geführt.
ENTITY: ATLAS  
ENTITY_TYPE: SYSTEM  
RELATIONSHIP: UNKNOWN  
FACT_STATUS: FACT  
CONFIDENCE: 95/100  
PRIORITY: P1  
EVIDENCE: entity-resolution-candidates.csv; cross-source Beispiele Western Cluster Bomi/Mano und Barapukuria.  
RECOMMENDED_ACTION: Kandidaten manuell anhand externer IDs, Koordinaten, Betriebsphasen und Quellen prüfen; keine automatische Fusion.

## PV-01 — Claim-Abdeckung endet vor großen GEM-/TRI-Datensätzen; Herkunft ist in mehreren nebeneinander liegenden Formaten modelliert.
ENTITY: ATLAS  
ENTITY_TYPE: SYSTEM  
RELATIONSHIP: UNKNOWN  
FACT_STATUS: FACT  
CONFIDENCE: 95/100  
PRIORITY: P1  
EVIDENCE: atlas-claims.json contains 1,463 claims; mines-global.json and tri-2024-facilities.json have separate provenance fields.  
RECOMMENDED_ACTION: Claim-Ledger schrittweise feldweise erweitern, Originaldatensätze referenzieren und Referenzjahr/Quelllocator pflegen.

## PV-02 — Für einen Teil der Minenkoordinaten fehlt ein direkter Quelllink am Koordinatenfeld.
ENTITY: ATLAS  
ENTITY_TYPE: SYSTEM  
RELATIONSHIP: UNKNOWN  
FACT_STATUS: FACT  
CONFIDENCE: 95/100  
PRIORITY: P1  
EVIDENCE: inventory.json coordinates_without_source_url = 1735; mines-global.json coordinates.source_id is present, but URL absent.  
RECOMMENDED_ACTION: Koordinatenfeld an versionierte Quellzeile samt Locator binden; ohne verifizierbaren Präzisionsbeleg keinen EXACT_FACILITY-Status vergeben.

## CF-01 — Drei Gruppen gleicher Quellenzeile und Entität enthalten widersprüchliche Prozentwerte.
ENTITY: GEM ownership assertions  
ENTITY_TYPE: RELATIONSHIP  
RELATIONSHIP: owner_or_operator / ultimate_parent  
FACT_STATUS: FACT  
CONFIDENCE: 95/100  
PRIORITY: P1  
EVIDENCE: ownership-conflicts.csv; ownership-index.mjs marks these claims CONFLICT.  
RECOMMENDED_ACTION: Beide Werte erhalten; Quellenzeile und Anteilskontext fachlich klären; bis dahin kein einzelner bestätigter Anteil.

## TM-02 — Quellen-Snapshotdatum, Gültigkeit der einzelnen Eigentumsbehauptung und M&A-Vollzug sind nicht äquivalent.
ENTITY: ATLAS  
ENTITY_TYPE: SYSTEM  
RELATIONSHIP: UNKNOWN  
FACT_STATUS: FACT  
CONFIDENCE: 95/100  
PRIORITY: P1  
EVIDENCE: intelligence-graph.json status_at_source/source_row without assertion valid_from/to; atlas-connections.json has dates and M&A schemas separately.  
RECOMMENDED_ACTION: Bitemporale Zeitangaben und Ereignisstatus je Assertion einführen; Snapshotdatum als Abrufzeit, nicht Gültigkeitsbeginn behandeln.

## ID-02 — Name-hash-basierte SOURCE_NAME_ONLY Unternehmen haben keine belastbare Identitätsauflösung über Quellen hinweg.
ENTITY: ATLAS  
ENTITY_TYPE: SYSTEM  
RELATIONSHIP: UNKNOWN  
FACT_STATUS: FACT  
CONFIDENCE: 95/100  
PRIORITY: P1  
EVIDENCE: intelligence-graph.json companies.identity_status; ma-intelligence/src/domain/ids.ts companyId(); distinct GEM IDs and name IDs.  
RECOMMENDED_ACTION: Interne unveränderliche Entity-ID mit Quell-ID-Mapping, Alias und Identitätsstatus; Kandidatenprüfung vor Join.

## GE-01 — UNKNOWN-Genauigkeit ist für viele Kartenpunkte hinterlegt; Koordinate beweist keine exakte Anlageposition.
ENTITY: ATLAS  
ENTITY_TYPE: SYSTEM  
RELATIONSHIP: UNKNOWN  
FACT_STATUS: FACT  
CONFIDENCE: 95/100  
PRIORITY: P1  
EVIDENCE: inventory.json asset_coordinate_precision; mines-globe.js displays unknown precision separately.  
RECOMMENDED_ACTION: Punktpräzision normalisiert in EXACT_FACILITY/APPROXIMATE_FACILITY/DEPOSIT_CENTROID/CITY/REGION/COUNTRY/UNKNOWN; keine Genauigkeit ohne Quelle.

## NE-01 — UNKNOWN unterscheidet ungesucht und ergebnislos recherchiert nicht maschinenlesbar.
ENTITY: ATLAS  
ENTITY_TYPE: SYSTEM  
RELATIONSHIP: UNKNOWN  
FACT_STATUS: FACT  
CONFIDENCE: 95/100  
PRIORITY: P1  
EVIDENCE: mines-global.json processors/transport empty arrays; candidates.json UNKNOWN; no research_status/last_checked/sources_checked/result on assets.  
RECOMMENDED_ACTION: Feldspezifische Recherche-Historie mit Suchdatum und negativem Ergebnis anlegen.

## MA-01 — Keine überprüfbare Materialbilanz entlang der 14 primären Beziehungen, da keine Menge gespeichert ist.
ENTITY: ATLAS  
ENTITY_TYPE: SYSTEM  
RELATIONSHIP: UNKNOWN  
FACT_STATUS: FACT  
CONFIDENCE: 95/100  
PRIORITY: P1  
EVIDENCE: inventory.json primary_edges_with_quantity = 0; primary-network.json relationships.  
RECOMMENDED_ACTION: Mengen nur bei identischer Form/Periode/Basis vergleichen; bis dahin Materialbilanz UNKNOWN.

## SE-01 — Gesamtansicht lädt zwei separate iframe-Anwendungen mit unterschiedlichen Datenmodellen und eigenem Speicherbedarf.
ENTITY: ATLAS  
ENTITY_TYPE: SYSTEM  
RELATIONSHIP: UNKNOWN  
FACT_STATUS: INFERENCE  
CONFIDENCE: 85/100  
PRIORITY: P1  
EVIDENCE: dual-globe.mjs iframes /atlas/ and /minen/; atlas-ui.mjs and mines-globe.js each fetch snapshots. Gemeinsame Dateien können vom Browser gecacht werden.  
RECOMMENDED_ACTION: Gemeinsamen versionierten Datendienst und getrennte View-Modelle entwerfen; zunächst Ladezeit und Speicher auf Geräten messen.
