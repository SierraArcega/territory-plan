-- Create opportunities table
CREATE TABLE IF NOT EXISTS opportunities (
    id TEXT PRIMARY KEY,
    name TEXT,
    school_yr TEXT,
    contract_type TEXT,
    state TEXT,
    sales_rep_name TEXT,
    sales_rep_email TEXT,
    district_name TEXT,
    district_lms_id TEXT,
    district_nces_id TEXT,
    -- No FK constraint: not all opportunities match a district (unmatched opps have NULL here)
    district_lea_id TEXT,
    created_at TIMESTAMPTZ,
    close_date TIMESTAMPTZ,
    brand_ambassador TEXT,
    stage TEXT,
    net_booking_amount DECIMAL(15,2),
    contract_through TEXT,
    funding_through TEXT,
    payment_type TEXT,
    payment_terms TEXT,
    lead_source TEXT,
    invoiced DECIMAL(15,2),
    credited DECIMAL(15,2),
    completed_revenue DECIMAL(15,2),
    completed_take DECIMAL(15,2),
    scheduled_sessions INT,
    scheduled_revenue DECIMAL(15,2),
    scheduled_take DECIMAL(15,2),
    total_revenue DECIMAL(15,2),
    total_take DECIMAL(15,2),
    average_take_rate DECIMAL(5,4),
    synced_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_opps_school_yr ON opportunities (school_yr);
CREATE INDEX IF NOT EXISTS idx_opps_district_nces_id ON opportunities (district_nces_id);
CREATE INDEX IF NOT EXISTS idx_opps_district_lea_id ON opportunities (district_lea_id);
CREATE INDEX IF NOT EXISTS idx_opps_stage ON opportunities (stage);

-- Create unmatched_opportunities table
CREATE TABLE IF NOT EXISTS unmatched_opportunities (
    id TEXT PRIMARY KEY,
    name TEXT,
    stage TEXT,
    school_yr TEXT,
    account_name TEXT,
    account_lms_id TEXT,
    account_type TEXT,
    state TEXT,
    net_booking_amount DECIMAL(15,2),
    reason TEXT,
    resolved BOOLEAN DEFAULT false,
    -- No FK constraint on resolved_district_leaid: set by admin user action, validated at API layer
    resolved_district_leaid TEXT,
    synced_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_unmatched_resolved ON unmatched_opportunities (resolved);
CREATE INDEX IF NOT EXISTS idx_unmatched_school_yr ON unmatched_opportunities (school_yr);

-- RLS Policies
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE unmatched_opportunities ENABLE ROW LEVEL SECURITY;

-- Opportunities: read-only for authenticated users
CREATE POLICY "Authenticated users can read opportunities"
    ON opportunities FOR SELECT
    USING (auth.role() = 'authenticated');

-- Unmatched: read for authenticated, update resolved fields for authenticated
CREATE POLICY "Authenticated users can read unmatched opportunities"
    ON unmatched_opportunities FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can resolve unmatched opportunities"
    ON unmatched_opportunities FOR UPDATE
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');
