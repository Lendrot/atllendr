# Atlas V28.0 — 9. Schichtentrennung und Skalierung

Die Hauptansicht erzeugt Darstellungsobjekte aus Markt-, Atlas- und Materialdaten und stellt Claims separat bereit. Die Rohstoffwelt liest Standortdateien vollständig im Browser und erzeugt einen Graphen zur Darstellung. Iframes halten Interaktionen und URL-Filter getrennt; dies ist ein gutes Isolationsmerkmal, verursacht jedoch doppelte Laufzeit und unterschiedliche Modellpfade. Die Prüfung fand keine Löschung oder Mutation der Quelldaten wegen visueller Überlagerung. Ein gemeinsamer versionierter Knowledge-Layer mit serverseitigen Indizes für ID, Typ, Zeit, Geometrie und Graphkanten ist vor 100.000+ Entitäten sinnvoll. **Keine Laufzeitgarantie für Millionen Datensätze** ist aus dem aktuellen Zustand ableitbar.


