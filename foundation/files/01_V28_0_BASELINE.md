# V28.0 Baseline

**Status: VERIFIED for counted source collections.** Source commit `ab755857d11427df3fab353d8e22c16854bd73c8`. `baseline.json` includes audited SHA-256 per snapshot and all 15 original findings.

| Kennzahl | Wert |
| --- | ---: |
| entity_count | 43233 |
| relationship_count | 19639 |
| claim_count | 1495 |
| source_count | 124 |
| ownership_record_count | 19557 |
| production_record_count | 108 |
| capacity_record_count | 11463 |
| additional_legacy_singular_capacity_count | 2 |
| capacity_rows_without_numeric_value | 3131 |
| facility_count | 15130 |
| mine_count | 7894 |
| P0_count | 5 |
| P1_count | 10 |
| P2_count | 0 |
| P3_count | 0 |
| duplicate_entity_ids | 0 |
| duplicate_relationship_ids | 6 |
| entity_resolution_candidates | 904 |
| ownership_conflicts | 3 |
| capacity_unknown_periods | 11463 |
| coordinate_unknown_accuracy | 7377 |
| geolocation_country_candidates | 312 |
| coordinate_source_url_missing | 1735 |
| unit_issue_records | UNKNOWN |
| referential_integrity_issues_on_checked_ownership_and_production | 0 |

 The original V28 audit counted 11,463 `capacities[]` entries but missed two singular `capacity` objects in reviewed mines. NEW-01 adds these without modifying the original counter. Total migrated capacity **rows**: 11,465; 3,131 have `NULL` value (`UNKNOWN_VALUE`) and only 8,334 contain numbers. NEW-02 tracks this previously unstated distinction. Entity and source counts are collection rows, not globally resolved real-world objects. 904 candidate groups/pairs are a review queue, never a fixed merge count.
