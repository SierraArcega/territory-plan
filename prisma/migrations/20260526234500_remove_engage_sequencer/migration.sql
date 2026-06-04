-- Remove the Engage email sequencer.
--
-- The Engage sequencer was specced (2026-04-03) but never built into the app:
-- no Prisma models, no API routes, no UI. Its tables were prototyped directly
-- in Postgres. This migration drops those orphaned tables and cleans up the
-- auth user-sync trigger, which referenced them.
--
-- While here, the trigger is also rewritten to drop references to two other
-- already-dropped tables (initiative_scores, user_goals). handle_new_auth_user()
-- re-keys stub profiles inside a single block guarded by EXCEPTION WHEN OTHERS;
-- a reference to ANY non-existent table makes the whole block throw and roll
-- back, so stub re-keying has been silently failing. After this migration every
-- UPDATE in the function targets a table that exists.

-- 1. Drop the orphaned sequencer tables. CASCADE covers the intra-set FKs
--    (step_executions -> sequence_executions / sequence_steps;
--     sequence_steps / sequence_executions -> sequences). Nothing outside the
--    set references these tables.
DROP TABLE IF EXISTS public.step_executions CASCADE;
DROP TABLE IF EXISTS public.sequence_executions CASCADE;
DROP TABLE IF EXISTS public.sequence_steps CASCADE;
DROP TABLE IF EXISTS public.sequences CASCADE;

-- 2. Replace the auth user-sync trigger function. Removed re-key lines for
--    tables that no longer exist: engage_templates, sequence_executions,
--    sequences (this migration), initiative_scores and user_goals (dropped
--    earlier). The trigger binding on auth.users is unchanged.
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
    UPDATE public.map_views                    SET owner_id           = NEW.id WHERE owner_id           = stub_id;
    UPDATE public.report_drafts                SET user_id            = NEW.id WHERE user_id            = stub_id;
    UPDATE public.schools                      SET owner_id           = NEW.id WHERE owner_id           = stub_id;
    UPDATE public.states                       SET territory_owner_id = NEW.id WHERE territory_owner_id = stub_id;
    UPDATE public.tasks                        SET assigned_to_user_id = NEW.id WHERE assigned_to_user_id = stub_id;
    UPDATE public.territory_plan_collaborators SET user_id            = NEW.id WHERE user_id            = stub_id;
    UPDATE public.territory_plans              SET owner_id           = NEW.id WHERE owner_id           = stub_id;
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
