-- Row Level Security (RLS) Policies for Supabase
-- Run this SQL in Supabase SQL Editor after migrations are applied
--
-- Note: These policies use Supabase's auth.uid() function to get the current user's ID
-- The user_id columns in our tables store UUIDs that match Supabase auth.users.id

-- ============================================
-- Enable RLS on user-owned tables
-- ============================================

ALTER TABLE territory_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE district_edits ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Territory Plans Policies
-- Users can only see and manage their own plans
-- ============================================

-- Allow users to read their own plans
CREATE POLICY "Users can view own territory plans"
  ON territory_plans
  FOR SELECT
  USING (auth.uid() = user_id);

-- Allow users to create plans (automatically assigned to them)
CREATE POLICY "Users can create territory plans"
  ON territory_plans
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own plans
CREATE POLICY "Users can update own territory plans"
  ON territory_plans
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own plans
CREATE POLICY "Users can delete own territory plans"
  ON territory_plans
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- Territory Plan Districts (junction table)
-- Users can manage districts in their own plans
-- ============================================

ALTER TABLE territory_plan_districts ENABLE ROW LEVEL SECURITY;

-- Allow users to view districts in their plans
CREATE POLICY "Users can view own plan districts"
  ON territory_plan_districts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM territory_plans
      WHERE territory_plans.id = territory_plan_districts.plan_id
      AND territory_plans.user_id = auth.uid()
    )
  );

-- Allow users to add districts to their plans
CREATE POLICY "Users can add districts to own plans"
  ON territory_plan_districts
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM territory_plans
      WHERE territory_plans.id = territory_plan_districts.plan_id
      AND territory_plans.user_id = auth.uid()
    )
  );

-- Allow users to remove districts from their plans
CREATE POLICY "Users can remove districts from own plans"
  ON territory_plan_districts
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM territory_plans
      WHERE territory_plans.id = territory_plan_districts.plan_id
      AND territory_plans.user_id = auth.uid()
    )
  );

-- ============================================
-- District Edits Policies
-- Users can only see and manage their own edits
-- ============================================

-- Allow users to read their own edits
CREATE POLICY "Users can view own district edits"
  ON district_edits
  FOR SELECT
  USING (auth.uid() = user_id);

-- Allow users to create edits
CREATE POLICY "Users can create district edits"
  ON district_edits
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own edits
CREATE POLICY "Users can update own district edits"
  ON district_edits
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own edits
CREATE POLICY "Users can delete own district edits"
  ON district_edits
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- Read-only tables for authenticated users
-- District data, education data, etc. are shared
-- ============================================

ALTER TABLE districts ENABLE ROW LEVEL SECURITY;
ALTER TABLE fullmind_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE district_education_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE district_enrollment_demographics ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE district_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE unmatched_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_refresh_logs ENABLE ROW LEVEL SECURITY;

-- Districts: Read-only for all authenticated users
CREATE POLICY "Authenticated users can read districts"
  ON districts
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Fullmind Data: Read-only for all authenticated users
CREATE POLICY "Authenticated users can read fullmind data"
  ON fullmind_data
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Education Data: Read-only for all authenticated users
CREATE POLICY "Authenticated users can read education data"
  ON district_education_data
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Demographics: Read-only for all authenticated users
CREATE POLICY "Authenticated users can read demographics"
  ON district_enrollment_demographics
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Tags: Read-only for all authenticated users (shared tags)
CREATE POLICY "Authenticated users can read tags"
  ON tags
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- District Tags: Read-only for all authenticated users
CREATE POLICY "Authenticated users can read district tags"
  ON district_tags
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Contacts: Read-only for all authenticated users
CREATE POLICY "Authenticated users can read contacts"
  ON contacts
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Unmatched Accounts: Read-only for all authenticated users
CREATE POLICY "Authenticated users can read unmatched accounts"
  ON unmatched_accounts
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Data Refresh Logs: Read-only for all authenticated users
CREATE POLICY "Authenticated users can read data refresh logs"
  ON data_refresh_logs
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- ============================================
-- Service role bypass (for ETL and admin)
-- The service_role key bypasses RLS automatically
-- Use it only for server-side ETL operations
-- ============================================

-- Note: If you need to allow tag creation by users, add:
-- CREATE POLICY "Authenticated users can create tags"
--   ON tags
--   FOR INSERT
--   WITH CHECK (auth.role() = 'authenticated');
