-- ============================================================================
-- SENDING SAFEGUARDS
-- Two ways real men get mail they shouldn't:
--   1. A test session broadcasts to the whole roster (happened today, 18:15).
--   2. We keep mailing an address that already bounced, burning the domain's
--      sending reputation with every attempt.
-- Both are closed here.
-- ============================================================================

-- --- 1. Addresses that must never be mailed again. -------------------------
CREATE TABLE IF NOT EXISTS public.email_suppressions (
  email       text PRIMARY KEY,
  reason      text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.email_suppressions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS owner_all_email_suppressions ON public.email_suppressions;
CREATE POLICY owner_all_email_suppressions ON public.email_suppressions
  FOR ALL USING (public.is_owner()) WITH CHECK (public.is_owner());

-- The address that has been bouncing since July 30.
INSERT INTO public.email_suppressions (email, reason)
VALUES ('steve@atevehopperinternational.com', 'Hard bounce: domain has no MX record (typo of stevehopperinternational.com)')
ON CONFLICT (email) DO NOTHING;

-- --- 2. Mark a session as a test so it never reaches the roster. -----------
ALTER TABLE public.gym_meetings
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

-- Anything named like a test IS a test. Belt and braces: a person running a
-- verification pass should not have to remember to tick a box.
CREATE OR REPLACE FUNCTION public.gym_flag_test_meetings()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  IF NEW.title ~ '^__' OR NEW.title ILIKE '%__test%' OR NEW.title ILIKE '%qa-test%' THEN
    NEW.is_test := true;
  END IF;
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS gym_meetings_flag_test ON public.gym_meetings;
CREATE TRIGGER gym_meetings_flag_test
BEFORE INSERT OR UPDATE ON public.gym_meetings
FOR EACH ROW EXECUTE FUNCTION public.gym_flag_test_meetings();

UPDATE public.gym_meetings SET is_test = true WHERE title ~ '^__';
