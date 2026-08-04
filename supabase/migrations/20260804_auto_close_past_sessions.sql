-- ============================================================================
-- AUTO-CLOSE PAST SESSIONS
-- A session that has ended should stop reading as open. Nothing did this, so
-- finished sessions sat at 'approved' forever and still looked joinable.
--
-- SAFETY: no email is sent. gym_enqueue_notifications has branches for
-- pending / approved / rejected / cancelled — there is NO 'completed' branch,
-- so this status change is silent. (meeting_completed_followup exists as a
-- template but nothing enqueues it. Wire it up deliberately if you ever want
-- a recap; it will not fire by accident.)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.gym_close_past_meetings()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE n integer;
BEGIN
  -- Close only once the session has actually ENDED, not when it starts —
  -- otherwise a 90-minute workout closes on the men while they're still in it.
  WITH done AS (
    UPDATE public.gym_meetings
       SET status = 'completed'
     WHERE status = 'approved'
       AND scheduled_at IS NOT NULL
       AND scheduled_at + (coalesce(duration_minutes, 60) || ' minutes')::interval < now()
    RETURNING id
  )
  SELECT count(*) INTO n FROM done;

  -- Any reminder still queued for a finished session is dead weight.
  UPDATE public.gym_notifications
     SET status = 'skipped', error = 'Retired: session closed'
   WHERE status = 'queued'
     AND template_key LIKE 'reminder%'
     AND meeting_id IN (SELECT id FROM public.gym_meetings WHERE status = 'completed');

  RETURN n;
END $function$;

-- Run it every 15 minutes.
SELECT cron.unschedule('gym-close-past')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'gym-close-past');
SELECT cron.schedule('gym-close-past', '*/15 * * * *',
                     $CRON$SELECT public.gym_close_past_meetings();$CRON$);

-- Backfill the two that were already sitting open.
SELECT public.gym_close_past_meetings() AS closed_now;
