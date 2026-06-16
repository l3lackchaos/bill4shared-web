-- Performance indexes on the LIVE tables (items / assignments / sessions).
-- 001_initial.sql created indexes on bill_items/item_assignments, which don't
-- exist — the real tables had no indexes, so every items-by-session and
-- assignments-by-item lookup was a full scan. These match the actual query
-- patterns in loadSummary / confirm / assign / the home list.

-- items filtered by session_id (every bill detail load)
CREATE INDEX IF NOT EXISTS items_session_id_idx ON items (session_id);

-- assignments filtered by item_id (the nested assignments(*) join)
CREATE INDEX IF NOT EXISTS assignments_item_id_idx ON assignments (item_id);

-- home list orders sessions by created_at DESC
CREATE INDEX IF NOT EXISTS sessions_created_at_idx ON sessions (created_at DESC);
