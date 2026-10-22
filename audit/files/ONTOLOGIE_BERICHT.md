# Atlas V28.0 — 3. Ontologie

Das Zod-Kernmodell definiert Asset-Typen und getrennte Eigentumsdatensätze. Die Rohstoffwelt bildet `MineNode`, `ProcessingNode`, `LogisticsNode`, `OperationGroupNode` in `resource-graph.mjs` aus drei Standortdateien und einem Netzwerksnapshot. GEM-Standorte sind im Quellsnapshot dagegen flach als `kind: mine/processor/terminal` modelliert. Ein „Complex Mine“ kann durch den Namen ein Komplex sein, während `kind: mine` stehen bleibt. Pit, Deposit, Exploration Project, Concentrator, Smelter, Refinery und Recycling Facility sind damit nicht global disjunkt modelliert.

`owner_or_operator` vermengt Eigentümer und Betreiber. `ultimate_parent` ist eine Quellangabe, keine automatisch belegte Kontrollquote. Die Primärkanten verwenden `processed_at`, `transport_to`, `operator`, `customer`; der Gesamtatlas verwendet etwa `customs_trade`, `supply`, `financing`, `ownership`. `customer` belegt keine konkrete Liefermenge und `customs_trade` keinen Vertrag zwischen zwei Firmen. Ein Richtungs- und Typvertrag für `OWNS`, `OPERATES`, `CONTROLS`, `SUPPLIES`, `OFFTAKE_AGREEMENT`, `ACQUIRED` usw. fehlt bestandsübergreifend. Alle 14 Primärkanten sind zwar gerichtet, aber nicht zu einer globalen Supply-Chain-Ontologie normiert.


