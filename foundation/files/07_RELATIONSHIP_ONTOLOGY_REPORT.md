# Relationship Ontology Report

**Status: IMPLEMENTED; ambiguous legacy semantics OPEN.** The controlled catalogue defines the 16 requested types plus explicit legacy types. Each has a definition, allowed endpoint types, directionality, temporal behavior and evidence policy. Allowed endpoints are presently wildcard `*`, a known incomplete domain restriction. No `owner_or_operator` row is asserted as `OWNS` or `OPERATES` by guesswork; customs trade is separate from company supply.

| Kennzahl | Wert |
| --- | ---: |
| LEGACY_CUSTOMER | 1 |
| LEGACY_CUSTOMS_TRADE | 53 |
| LEGACY_FINANCING | 2 |
| LEGACY_OPERATOR | 3 |
| LEGACY_OWNERSHIP | 9 |
| LEGACY_OWNER_OR_OPERATOR | 9960 |
| LEGACY_SUPPLY | 4 |
| LEGACY_ULTIMATE_PARENT | 9597 |
| PROCESSES_AT | 4 |
| TRANSPORTS_TO | 6 |

Legacy rows require source-by-source semantic review. `unclassified_relationship_without_status = 0` means explicit classification, not that every historical relation has been fully disambiguated.
