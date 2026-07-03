-- Split the discount into its food portion so ไทยช่วยไทย only subtracts the
-- part that actually reduces food (a delivery discount must not shrink the
-- subsidy base). total_discount stays the full discount; food_discount is the
-- share of it that applies to food (0..total_discount).
--
-- Default to total_discount for existing rows: before this field, discounts were
-- treated as food discounts, so this preserves prior behaviour.
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS food_discount NUMERIC(10,2) NOT NULL DEFAULT 0;

UPDATE sessions SET food_discount = total_discount WHERE food_discount = 0 AND total_discount > 0;
