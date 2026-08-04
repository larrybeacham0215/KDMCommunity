-- ============================================================================
-- RECURRING SESSIONS + WEEKLY REMINDER
-- Open Gym is every Wednesday 7:00 PM ET. Sessions were one-offs, so the
-- calendar emptied every time the last one passed.
--
-- DST: the time is stored as a LOCAL wall-clock time in America/New_York and
-- converted per-occurrence, so 7 PM stays 7 PM through the March/November
-- changes instead of drifting an hour.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.gym_recurring_series (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title            text NOT NULL,
  description      text,
  focus_verses     text,
  discussion_questions text,
  weekday          int  NOT NULL CHECK (weekday BETWEEN 0 AND 6),   -- 0=Sunday
  local_time       time NOT NULL,
  tz               text NOT NULL DEFAULT 'America/New_York',
  duration_minutes int  NOT NULL DEFAULT 60,
  weeks_ahead      int  NOT NULL DEFAULT 4,
  host_id          uuid REFERENCES public.profiles(id),
  host_name        text,
  created_by       uuid REFERENCES public.profiles(id),
  is_active        boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.gym_recurring_series ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS owner_all_series ON public.gym_recurring_series;
CREATE POLICY owner_all_series ON public.gym_recurring_series
  FOR ALL USING (public.is_owner()) WITH CHECK (public.is_owner());
DROP POLICY IF EXISTS read_series ON public.gym_recurring_series;
CREATE POLICY read_series ON public.gym_recurring_series FOR SELECT USING (is_active);

-- Link each generated session back to its series.
ALTER TABLE public.gym_meetings
  ADD COLUMN IF NOT EXISTS series_id uuid REFERENCES public.gym_recurring_series(id) ON DELETE SET NULL;

-- A recurring session must not fire the "New workout" blast every week —
-- that is what the weekly reminder is for. One announcement, not two.
ALTER TABLE public.gym_meetings
  ADD COLUMN IF NOT EXISTS suppress_broadcast boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS gym_meetings_series_occurrence
  ON public.gym_meetings (series_id, scheduled_at) WHERE series_id IS NOT NULL;
-- ON CONFLICT against a PARTIAL unique index must repeat the index predicate.
CREATE OR REPLACE FUNCTION public.gym_ensure_recurring_sessions()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE s record; d date; ts timestamptz; made int := 0; today_local date;
BEGIN
  FOR s IN SELECT * FROM public.gym_recurring_series WHERE is_active LOOP
    today_local := (now() AT TIME ZONE s.tz)::date;
    FOR d IN SELECT generate_series(today_local, today_local + (s.weeks_ahead * 7), '1 day')::date LOOP
      CONTINUE WHEN extract(dow FROM d)::int <> s.weekday;
      ts := (d + s.local_time) AT TIME ZONE s.tz;   -- DST-correct wall clock
      CONTINUE WHEN ts <= now();
      INSERT INTO public.gym_meetings
        (created_by, host_id, host_name, title, description, focus_verses,
         discussion_questions, status, scheduled_at, duration_minutes,
         series_id, suppress_broadcast)
      VALUES
        (s.created_by, s.host_id, s.host_name, s.title, s.description, s.focus_verses,
         s.discussion_questions, 'approved', ts, s.duration_minutes,
         s.id, true)
      ON CONFLICT (series_id, scheduled_at) WHERE series_id IS NOT NULL DO NOTHING;
      IF FOUND THEN made := made + 1; END IF;
    END LOOP;
  END LOOP;
  RETURN made;
END $function$;
-- Weekly reminder to every member about this week's Open Gym.
-- Sent Monday 9:00 AM ET. Idempotent: one per member per occurrence, ever.
CREATE OR REPLACE FUNCTION public.gym_queue_weekly_reminder(p_force boolean DEFAULT false)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE m record; n int := 0; local_now timestamp;
BEGIN
  local_now := now() AT TIME ZONE 'America/New_York';

  -- Monday, 9am hour, unless forced. Checking ET inside the function keeps
  -- this correct through DST without touching the cron schedule.
  IF NOT p_force AND NOT (extract(dow FROM local_now)::int = 1
                          AND extract(hour FROM local_now)::int = 9) THEN
    RETURN 0;
  END IF;

  -- The next occurrence within the coming week.
  SELECT * INTO m FROM public.gym_meetings
   WHERE series_id IS NOT NULL AND status = 'approved'
     AND scheduled_at > now() AND scheduled_at < now() + interval '7 days'
   ORDER BY scheduled_at LIMIT 1;
  IF NOT FOUND THEN RETURN 0; END IF;

  INSERT INTO public.gym_notifications (meeting_id, template_key, recipient_email, recipient_name, payload)
  SELECT m.id, 'weekly_open_gym', p.email, p.full_name,
         jsonb_build_object('title', m.title, 'scheduled_at', m.scheduled_at,
                            'join_url', m.join_url, 'share_slug', m.share_slug)
    FROM public.profiles p
   WHERE p.email_opt_out = false
     AND p.email IS NOT NULL AND p.email <> ''
     AND NOT EXISTS (SELECT 1 FROM public.email_suppressions s WHERE s.email = p.email)
     -- never twice for the same occurrence
     AND NOT EXISTS (SELECT 1 FROM public.gym_notifications n
                      WHERE n.meeting_id = m.id AND n.template_key = 'weekly_open_gym'
                        AND n.recipient_email = p.email);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $function$;

-- Hourly cron for both; each decides for itself whether to act.
SELECT cron.unschedule('gym-recurring') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='gym-recurring');
SELECT cron.schedule('gym-recurring', '7 * * * *', $CRON$SELECT public.gym_ensure_recurring_sessions();$CRON$);

