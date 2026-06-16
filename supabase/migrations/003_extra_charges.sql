-- Custom extra charges / discounts per bill (service charge, VAT, ค่าภาชนะ, …)
--
-- Stored as a JSONB array on the session. Each entry:
--   { "label": string, "amount": number, "kind": "fee" | "discount" }
-- A "fee" is split like delivery_fee, a "discount" like total_discount, both
-- following the session's split_mode. Run in the Supabase SQL editor.

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS extra_charges JSONB NOT NULL DEFAULT '[]'::jsonb;
