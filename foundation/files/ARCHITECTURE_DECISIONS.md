# V28.1 — Architecture Decisions (before migration)

## ADR-01: Additive, indexed claim ledger

DECISION: Build a versioned SQLite foundation ledger as a derived, additive layer. Every normalized row has a pointer to its unchanged source collection, ID, row ordinal and payload hash. Browser visualizations continue to read their existing files until the ledger and a query service can be measured and adopted.

ALTERNATIVES_CONSIDERED: Rewrite all static JSON in place; replace the browser application and deploy a server database immediately.

REASON: Existing GEM, TRI and core schemas differ; destructive rewriting could erase assertions and break two globes. SQLite transactions, foreign keys and indices are useful for a reproducible local migration.

TRADEOFF: The current browser fetch path is **not** scaled or converted. SC-01 remains OPEN and a million entity performance claim is unwarranted. SQLite itself is not a production multi-user service.

IMPACT: Raw snapshots remain authoritative for legacy display, the ledger is a normalized audit/query foundation, and no candidate is silently merged.

## ADR-02: Stable namespace and identity

DECISION: Allocate opaque UUIDv4 IDs once for all migrated entities, relationships, claims and native catalogue sources. Preserve append-only `identity-registry.json` and `claim-identity-registry.json` with old IDs, physical source lineage and source-row hash guards. Every physical assertion obtains its own UUID, even if the old ID or payload repeats. Existing source IDs are aliases, not cross-collection identity proofs. No name-only candidate authorizes a merge.

ALTERNATIVES_CONSIDERED: Hash names or coordinates; reuse legacy IDs globally; merge exact normalized names.

REASON: Names, coordinates, source identifiers and row order may change. UUID identity does not derive from these attributes. The immutable snapshot ordinal distinguishes byte-identical rows only during this initial allocation. Later imports must preserve the registry; a changed source row fails closed for manual remapping instead of silently minting a new identity.

TRADEOFF: Cross-snapshot entities may remain separate. A source reorder or changed row needs an explicit registry reconciliation and test; automated incremental import is OPEN. The candidate queue is review work, not a global identity verdict.

IMPACT: All 19,557 ownership rows, including six duplicate-ID groups, remain present. The two registries are required recovery artifacts in the V28.1 package. Ledger IDs and source provenance can be reversed to the V28.0 snapshot via mappings.

## ADR-03: Unknowns and provenance

DECISION: Record explicit temporal, geolocation, material and evidence states. `UNKNOWN_PERIOD`, `UNKNOWN_ACCURACY`, `UNKNOWN_UNIT`, `LEGACY_EVIDENCE_INCOMPLETE` are valid. An asserted `EXACT` source label is kept as raw evidence and is not itself independent facility-level verification. Source publication date is never transformed into validity.

ALTERNATIVES_CONSIDERED: Infer missing years from snapshot date; mark all numeric GPS pairs exact; take company-level sources as proof for all fields.

REASON: These alternatives fabricate certainty. The ledger stores competing assertions and source references separately.

TRADEOFF: Many records remain OPEN and the research queue is large.

IMPACT: No fabricated new verified FACTs or material conversions.

## ADR-04: Rollback

DECISION: Pin V28.0 to commit and byte hashes; keep a read-only numbered ZIP snapshot. Keep the new UUID registries in the V28.1 archive. Build the ledger into a temporary file and atomically replace only the derived database after checks. Rollback restores the exact pinned V28.0 tree; recreation of the same V28.1 IDs additionally requires its registry files.

ALTERNATIVES_CONSIDERED: SQL down-migration over mutated source JSON.

REASON: V28.1 does not destructively change source JSON. A copy-based rollback is simpler and auditable.

TRADEOFF: An operator must preserve both the ZIP and manifest; a real deployment rollback must also redeploy the pinned site version.

IMPACT: An isolated rollback test compares source hashes and counts.
