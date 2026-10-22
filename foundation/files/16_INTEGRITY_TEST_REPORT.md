# Integrity Test Report

**Status: PASS.** `integrity-results.json` stores per-test ID, records checked, affected count, evidence and status. Every V28.1 required hard error gate is run against the ledger and the source-row hash list. A PASS applies only to the tested ledger scope, not to unmodeled legacy collections.

| Test | Geprüft | Betroffen | Status |
| --- | ---: | ---: | --- |
| duplicate_entity_id | 43233 | 0 | PASS |
| duplicate_relationship_id | 19639 | 0 | PASS |
| null_entity_id | 43233 | 0 | PASS |
| invalid_entity_id | 43233 | 0 | PASS |
| null_relationship_id | 19639 | 0 | PASS |
| orphan_relationship_source | 19639 | 0 | PASS |
| orphan_relationship_target | 19639 | 0 | PASS |
| invalid_entity_type | 43233 | 0 | PASS |
| unclassified_relationship_without_status | 19639 | 0 | PASS |
| invalid_coordinates | 33314 | 0 | PASS |
| coordinate_without_accuracy_status | 33314 | 0 | PASS |
| invalid_temporal_interval | 139046 | 0 | PASS |
| capacity_without_time_status | 11465 | 0 | PASS |
| invalid_unit | 11465 | 0 | PASS |
| newly_verified_FACT_without_evidence | 119407 | 0 | PASS |
| FACT_without_evidence_refs | 119407 | 0 | PASS |
| capacity_value_status | 11465 | 0 | PASS |
| foreign_key_integrity | 248147 | 0 | PASS |
| source_record_payload_hashes | 65868 | 0 | PASS |
| unexplained_entity_loss | 43233 | 0 | PASS |
| unexplained_relationship_loss | 19639 | 0 | PASS |
| unexplained_source_loss | 124 | 0 | PASS |
| unexplained_claim_loss | 1495 | 0 | PASS |
| entity_mapping_completeness | 43233 | 0 | PASS |
| relationship_mapping_completeness | 19639 | 0 | PASS |
| source_mapping_completeness | 124 | 0 | PASS |
| baseline_resolution_queue | 904 | 0 | PASS |
| ownership_conflict_preservation | 3 | 0 | PASS |
