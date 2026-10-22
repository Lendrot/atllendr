# Atlas V28.0 — 4. Zeitmodell

Der Kern besitzt `valid_from/valid_to` für Ownership sowie Ankündigungs- und Vollzugsdaten für Deals; Atlas-Kanten haben Berichtsperioden und Beobachtungstage. GEM-Eigentumszeilen speichern `source_row`, `status_at_source` und Snapshotquelle, jedoch keinen eigenen sicheren Gültigkeitszeitraum. Aus einem Snapshot von 2026 folgt **nicht**, dass eine Beteiligung 2026 begann oder noch gilt. **Alle 11.463 Kapazitäten** haben `period_basis` unbekannt oder nicht gesetzt. Die 108 BHP-Produktionseinträge sind dagegen mit FY-Juni und `period_start/period_end` getrennt. Die UI verweist ausdrücklich auf diese Unterscheidung.

Für V28.1 benötigt jede Behauptung mindestens `valid_from`, `valid_to` (beide bei Unkenntnis nullable), `observed_at`, `source_published_at`, `reference_period`, `phase_id`, `transaction_status` je nach Typ. Eine Ankündigung wird erst bei belegtem Vollzug zur Eigentumsänderung. Bestehende Nullwerte dürfen nicht zu offenen aktuellen Gültigkeiten umgedeutet werden.


