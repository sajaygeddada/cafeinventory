-- =============================================
--  Sajay's Café — Inventory Manager
--  Supabase Schema
--  Run this in your Supabase SQL Editor
-- =============================================

-- 1. INVENTORY TABLE
CREATE TABLE IF NOT EXISTS inventory (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  category      TEXT DEFAULT 'Other',
  quantity      NUMERIC(10,2) DEFAULT 0,
  unit          TEXT DEFAULT 'pcs',
  min_stock     NUMERIC(10,2) DEFAULT 0,
  cost_per_unit NUMERIC(10,2) DEFAULT 0,
  supplier      TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 2. EXPENSES TABLE
CREATE TABLE IF NOT EXISTS expenses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date        DATE NOT NULL,
  description TEXT NOT NULL,
  category    TEXT DEFAULT 'Miscellaneous',
  amount      NUMERIC(10,2) NOT NULL,
  paid_by     TEXT DEFAULT 'Cash',
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 3. BILLS TABLE
CREATE TABLE IF NOT EXISTS bills (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type        TEXT NOT NULL,        -- 'Electricity', 'Water', 'Internet', 'Gas', 'Other'
  month_year  TEXT NOT NULL,        -- 'YYYY-MM' format
  amount      NUMERIC(10,2) NOT NULL,
  due_date    DATE,
  paid        TEXT DEFAULT 'Unpaid', -- 'Paid' or 'Unpaid'
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 4. RENT CONFIG TABLE
CREATE TABLE IF NOT EXISTS rent_config (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount    NUMERIC(10,2) NOT NULL,
  landlord  TEXT,
  due_day   INTEGER,   -- day of month (1-31)
  notes     TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────
-- ROW LEVEL SECURITY (RLS)
-- Enable RLS on all tables, allow all ops using anon key
-- (The app's own login protects access)
-- ──────────────────────────────────────────────

ALTER TABLE inventory    ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses     ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills        ENABLE ROW LEVEL SECURITY;
ALTER TABLE rent_config  ENABLE ROW LEVEL SECURITY;

-- Allow full access via anon key (app-level login is the security layer)
CREATE POLICY "Allow all for anon" ON inventory    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON expenses     FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON bills        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON rent_config  FOR ALL USING (true) WITH CHECK (true);

-- ──────────────────────────────────────────────
-- AUTO-UPDATE updated_at
-- ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_inventory_updated_at
  BEFORE UPDATE ON inventory
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
