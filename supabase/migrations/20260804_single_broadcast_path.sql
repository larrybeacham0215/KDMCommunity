-- ============================================================================
-- ONE BROADCAST PATH.
-- gym_enqueue_notifications and gym_broadcast_published were BOTH queueing
-- meeting_published_members, so every man received two copies of every "New
-- workout" email. (Visible in Brevo: two `requests` per address at 18:15.)
--
-- Keep the dedicated function — it honours profiles.email_opt_out — and give
-- it the test-session and suppression guards. Drop the duplicate branch from
-- the older function.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.gym_broadcast_published()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF NEW.status = 'approved' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'approved')
     AND NOT NEW.is_test                                   -- never from a test session
     AND (NEW.scheduled_at IS NULL OR NEW.scheduled_at > now()) THEN
    INSERT INTO public.gym_notifications (meeting_id, template_key, recipient_email, recipient_name, payload)
    SELECT NEW.id, 'meeting_published_members', p.email, p.full_name,
           jsonb_build_object('title', NEW.title, 'share_slug', NEW.share_slug)
      FROM public.profiles p
     WHERE p.email_opt_out = false
       AND p.email IS NOT NULL AND p.email <> ''
       AND p.id <> NEW.created_by
       AND (NEW.host_id IS NULL OR p.id <> NEW.host_id)
       AND NOT EXISTS (SELECT 1 FROM public.email_suppressions s WHERE s.email = p.email);
  END IF;
  RETURN NEW;
END $function$;

-- Remove the duplicate roster fan-out from the older function. Everything
-- else it does (submitted / approved-creator / rejected / cancelled) stays.
CREATE OR REPLACE FUNCTION public.gym_enqueue_notifications()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  creator_email text;
  creator_name  text;
  approver      record;
BEGIN
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
    -- Roster broadcast intentionally NOT here. See gym_broadcast_published.
  END IF;

  IF NEW.status = 'rejected' AND OLD.status IS DISTINCT FROM 'rejected' THEN
    INSERT INTO public.gym_notifications (meeting_id, template_key, recipient_email, recipient_name, payload)
    VALUES (NEW.id, 'meeting_rejected_creator', creator_email, creator_name,
            jsonb_build_object('title', NEW.title, 'reason', NEW.rejected_reason));
  END IF;

  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
    INSERT INTO public.gym_notifications (meeting_id, template_key, recipient_email, recipient_name, payload)
    SELECT NEW.id, 'meeting_cancelled', r.email, r.full_name, jsonb_build_object('title', NEW.title)
      FROM public.gym_meeting_registrations r WHERE r.meeting_id = NEW.id;
  END IF;

  RETURN NEW;
END $function$;