SELECT cron.unschedule('gym-weekly-reminder') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='gym-weekly-reminder');
SELECT cron.schedule('gym-weekly-reminder', '12 * * * *', $CRON$SELECT public.gym_queue_weekly_reminder();$CRON$);
-- An auto-generated occurrence should not email its "creator" an approval
-- notice — nobody submitted it. Four a month, every month, for nothing.
CREATE OR REPLACE FUNCTION public.gym_enqueue_notifications()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE creator_email text; creator_name text; approver record;
BEGIN
  -- Sessions generated from a recurring series are silent on create/approve.
  IF NEW.series_id IS NOT NULL THEN RETURN NEW; END IF;

  SELECT email, full_name INTO creator_email, creator_name
    FROM public.profiles WHERE id = NEW.created_by;

  IF NEW.status = 'pending' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'pending') THEN
    INSERT INTO public.gym_notifications (meeting_id, template_key, recipient_email, recipient_name, payload)
    VALUES (NEW.id, 'meeting_submitted_creator', creator_email, creator_name,
            jsonb_build_object('title', NEW.title));
    FOR approver IN SELECT email, full_name FROM public.profiles WHERE role IN ('owner','admin') LOOP
      INSERT INTO public.gym_notifications (meeting_id, template_key, recipient_email, recipient_name, payload)
      VALUES (NEW.id, 'meeting_needs_approval', approver.email, approver.full_name,
              jsonb_build_object('title', NEW.title, 'submitted_by', creator_name));
    END LOOP;
  END IF;

  IF NEW.status = 'approved' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'approved') THEN
    INSERT INTO public.gym_notifications (meeting_id, template_key, recipient_email, recipient_name, payload)
    VALUES (NEW.id, 'meeting_approved_creator', creator_email, creator_name,
            jsonb_build_object('title', NEW.title, 'share_slug', NEW.share_slug));
  END IF;

  IF NEW.status = 'rejected' AND OLD.status IS DISTINCT FROM 'rejected' THEN
    INSERT INTO public.gym_notifications (meeting_id, template_key, recipient_email, recipient_name, payload)
    VALUES (NEW.id, 'meeting_rejected_creator', creator_email, creator_name,
            jsonb_build_object('title', NEW.title, 'reason', NEW.rejected_reason));
  END IF;

  -- Cancellations still notify registrants, series or not — they hold a seat.
  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
    INSERT INTO public.gym_notifications (meeting_id, template_key, recipient_email, recipient_name, payload)
    SELECT NEW.id, 'meeting_cancelled', r.email, r.full_name, jsonb_build_object('title', NEW.title)
      FROM public.gym_meeting_registrations r WHERE r.meeting_id = NEW.id;
  END IF;

  RETURN NEW;
END $function$;

-- Cancellation notices must survive the early return above.
CREATE OR REPLACE FUNCTION public.gym_notify_series_cancel()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF NEW.series_id IS NOT NULL AND NEW.status = 'cancelled'
     AND OLD.status IS DISTINCT FROM 'cancelled' THEN
    INSERT INTO public.gym_notifications (meeting_id, template_key, recipient_email, recipient_name, payload)
    SELECT NEW.id, 'meeting_cancelled', r.email, r.full_name, jsonb_build_object('title', NEW.title)
      FROM public.gym_meeting_registrations r WHERE r.meeting_id = NEW.id;
  END IF;
  RETURN NEW;
END $function$;
DROP TRIGGER IF EXISTS gym_meetings_series_cancel ON public.gym_meetings;
CREATE TRIGGER gym_meetings_series_cancel
AFTER UPDATE OF status ON public.gym_meetings
FOR EACH ROW EXECUTE FUNCTION public.gym_notify_series_cancel();

-- Retire the four already queued.
UPDATE public.gym_notifications SET status='skipped', error='Auto-generated occurrence — no approval notice needed'
 WHERE status='queued' AND template_key='meeting_approved_creator'
   AND meeting_id IN (SELECT id FROM public.gym_meetings WHERE series_id IS NOT NULL);

SELECT count(*) AS still_queued FROM public.gym_notifications WHERE status='queued';
