# Atlas V28.0 — 6. Einheiten, Formen und Mengen

Kapazitäten verwenden `1000 t/Jahr` (3.796), `Mio. t/Jahr` (7.665), `1000 t/Tag` (2). 7.144 Kohle- und 980 Eisenerz-Kapazitäten tragen eine nicht aufgelöste Materialform. Bei Stahlwerken sind `BF`, `BOF`, `EAF`, `DRI`, `IF` als `material_form` gespeichert, obwohl das Verfahren/Stufe und nicht die Stoffform ist. Die UI summiert diese Phasen bewusst nicht. Eine reine Einheitenkonversion t↔kt↔Mt macht unterschiedliche Produkte, Feuchtegehalte, Erz vs. Metall oder Kapazität vs. Produktion **nicht vergleichbar**.

Die 14 Primärkanten enthalten **keine Mengen**. Eine durchgehende Materialbilanz kann deshalb nicht gerechnet werden. Ein offensichtlicher `900.000 t > 500.000 t`-Fehler wurde im Primärgraphen nicht gefunden, weil die dafür nötigen vergleichbaren Mengen fehlen. Ergebnis der Bilanzprüfung: `UNKNOWN`, nicht „kein Widerspruch“.


