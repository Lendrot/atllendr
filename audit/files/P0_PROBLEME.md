# Atlas V28.0 — P0-Probleme

5 offene Befunde. Keine Freigabe durch den Data Auditor.

## ID-01 — Sechs ID-Kollisionen in Eigentums-/Mutterbehauptungen; fünf Gruppen enthalten verschiedene Nutzdaten.
ENTITY: ATLAS  
ENTITY_TYPE: SYSTEM  
RELATIONSHIP: UNKNOWN  
FACT_STATUS: FACT  
CONFIDENCE: 95/100  
PRIORITY: P0  
EVIDENCE: id-collisions.csv; dist/assets/intelligence-graph.json relationships; IDs are exposed in ownership detail and exports.  
RECOMMENDED_ACTION: Assertion-ID mit Quellenzeile, Phase und Aussageindex stabil unterscheiden; Original-ID als Legacy-Alias erhalten. Keine Anteilswerte zusammenführen.

## ON-01 — owner_or_operator und ultimate_parent trennen Eigentum, Betrieb und Kontrolle semantisch nicht sicher.
ENTITY: ATLAS  
ENTITY_TYPE: SYSTEM  
RELATIONSHIP: UNKNOWN  
FACT_STATUS: FACT  
CONFIDENCE: 95/100  
PRIORITY: P0  
EVIDENCE: inventory.json ownership_relation_types; dist/assets/intelligence-graph.json source_field and type.  
RECOMMENDED_ACTION: Quellenaussage als Rohclaim behalten; nach Prüfung OWNS, OPERATES, CONTROLS getrennt ableiten.

## TM-01 — Mehrheit der Kapazitäten ohne verifizierten Referenzzeitraum; Status je Phase darf nicht als heutiger Betriebszustand gelesen werden.
ENTITY: ATLAS  
ENTITY_TYPE: SYSTEM  
RELATIONSHIP: UNKNOWN  
FACT_STATUS: FACT  
CONFIDENCE: 95/100  
PRIORITY: P0  
EVIDENCE: inventory.json: 11463/11463 capacities period_basis UNKNOWN/empty; mines-global.json capacities/statuses.  
RECOMMENDED_ACTION: Kapazitäts-Claims mit explizitem valid_from/valid_to und phase_id; fehlende Zeitangaben UNKNOWN.

## PR-01 — Minenkapazitäten nennen oft die Materialform nicht aufgelöst; Stahlkapazitäten benutzen Technologietypen als material_form.
ENTITY: ATLAS  
ENTITY_TYPE: SYSTEM  
RELATIONSHIP: UNKNOWN  
FACT_STATUS: FACT  
CONFIDENCE: 95/100  
PRIORITY: P0  
EVIDENCE: inventory.json capacity_material_form_counts; plants-global.json capacities.  
RECOMMENDED_ACTION: Materialform und Prozesstechnologie getrennt typisieren; keine phasen-, produkt- oder periodübergreifende Summe.

## SC-01 — Rohstoffwelt lädt ganze Standortdateien; bei Unternehmensauswahl zusätzlich den vollständigen Eigentumsgraphen. Keine serverseitige Pagination/Indexabfrage.
ENTITY: ATLAS  
ENTITY_TYPE: SYSTEM  
RELATIONSHIP: UNKNOWN  
FACT_STATUS: INFERENCE  
CONFIDENCE: 85/100  
PRIORITY: P0  
EVIDENCE: mines-globe.js loadAll()/fetch and showCompanyNetwork(); inventory.json source_file_bytes; dual-globe.mjs loads two iframe apps.  
RECOMMENDED_ACTION: Versionierte, paginierte Datenschnittstelle und räumliche/semantische Indizes vor Hunderttausenden Knoten messen und einführen.
