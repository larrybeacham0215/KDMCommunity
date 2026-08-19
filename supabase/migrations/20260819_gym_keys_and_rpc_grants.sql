-- ============================================================================
-- THE WARGAME2 PUBLISH FIX WAS BYPASSABLE IN ONE LINE.
--
-- 20260804_wargame2_privilege_fixes.sql closed "any member can publish a
-- session and mail the whole roster" by routing trust through
-- is_gym_key_holder(). That function reads profiles.gym_keys.
--
-- But gym_keys was never guarded. profiles' own_update policy has no
-- WITH CHECK clause, and protect_profile_privileges() only guarded id, role
-- and email. So any signed-in member could run, straight from the public
-- client with the publishable key:
--
--     update profiles set gym_keys = true where id = auth.uid();
--
-- ...and become a "key holder" — which grants gym_meetings_read_admin (every
-- meeting, including drafts and other men's notes) and makes
-- gym_apply_key_policy() auto-approve his sessions, re-opening the exact
-- roster-broadcast path wargame2 was written to close.
--
-- FIX: guard gym_keys the same way role is guarded. Owners set it; nobody
-- else can, including on their own row. gym_manager_id is guarded too — it is
-- an assignment, not a self-service preference.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.protect_profile_privileges()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'profiles.id is immutable';
  END IF;
  IF NEW.role IS DISTINCT FROM OLD.role AND NOT public.is_owner() THEN
    RAISE EXCEPTION 'Only the owner can change a role.';
  END IF;
  IF NEW.email IS DISTINCT FROM OLD.email AND NOT public.is_owner() THEN
    RAISE EXCEPTION 'Email is managed through account settings.';
  END IF;
  IF NEW.gym_keys IS DISTINCT FROM OLD.gym_keys AND NOT public.is_owner() THEN
    RAISE EXCEPTION 'Only the owner can grant gym keys.';
  END IF;
  IF NEW.gym_manager_id IS DISTINCT FROM OLD.gym_manager_id AND NOT public.is_owner() THEN
    RAISE EXCEPTION 'Only the owner can assign a gym manager.';
  END IF;
  RETURN NEW;
END $function$;

-- Trigger already exists (protect_profile_privileges_trg); CREATE OR REPLACE
-- above is enough. Recreated defensively in case it was ever dropped.
DROP TRIGGER IF EXISTS protect_profile_privileges_trg ON public.profiles;
CREATE TRIGGER protect_profile_privileges_trg
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_privileges();

-- ============================================================================
-- CRON-ONLY FUNCTIONS WERE CALLABLE BY ANYONE HOLDING THE PUBLISHABLE KEY.
--
-- These three are SECURITY DEFINER writers invoked by pg_cron. They had the
-- default PUBLIC EXECUTE grant, so anon or any member could invoke them via
-- supabase.rpc(). Confirmed unused by the client: no reference anywhere in
-- src/, app-src/ or supabase/functions/.
--
-- The sharpest one was gym_queue_weekly_reminder(p_force := true) — p_force
-- skips the Monday-9am gate, so anyone could fire the weekly reminder at any
-- hour. Its per-occurrence dedupe means it cannot loop, but it could send the
-- roster a real, mistimed email and then silently consume Monday's legitimate
-- send.
--
-- last_active(uid) is a read, but it returns an activity date for any user id
-- and nothing client-side calls it either. gym_roster() and foxhole_health()
-- call it internally; both are SECURITY DEFINER and unaffected by this revoke.
--
-- pg_cron jobs run as the job owner, not as anon/authenticated, so the
-- schedule is unaffected.
-- ============================================================================
REVOKE EXECUTE ON FUNCTION public.gym_queue_weekly_reminder(boolean)  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.gym_queue_daily_rep()               FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.gym_ensure_recurring_sessions()     FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.last_active(uuid)                   FROM PUBLIC, anon, authenticated;

-- NOT CHANGED, DELIBERATELY — flagged for Larry rather than altered blind:
--
--   * get_shared_meeting(p_slug) has no status filter, so a draft or pending
--     meeting resolves for anyone holding its 16-hex slug. Adding the filter
--     would break a creator previewing his own unpublished session through
--     the share link. Behaviour change, not a clear bug — Larry's call.
--
--   * gym_meetings_read_public grants anon SELECT on ALL columns of approved
--     meetings, including join_url and the internal `notes` field. Narrowing
--     it needs a view and a client change; doing it here would risk the
--     public share page.
--
--   * foxhole_update_link permits a full-row UPDATE by either man rather than
--     a column grant on marco_polo_link. foxhole_one_per_man blocks the
--     damaging reassignments, so this is untidy rather than exploitable.
