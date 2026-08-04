-- ============================================================================
-- Scripture Gym: one Zoom room for every event.
-- The link lives in ONE place: scripture_gym_content.gym_join_url
-- Change it there and every meeting, page and email follows. No deploy needed.
-- ============================================================================

-- 1. The config row — the single source of truth.
UPDATE public.scripture_gym_content
   SET body = 'https://us06web.zoom.us/j/89018752634',
       title = 'Scripture Gym meeting room',
       updated_at = now()
 WHERE content_key = 'gym_join_url';

INSERT INTO public.scripture_gym_content (content_key, title, body)
SELECT 'gym_join_url', 'Scripture Gym meeting room', 'https://us06web.zoom.us/j/89018752634'
 WHERE NOT EXISTS (SELECT 1 FROM public.scripture_gym_content WHERE content_key = 'gym_join_url');

-- 2. Resolver. Falls back to the literal if the row is ever deleted.
CREATE OR REPLACE FUNCTION public.gym_default_join_url()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    NULLIF(btrim((SELECT body FROM public.scripture_gym_content WHERE content_key = 'gym_join_url')), ''),
    'https://us06web.zoom.us/j/89018752634');
$$;
GRANT EXECUTE ON FUNCTION public.gym_default_join_url() TO anon, authenticated;

-- 3. Any meeting saved without a link gets the room automatically.
--    A column DEFAULT alone is not enough: the client sends an explicit NULL,
--    which bypasses defaults. The trigger catches every path.
CREATE OR REPLACE FUNCTION public.gym_meetings_fill_join_url()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.join_url IS NULL OR btrim(NEW.join_url) = '' THEN
    NEW.join_url := public.gym_default_join_url();
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS gym_meetings_join_url ON public.gym_meetings;
CREATE TRIGGER gym_meetings_join_url
BEFORE INSERT OR UPDATE ON public.gym_meetings
FOR EACH ROW EXECUTE FUNCTION public.gym_meetings_fill_join_url();

ALTER TABLE public.gym_meetings ALTER COLUMN join_url SET DEFAULT public.gym_default_join_url();

-- 4. Backfill everything already on the books, including the three seeded
--    demo rows still pointing at a literal PLACEHOLDER link.
--    Safe: the notify + key-policy triggers are UPDATE OF status only.
UPDATE public.gym_meetings SET join_url = public.gym_default_join_url();

-- 5. Let the public join page actually hand people to the room.
--    Deliberately separate from get_shared_meeting so the share page keeps
--    its registration gate — you still capture name + email before the link.
CREATE OR REPLACE FUNCTION public.get_meeting_join_url(p_slug text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.join_url FROM public.gym_meetings m
   WHERE m.share_slug = p_slug AND m.status IN ('approved','completed')
   LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_meeting_join_url(text) TO anon, authenticated;
