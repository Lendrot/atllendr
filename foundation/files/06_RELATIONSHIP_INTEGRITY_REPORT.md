# Relationship Integrity Report

**Status: VERIFIED for the 19,639 migrated relationship rows.** Six legacy ID collision groups remain as raw aliases; every physical row has a unique new ID and a source-row mapping. 0 null IDs, 0 new duplicate IDs, 0 orphan source or target endpoints, 0 unexplained relationship loss. All six assertion rows in three ownership conflicts carry `CONFLICT`, and both raw values remain in their source records. Original relation types are preserved in `raw_type`.

The 1,000 `atlas-location-relations` remain source-record tracked, but are **OPEN** for typed relationship migration; they were excluded from the V28.0 counted relationship baseline.
