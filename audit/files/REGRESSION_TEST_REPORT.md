# Atlas V28.0 — Regressionstest

Stand: 2026-09-30. Basis: Quellrevision `e07ad84cad2813ad07010ddf6b7d010936e3cca7`. Die geprüften Datensnapshots bleiben bytegleich zu V27.3 (SHA-256 in `inventory.json`).

| Anforderung | Prüfung | Ergebnis |
| --- | --- | --- |
| Gesamtatlas lädt | Routen-/Assetprüfung, `check-atlas.mjs`, `check-unified.mjs` | PASS für Daten und Skriptlogik |
| Minenatlas lädt | `check-resource-world.mjs` | PASS: 9.809 Rohstoffwelt-Nodes, 14 gerichtete Edges |
| Side-by-Side-Gesamtansicht | `check-dual-overview.mjs` prüft Layout und iframe-Routen | PASS strukturell |
| Beide Globen unabhängig steuerbar | getrennte iframe-Fenster/URL-Parameter; `check-dual-overview.mjs`, `check-navigation.mjs` | PASS in Logik, visuelle WebGL-Abnahme offen |
| Filter | Resource-URL-Roundtrip, Gesamtansicht-URL-Isolation, vorhandene Vitest-Suite | PASS |
| Node-Auswahl | bestehende Asset-Detail-/Auswahlskripte und Source-Checks | PASS für Quelllogik; reale Zeigerinteraktion offen |
| Edges | `check-resource-world.mjs`, `check-atlas.mjs`, `check-ownership-context.mjs` | PASS für gerichtete Bezüge und drei markierte Konfliktgruppen |
| Daten bleiben erreichbar | SHA-256-Inventar und unveränderte JSON-Snapshots, Datenrouten | PASS statisch |
| Mobile Darstellung | CSS-Media-Query und iframe-Struktur per `check-dual-overview.mjs` | PASS strukturell; reale Smartphone-Ansicht und WebGL-GPU-Leistung `UNKNOWN` |
| Bestehende Einzelansichten | `check-dual-overview.mjs`, `check-resource-world.mjs`, `check-navigation.mjs` | PASS für Routen/Logik; visuelle Endabnahme offen |

`pnpm --dir ma-intelligence check`: TypeScript-Typprüfung, ESLint und **270/270 Vitest-Tests bestanden**. Zusätzlich bestanden `check-atlas`, `check-resource-world`, `check-ownership-context`, `check-dual-overview`, `check-navigation` und `check-unified`.

**Grenze:** Ein automatischer Strukturtest beweist weder einen funktionierenden WebGL-Kontext noch gute Bildrate bei zwei gleichzeitigen 3D-Szenen. Desktop- und Mobil-Interaktion müssen im WebGL-fähigen Browser überprüft werden. Ohne diese Prüfung keine Aussage „visuell bestanden“.
