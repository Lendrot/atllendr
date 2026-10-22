# Migration Report

**Status: MIGRATED and row-level VERIFIED for the listed collections.** Source rows 65,868; entities 43,233; relationships 19,639; native claims 1,495; all claims including additive field assertions 119,407; catalogue sources 124; capacities 11,465; coordinates 33,314.

`migration_mapping` has 64,491 rows. No entity merges and no source-record deletion occurred. Each of the 65,868 source collection rows is identified by dataset, ordinal, legacy ID and recomputed payload hash. Exactly 43,233 entity, 19,639 relationship and 124 source mappings cover their respective baseline rows. Opaque IDs are pinned in `identity-registry.json` and `claim-identity-registry.json`. Claims grow by normalization; none of the 1,495 original claim rows is lost, but **all 1,495 native claims still have unresolved entity/relationship links** (NEW-03). `localities`, India observations, waste catalog and deal rows are byte-hash tracked source rows but not fully modeled as typed foundation entities/relationships/claims; this scope is **OPEN**, not claimed MIGRATED.

**Source files:** unchanged from V28.0. This is a derived ledger rather than an in-place rewrite. Rollback and idempotency evidence are separate reports.
