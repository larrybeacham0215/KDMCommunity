-- A test session was hidden from the roster BROADCAST but still appeared in
-- every member's session list, because the public read policy only checks
-- status. Staff and the session's own creator still see it; nobody else does.
DROP POLICY IF EXISTS gym_meetings_read_public ON public.gym_meetings;
CREATE POLICY gym_meetings_read_public ON public.gym_meetings
  FOR SELECT USING (
    status = ANY (ARRAY['approved'::text, 'completed'::text])
    AND is_test = false
  );
