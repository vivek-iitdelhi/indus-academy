-- Supabase publishes the public schema through its Data API, where the anon key (public
-- by design) would read every table. The app never uses that API: it connects directly
-- as the table owner, which RLS does not restrict. So: RLS on with no policies (the API
-- sees nothing), and no grants to the API roles, now or for tables created later.
-- Plain Postgres (local) has no anon/authenticated roles; enabling RLS there is harmless.
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
  IF (SELECT count(*) FROM pg_roles WHERE rolname IN ('anon', 'authenticated')) = 2 THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
  END IF;
END $$;
