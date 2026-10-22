# Atlas V28.0 — 5. Quellen, Provenienz und Konflikte

Das Kernmodell verlangt `source_ids`, aber die Liste darf leer sein. Claims sind feldbezogen möglich. Die additive V25-Claim-Datei umfasst **1.463 Claims** (`446 VALID` strukturell, `1.017 REVIEW`; `330 OBSERVED`, `74 CALCULATED`, `1.059 UNKNOWN`). Daneben enthält der Kern-Snapshot 32 Claims mit anderem Schema. Sie decken die neuen GEM- und TRI-Snapshots nicht als einzelne Feldclaims ab. Produktionsbeobachtungen besitzen Quelle, Locator, Referenzperiode und Materialform. GEM-Kapazitäten besitzen `source_field`, `source_row`, `source_project_id`, aber nicht die volle publizierte Feldquelle mit Datum und Locator. **1.735 Kohle-Minenkoordinaten** haben einen Quellen-ID-Verweis, jedoch keinen direkten `coordinates.source_url`; ihre Präzision ist `UNKNOWN`.

Der Ownership-Index markiert **drei Gruppen** widersprüchlicher Anteile derselben Quellenzeile als `CONFLICT`; die Werte werden nicht gemittelt. `ownership-conflicts.csv` listet die Paare. Der allgemeine Claim-Snapshot meldet derzeit keine automatischen Konflikte, was für nicht erfasste GEM-Claims keine Aussage ist. Widersprüche zwischen externen Quellen wurden hier nicht flächendeckend verglichen; Status `UNKNOWN`.


