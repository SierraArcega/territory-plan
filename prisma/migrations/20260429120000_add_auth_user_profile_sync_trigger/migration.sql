-- Prevents and auto-recovers auth.users.id <-> user_profiles.id drift.
--
-- Drift origin: POST /api/admin/users creates "stub" user_profiles rows with
-- random UUIDs before the rep signs up. When the rep then signs up via
-- Supabase, auth.users.id is a fresh UUID that doesn't match the stub, and
-- the upsert in /api/profile 500s on the email @unique. The existing merge
-- code in /auth/callback only fires for OAuth flows (not password / non-
-- callback flows) and has incomplete FK coverage, so it failed silently for
-- the affected reps.
--
-- This trigger fires AFTER INSERT on auth.users for every signup, regardless
-- of auth method. If a stub profile exists with the same email, it's
-- atomically re-keyed: every FK column moves to the new auth id, then the
-- stub row is deleted. If no stub exists, a fresh user_profiles row is
-- created keyed to the new auth id.
--
-- The function is wrapped in EXCEPTION WHEN OTHERS so a trigger failure
-- never blocks signup; the runtime recovery in /api/profile catches anything
-- the trigger misses.

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
    UPDATE public.initiative_scores            SET user_id            = NEW.id WHERE user_id            = stub_id;
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

-- Idempotent trigger registration so this migration is safe to re-run.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();
