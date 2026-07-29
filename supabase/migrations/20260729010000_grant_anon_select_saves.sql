-- Lets an unauthenticated request (e.g. the Google Apps Script keep-alive
-- ping, which only has the public anon key and no user session) issue a
-- real SELECT against this table instead of getting a permission-denied
-- error. RLS still blocks it from returning any actual row: auth.uid() is
-- null for an anon-role request, so `saves_select_own` never matches and
-- the query just returns an empty result set.
grant select on public.saves to anon;
