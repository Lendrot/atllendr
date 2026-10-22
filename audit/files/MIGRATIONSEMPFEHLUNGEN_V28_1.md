# Atlas V28.0 — 10. Prioritäten und Migration V28.1

`findings.json` enthält pro Befund `ENTITY`, `ENTITY_TYPE`, `RELATIONSHIP`, `ISSUE`, `FACT_STATUS`, `CONFIDENCE`, `PRIORITY`, `EVIDENCE`, `RECOMMENDED_ACTION`. **Fünf P0** und **zehn P1** sind offen. Die ersten Migrationsschritte für V28.1:

1. Unveränderliche Assertion-ID getrennt von Entity-ID einführen; sechs Kollisionen verlustfrei remappen, alte IDs als Legacy-Verweis behalten und Vorher/Nachher-Referenzen prüfen.
2. Rohbehauptungen erhalten, Ontologievertrag für `OWNS`, `OPERATES`, `CONTROLS`, `PROCESSES_AT`, `TRANSPORTS_TO`, Handels- und M&A-Typen versionieren.
3. Feldbezogene Quellen- und Zeitclaims zuerst für Eigentum, Koordinate, Kapazität, Produktion und die 14 Primärkanten ergänzen; Unbekanntes bleibt unbekannt.
4. Materialform, Produkt, Prozessstufe, Feuchte, Einheit, Basis und FY/Kalenderjahr in getrennte Felder zerlegen. Rechenregeln blockieren inkompatible Kombinationen.
5. Entity-Resolution-Review-Queue mit Alias, Extern-ID, Legal-Entity-/Facility-/Complex-Trennung und Entscheidungshistorie. Keine automatisch fusionierten Kandidaten.
6. Referenz- und Konfliktgates vor Import; indexierte Abfragen und gekachelte Kartenpayloads an realen Desktop-/Mobil-Budgets messen, bevor große Datenmengen importiert werden.

V28.0 verändert weder Eigentumswerte noch Kapazitäten noch historische Aussagen. Der Audit belegt Migrationsbedarf; er ist **keine** Freigabe einer globalen Schema-Umstellung.


