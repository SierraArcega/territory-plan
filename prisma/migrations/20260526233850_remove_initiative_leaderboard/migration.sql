-- Remove the legacy Initiative leaderboard (gamification point/tier system).
--
-- The live leaderboard computes everything from district_opportunity_actuals
-- and territory_plan_districts targets; it never read these tables. See
-- docs/superpowers/specs/2026-05-26-remove-initiative-leaderboard-design.md.
--
-- Step 1 MUST come before Step 2: the auth->profile sync trigger function
-- handle_new_auth_user() repoints initiative_scores.user_id in its stub-merge
-- branch. That branch is wrapped in EXCEPTION WHEN OTHERS, so dropping the
-- table without first removing the reference would make the merge fail
-- *silently* mid-way on the next signup that hits a stub profile. We re-emit
-- the function without that one line. The on_auth_user_created trigger calls
-- the function by name and does not need to be re-registered.

-- =============================================================================
-- Step 1: Re-emit handle_new_auth_user() without the initiative_scores repoint.
-- (Identical to 20260429120000_add_auth_user_profile_sync_trigger minus that line.)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
  stub_id uuid;
BEGIN
  -- Look for a stub profile keyed differently from the new auth id.
  SELECT id INTO stub_id
  FROM public.user_profiles
  WHERE email = NEW.email AND id != NEW.id;

  IF stub_id IS NOT NULL THEN
    -- Drift case: re-key the stub atomically.

    -- Park the stub email so the real one is free for the new row.
    UPDATE public.user_profiles
    SET    email = 'rekey-parking-' || id::text || '@local.invalid'
    WHERE  id = stub_id;

    -- Insert a new row keyed to the auth id, copying every other field
    -- (including admin-set fields like crm_name, role, job_title) and
    -- prefering fresh OAuth metadata where available.
    INSERT INTO public.user_profiles (
      id, email, full_name, avatar_url, job_title, role, location,
      location_lat, location_lng, phone, slack_url, booking_link, bio,
      crm_name, has_completed_setup, created_at, updated_at, last_login_at
    )
    SELECT
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name',
               NEW.raw_user_meta_data->>'name',
               full_name),
      COALESCE(NEW.raw_user_meta_data->>'avatar_url',
               NEW.raw_user_meta_data->>'picture',
               avatar_url),
      job_title, role, location,
      location_lat, location_lng, phone, slack_url, booking_link, bio,
      crm_name, has_completed_setup, created_at, NOW(), last_login_at
    FROM public.user_profiles
    WHERE id = stub_id;

    -- Repoint every FK column from the stub id to the new auth id.
    -- Order: enforced FKs first (any miss would block the DELETE below),
    -- then soft FKs (no constraint, but stale references corrupt queries).
    UPDATE public.activity_attendees           SET user_id            = NEW.id WHERE user_id            = stub_id;
    UPDATE public.districts                    SET owner_id           = NEW.id WHERE owner_id           = stub_id;
    UPDATE public.districts                    SET sales_executive_id = NEW.id WHERE sales_executive_id = stub_id;
    UPDATE public.engage_templates             SET created_by_user_id = NEW.id WHERE created_by_user_id = stub_id;
    UPDATE public.map_views                    SET owner_id           = NEW.id WHERE owner_id           = stub_id;
    UPDATE public.report_drafts                SET user_id            = NEW.id WHERE user_id            = stub_id;
    UPDATE public.schools                      SET owner_id           = NEW.id WHERE owner_id           = stub_id;
    UPDATE public.sequence_executions          SET user_id            = NEW.id WHERE user_id            = stub_id;
    UPDATE public.sequences                    SET created_by_user_id = NEW.id WHERE created_by_user_id = stub_id;
    UPDATE public.states                       SET territory_owner_id = NEW.id WHERE territory_owner_id = stub_id;
    UPDATE public.tasks                        SET assigned_to_user_id = NEW.id WHERE assigned_to_user_id = stub_id;
    UPDATE public.territory_plan_collaborators SET user_id            = NEW.id WHERE user_id            = stub_id;
    UPDATE public.territory_plans              SET owner_id           = NEW.id WHERE owner_id           = stub_id;
    UPDATE public.user_goals                   SET user_id            = NEW.id WHERE user_id            = stub_id;
    UPDATE public.user_integrations            SET user_id            = NEW.id WHERE user_id            = stub_id;
    -- Soft FKs (no constraint enforced; still need updating for consistency).
    UPDATE public.activities                   SET created_by_user_id = NEW.id WHERE created_by_user_id = stub_id;
    UPDATE public.calendar_events              SET user_id            = NEW.id WHERE user_id            = stub_id;
    UPDATE public.tasks                        SET created_by_user_id = NEW.id WHERE created_by_user_id = stub_id;
    UPDATE public.territory_plans              SET user_id            = NEW.id WHERE user_id            = stub_id;
    UPDATE public.unmatched_accounts           SET sales_executive_id = NEW.id WHERE sales_executive_id = stub_id;

    -- Now safe: stub has no remaining FK references.
    DELETE FROM public.user_profiles WHERE id = stub_id;

    RAISE NOTICE 'handle_new_auth_user: merged stub profile % into auth user % (%)',
      stub_id, NEW.id, NEW.email;

  ELSE
    -- No stub. Create a fresh profile keyed to the auth id, unless one
    -- somehow already exists at that id (defensive; a no-op in normal flows).
    IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = NEW.id) THEN
      INSERT INTO public.user_profiles (
        id, email, full_name, avatar_url, has_completed_setup
      ) VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name',
                 NEW.raw_user_meta_data->>'name'),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url',
                 NEW.raw_user_meta_data->>'picture'),
        false
      );
    END IF;
  END IF;

  RETURN NEW;

EXCEPTION
  WHEN OTHERS THEN
    -- Never block signup. Surface the failure in Postgres logs and let the
    -- runtime recovery in /api/profile pick up the slack on first request.
    RAISE WARNING 'handle_new_auth_user failed for auth.users.id % (%): %',
      NEW.id, NEW.email, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- =============================================================================
-- Step 2: Drop the Initiative leaderboard tables and the orphaned
-- metric_registry lookup. CASCADE clears the child FKs/indexes.
-- =============================================================================
DROP TABLE IF EXISTS
  public.initiative_metrics,
  public.initiative_scores,
  public.initiative_tier_thresholds,
  public.initiatives,
  public.metric_registry
CASCADE;
