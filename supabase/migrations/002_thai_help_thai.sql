-- ไทยช่วยไทย (Thai-help-Thai) co-pay subsidy
--
-- Per-bill only: the user types the remaining subsidy balance for THIS bill, and
-- the state covers 60% of the bill up to 200 THB, further capped by that balance.
-- No shared wallet — nothing persists across bills.
--
-- IMPORTANT: the running app uses table `sessions` (NOT bill_sessions from
-- 001_initial.sql). Run this in the Supabase SQL editor.

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS thai_help_enabled BOOLEAN NOT NULL DEFAULT false,
  -- Remaining subsidy balance the user entered for this bill (the cap available).
  ADD COLUMN IF NOT EXISTS thai_help_balance NUMERIC(10,2) NOT NULL DEFAULT 0,
  -- Subsidy actually applied = min(60% of bill, 200, thai_help_balance).
  ADD COLUMN IF NOT EXISTS thai_help_amount  NUMERIC(10,2) NOT NULL DEFAULT 0;
