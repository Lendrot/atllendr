# Temporal Data Report

**Status: IMPLEMENTED for schema; MIGRATED for 108 fiscal-year production observations and 53468 TRI field quantities; other periods OPEN.** The schema stores period type, [start,end), reference year, fiscal-year label, validity dates, and explicit UNKNOWN. The BHP source marks its final FY date inclusive; migration adds one day exclusively, preserving the original date via row hash. TRI 2024 dataset quantities are represented as calendar year 2024. Source publication/snapshot date is never treated as validity. 0 invalid populated intervals.

Atlas customs edges have raw `period`, but the ledger does not yet convert every such period into typed claim intervals. Source-level historical ownership and M&A states are not exhaustively migrated. No value is automatically current.
