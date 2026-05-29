-- Bill4Shared schema

CREATE TABLE bill_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT,
  status TEXT NOT NULL DEFAULT 'collecting'
    CHECK (status IN ('collecting','confirming','assigning','done','cancelled')),
  bill_type TEXT DEFAULT 'unknown'
    CHECK (bill_type IN ('group_order','physical','typed','unknown')),
  split_mode INTEGER NOT NULL DEFAULT 2
    CHECK (split_mode IN (1,2,3)),
  food_subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  delivery_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_discount NUMERIC(10,2) NOT NULL DEFAULT 0,
  grand_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE bill_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES bill_sessions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  pre_assigned_person TEXT
);

CREATE INDEX ON bill_items (session_id);

CREATE TABLE item_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID NOT NULL REFERENCES bill_items(id) ON DELETE CASCADE,
  person_name TEXT NOT NULL,
  share_numerator INTEGER NOT NULL DEFAULT 1,
  share_denominator INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX ON item_assignments (item_id);
