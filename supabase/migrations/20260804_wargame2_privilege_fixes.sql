-- ============================================================================
-- THE LEADERBOARD WAS FORGEABLE.
-- scripture_gym_stats is written by the browser (the client recalculates the
-- tally after a workout). With RLS allowing a man to write his own row, he
-- could PATCH total_memorized to 99999 and top the board without memorising
-- anything. Proven with a probe account.
--
-- FIX: the numbers are now DERIVED server-side on every write. Whatever the
-- client sends for the tally and streaks is discarded and recomputed from the
-- underlying facts — verses actually marked memorised, and days a workout was
-- actually logged. The client keeps working unchanged; it just can't lie.
-- Nickname stays client-writable: it's a display preference, not a score.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.gym_derive_stats()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE d date; prev date; cur int := 0; best int := 0; last_day date;
BEGIN
  -- Tally: count what is actually memorised.
  SELECT count(*) INTO NEW.total_memorized
    FROM public.user_verse_progress
   WHERE user_id = NEW.user_id AND status = 'memorized';

  -- Streaks: walk the distinct days a workout was logged, oldest to newest.
  prev := NULL;
  FOR d IN
    SELECT DISTINCT (created_at AT TIME ZONE 'America/New_York')::date AS day
      FROM public.workout_sessions WHERE user_id = NEW.user_id ORDER BY day
  LOOP
    IF prev IS NOT NULL AND d = prev + 1 THEN cur := cur + 1; ELSE cur := 1; END IF;
    IF cur > best THEN best := cur; END IF;
    prev := d; last_day := d;
  END LOOP;

  -- A streak only stands if he trained today or yesterday.
  IF last_day IS NULL OR last_day < ((now() AT TIME ZONE 'America/New_York')::date - 1) THEN
    NEW.current_streak := 0;
  ELSE
    NEW.current_streak := cur;
  END IF;
  NEW.longest_streak   := best;
  NEW.last_session_date := last_day;
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS scripture_gym_stats_derive ON public.scripture_gym_stats;
CREATE TRIGGER scripture_gym_stats_derive
BEFORE INSERT OR UPDATE ON public.scripture_gym_stats
FOR EACH ROW EXECUTE FUNCTION public.gym_derive_stats();

-- Recompute every existing row so nothing forged survives.
UPDATE public.scripture_gym_stats SET updated_at = now();

-- Members don't need the series config; occurrences are already visible.
DROP POLICY IF EXISTS read_series ON public.gym_recurring_series;
-- ============================================================================
-- ANY MEMBER COULD PUBLISH A SESSION AND MAIL THE WHOLE ROSTER.
-- The insert policy only checked created_by = auth.uid(); nothing constrained
-- `status`. So a signed-in member could POST a session with status='approved'
-- straight to the API, skipping the approval queue entirely — and the
-- broadcast trigger then emailed every man on the roster. Proven with a probe
-- account: 4 roster emails queued from a plain member.
--
-- FIX: the key policy now DEMOTES anything a non-key-holder tries to publish.
-- Key holders and owners are unaffected. auth.uid() IS NULL means a trusted
-- server context (the recurring-session generator, cron) — RLS already blocks
-- anonymous inserts, so that path stays open.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.gym_apply_key_policy()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE trusted boolean;
BEGIN
  trusted := (auth.uid() IS NULL)                    -- server-side / cron
             OR public.is_owner()
             OR public.is_gym_key_holder(auth.uid());

  IF NEW.status = 'pending' AND public.is_gym_key_holder(NEW.created_by) THEN
    NEW.status      := 'approved';
    NEW.approved_by := NEW.created_by;
    NEW.approved_at := now();
  END IF;

  -- Nobody without the keys gets to publish, whatever they send.
  IF NOT trusted AND NEW.status NOT IN ('draft','pending','cancelled') THEN
    NEW.status      := 'pending';
    NEW.approved_by := NULL;
    NEW.approved_at := NULL;
  END IF;

  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS gym_meetings_keys ON public.gym_meetings;
CREATE TRIGGER gym_meetings_keys
BEFORE INSERT OR UPDATE ON public.gym_meetings
FOR EACH ROW EXECUTE FUNCTION public.gym_apply_key_policy();

-- Undo the probe's damage.
DELETE FROM public.gym_notifications WHERE meeting_id IN
  (SELECT id FROM public.gym_meetings WHERE title IN ('Probe Published Session','__probe_selfapprove__'));
DELETE FROM public.gym_meetings WHERE title IN ('Probe Published Session','__probe_selfapprove__');
