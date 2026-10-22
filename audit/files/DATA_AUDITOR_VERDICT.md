# Data Auditor (Rolle 07) — Urteil zu V28.0

**Status: NEEDS_RESEARCH.** Geprüft am 2026-09-30, nach Korrektur des Entity-Resolution- und Geolocation-Scans.

Die Stichprobe reproduziert 9.813 Standortdatensätze, 11.463 Kapazitäten ohne belastbare Periodenbasis, sechs doppelte Assertion-IDs, drei widersprüchliche Anteilsgruppen, 795 Namenskandidatengruppen und 312 Punkt-in-Polygon-Prüfkandidaten. Die Atlas-Daten-JSONs sind gegenüber V27.3 unverändert. Strukturprüfungen für Doppelansicht, Rohstoffgraph und Eigentumskonflikte bestanden.

**Offener Freigabepunkt:** Drehung, Zoom, Touch, Node-Auswahl und reale mobile Bedienbarkeit zweier gleichzeitiger 3D-Globen wurden nicht in einem WebGL-fähigen Desktop-/Smartphone-Browser bestätigt. Der private Atlas verlangt im verfügbaren Prüf-Browser eine persönliche ChatGPT-Anmeldung. Der statische Regressionstest ersetzt diese Abnahme nicht.

Daneben bleiben Originalquellen der drei Anteilsgruppen sowie Stichproben zur Koordinatengenauigkeit und Kapazitätsbasis fachlich zu prüfen. Die 312 Geotreffer sind keine bestätigten falschen Punkte. Die fünf P0 sind dokumentierte Architekturprobleme; für V28.0 wurde keine riskante Migration verlangt.

**Rolle 00:** Entscheid über `APPROVED / NEEDS_RESEARCH / CONFLICT / REJECTED` steht nach vollständiger Abnahme aus. V28.1 ist nicht gestartet.
