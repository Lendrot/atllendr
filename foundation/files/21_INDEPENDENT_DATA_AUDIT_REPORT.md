# Independent Data Auditor — Atlas V28.1

**Urteil: NEEDS_RESEARCH** (Rolle 07, unabhängige Prüfung nach der korrigierten Migration, 2026-10-01). Eine vollständige Freigabe wurde nicht erteilt.

## Eigenständig reproduzierte technische Evidence

- Das finale komprimierte SQLite-Ledger wurde separat geladen: 65.868 `source_record`, 43.233 `entity`, 19.639 `relationship`, 119.407 `claim`, 124 `source`, 11.465 `capacity`, 33.314 `coordinate`, 904 Kandidaten. SQLite-Fremdschlüsselprüfung: **0 Fehler**.
- Alle **65.868 Zeilen-Hashes** und **21 Quell-Datei-Hashes** wurden unabhängig nachgerechnet: **0 Abweichungen**.
- Die zwei persistenten UUID-Register decken 43.233 Entity-, 19.639 Relationship-, 124 Source- und 119.407 Claim-IDs ab: **0 fehlende oder abweichende Mappings**.
- Sechs alte ID-Kollisionsgruppen sind als getrennte Aussagen erhalten. Drei Ownership-Konfliktgruppen bewahren beide Rohwerte, darunter 70/30 und 51/49; sechs Claims haben `CONFLICT`.
- 11.465 Kapazitätszeilen: **8.334 NUMERIC**, **3.131 UNKNOWN_VALUE**, sämtliche `UNKNOWN_PERIOD` und `material_basis=UNKNOWN`. `FACT`-Claims ohne Evidence-Refs: **0** im korrigierten Ledger.
- Eine unabhängige erneute Migration in eine temporäre Datenbank ergab exakt denselben SHA-256-Hash `a24043ff4222256d5ecc4e17354f2b8d5f59ca489efa8a63aefe7bbfc332f44a`. Das V28.0-Snapshot-ZIP und 21 extrahierte Quelldateien stimmten mit ihren Hashes überein. Sechs gezielte Atlas-/Graph-/URL-Regression-Skripte bestanden.

## Offene Punkte und Geltungsgrenze

Vier P0 (`ON-01`, `TM-01`, `PR-01`, `SC-01`) und zwölf P1 bleiben offen. **904** Entity-Kandidaten sind klassifiziert, aber nicht fachlich entschieden. **1.495** native Claims sind erhalten, aber im neuen Ledger noch ohne Entity-/Relationship-Link. **119.407** Claims tragen `LEGACY_EVIDENCE_INCOMPLETE`. Drei Anteilsgruppen sind fachlich ungeklärt. Echte WebGL-Desktop- und Mobilinteraktionen wurden **nicht** ausgeführt.

Der Auditor fand im finalen Ledger keine weitere ungemeldete harte Integritätsabweichung. Dieses Ergebnis ist eine technische Stichprobe und Quellen-Hash-Reproduktion, keine Bestätigung jedes historischen Faktenwertes, keine Browser-Abnahme und keine Freigabe für Millionen-Entitäten-Betrieb. V28.2 wurde nicht begonnen.
