# Architecture Decision Report

**Status: IMPLEMENTED, with an OPEN deployment-scale limitation.** Full decision records are in `../ARCHITECTURE_DECISIONS.md` (DECISION, ALTERNATIVES_CONSIDERED, REASON, TRADEOFF, IMPACT).

The ledger is additive SQLite with source-row hashes and indices. Browser views remain on original JSON; no claim of million-record browser scalability is made. Opaque UUID identities are persisted in two registries and cross-source identity remains unresolved. Legacy semantics, raw exactness labels and all conflicting assertions remain visible.
