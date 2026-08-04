-- ============================================================================
-- 1. WEEK-OUT REMINDER (requested)
-- 2. RESCHEDULE HANDLING (found while auditing)
--    Reminders are queued at registration with fixed send times. If a session
--    moves, those queued rows keep firing at the OLD times and nobody tells
--    the men the time changed. Both problems fixed below.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.gym_enqueue_registration_email()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE m record;
BEGIN
  SELECT title, scheduled_at, join_url INTO m FROM public.gym_meetings WHERE id = NEW.meeting_id;

  INSERT INTO public.gym_notifications (meeting_id, template_key, recipient_email, recipient_name, payload)
  VALUES (NEW.meeting_id, 'registration_confirmed', NEW.email, NEW.full_name,
          jsonb_build_object('title', m.title, 'scheduled_at', m.scheduled_at, 'join_url', m.join_url));

  IF m.scheduled_at IS NOT NULL THEN
    -- Each reminder is queued only if its moment is still ahead. A man who
    -- registers late simply gets fewer reminders, never a late one.
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

-- --------------------------------------------------------------------------
-- When a session moves: re-time every pending reminder and tell the men.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gym_handle_reschedule()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE offsets constant interval[] := ARRAY[interval '7 days', interval '24 hours', interval '1 hour'];
        keys    constant text[]     := ARRAY['reminder_7d','reminder_24h','reminder_1h'];
        i int;
BEGIN
  IF NEW.scheduled_at IS NOT DISTINCT FROM OLD.scheduled_at THEN RETURN NEW; END IF;

  -- Re-time what is still pending. Anything whose new moment has already gone
  -- by is retired rather than fired late.
  FOR i IN 1..3 LOOP
    IF NEW.scheduled_at IS NULL OR NEW.scheduled_at - offsets[i] <= now() THEN
      UPDATE public.gym_notifications
         SET status = 'skipped', error = 'Retired: session was rescheduled'
       WHERE meeting_id = NEW.id AND template_key = keys[i] AND status = 'queued';
    ELSE
      UPDATE public.gym_notifications
         SET send_after = NEW.scheduled_at - offsets[i]
       WHERE meeting_id = NEW.id AND template_key = keys[i] AND status = 'queued';
    END IF;
  END LOOP;

  -- Tell anyone already holding a seat, but only for a live session.
  IF NEW.status IN ('approved','pending') AND NEW.scheduled_at IS NOT NULL THEN
    INSERT INTO public.gym_notifications (meeting_id, template_key, recipient_email, recipient_name, payload)
    SELECT NEW.id, 'meeting_rescheduled', r.email, r.full_name,
           jsonb_build_object('title', NEW.title, 'old_time', OLD.scheduled_at, 'new_time', NEW.scheduled_at)
      FROM public.gym_meeting_registrations r WHERE r.meeting_id = NEW.id;
  END IF;

  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS gym_meetings_reschedule ON public.gym_meetings;
CREATE TRIGGER gym_meetings_reschedule
AFTER UPDATE OF scheduled_at ON public.gym_meetings
FOR EACH ROW EXECUTE FUNCTION public.gym_handle_reschedule();
