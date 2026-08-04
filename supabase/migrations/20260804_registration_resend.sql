-- ============================================================================
-- A man who registers a SECOND time got nothing.
--   register_for_meeting uses ON CONFLICT (meeting_id,email) DO UPDATE, and
--   gym_reg_notify fires AFTER INSERT only. So the classic recovery move —
--   "I didn't get it, let me sign up again" — queued no email at all. He could
--   register ten times and never receive a link.
-- Now a repeat registration re-sends the confirmation, without duplicating
-- the reminders he already has, and without letting a double-click spam him.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.gym_enqueue_registration_email()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE m record; recent int;
BEGIN
  SELECT title, scheduled_at, join_url INTO m FROM public.gym_meetings WHERE id = NEW.meeting_id;

  -- Double-click / accidental resubmit guard: one confirmation per 5 minutes.
  SELECT count(*) INTO recent FROM public.gym_notifications
   WHERE meeting_id = NEW.meeting_id
     AND lower(recipient_email) = lower(NEW.email)
     AND template_key = 'registration_confirmed'
     AND created_at > now() - interval '5 minutes';

  IF recent = 0 THEN
    INSERT INTO public.gym_notifications (meeting_id, template_key, recipient_email, recipient_name, payload)
    VALUES (NEW.meeting_id, 'registration_confirmed', NEW.email, NEW.full_name,
            jsonb_build_object('title', m.title, 'scheduled_at', m.scheduled_at, 'join_url', m.join_url));
  END IF;

  -- Reminders: only on the first registration, and only when still ahead.
  IF TG_OP = 'INSERT' AND m.scheduled_at IS NOT NULL THEN
    IF m.scheduled_at - interval '7 days' > now() THEN
      INSERT INTO public.gym_notifications (meeting_id, template_key, recipient_email, recipient_name, payload, send_after)
      VALUES (NEW.meeting_id, 'reminder_7d', NEW.email, NEW.full_name,
              jsonb_build_object('title', m.title), m.scheduled_at - interval '7 days');
    END IF;
    IF m.scheduled_at - interval '24 hours' > now() THEN
      INSERT INTO public.gym_notifications (meeting_id, template_key, recipient_email, recipient_name, payload, send_after)
      VALUES (NEW.meeting_id, 'reminder_24h', NEW.email, NEW.full_name,
              jsonb_build_object('title', m.title), m.scheduled_at - interval '24 hours');
    END IF;
    IF m.scheduled_at > now() THEN
      INSERT INTO public.gym_notifications (meeting_id, template_key, recipient_email, recipient_name, payload, send_after)
      VALUES (NEW.meeting_id, 'reminder_1h', NEW.email, NEW.full_name,
              jsonb_build_object('title', m.title), m.scheduled_at - interval '1 hour');
    END IF;
  END IF;

  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS gym_reg_notify ON public.gym_meeting_registrations;
CREATE TRIGGER gym_reg_notify
AFTER INSERT OR UPDATE ON public.gym_meeting_registrations
FOR EACH ROW EXECUTE FUNCTION public.gym_enqueue_registration_email();

-- Let you resend a man his link on demand, without him doing anything.
CREATE OR REPLACE FUNCTION public.gym_resend_confirmation(p_email text, p_meeting_id uuid DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE n integer := 0;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Only staff can resend.'; END IF;
  WITH q AS (
    INSERT INTO public.gym_notifications (meeting_id, template_key, recipient_email, recipient_name, payload)
    SELECT r.meeting_id, 'registration_confirmed', r.email, r.full_name,
           jsonb_build_object('title', m.title, 'scheduled_at', m.scheduled_at, 'join_url', m.join_url)
      FROM public.gym_meeting_registrations r
      JOIN public.gym_meetings m ON m.id = r.meeting_id
     WHERE lower(r.email) = lower(btrim(p_email))
       AND (p_meeting_id IS NULL OR r.meeting_id = p_meeting_id)
       AND m.status IN ('approved','completed')
    RETURNING 1
  ) SELECT count(*) INTO n FROM q;
  RETURN n;
END $function$;
