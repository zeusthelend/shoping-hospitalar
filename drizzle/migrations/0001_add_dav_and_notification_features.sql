CREATE TYPE public.dav_status AS ENUM ('aberto', 'em_andamento', 'concluido', 'cancelado');

CREATE TABLE public.davs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dav_number text NOT NULL UNIQUE CHECK (dav_number ~ '^DAV:[0-9]{5,}$'),
  client_name text NOT NULL CHECK (char_length(client_name) BETWEEN 1 AND 180),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 2000),
  seller_id uuid NOT NULL,
  due_at timestamptz NOT NULL,
  status public.dav_status NOT NULL DEFAULT 'aberto',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.davs TO authenticated;
GRANT ALL ON public.davs TO service_role;
ALTER TABLE public.davs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "managers manage all davs" ON public.davs FOR ALL TO authenticated USING (public.is_manager(auth.uid())) WITH CHECK (public.is_manager(auth.uid()));
CREATE POLICY "sellers read own davs" ON public.davs FOR SELECT TO authenticated USING (seller_id = auth.uid());
CREATE POLICY "sellers create own davs" ON public.davs FOR INSERT TO authenticated WITH CHECK (seller_id = auth.uid() AND created_by = auth.uid());
CREATE POLICY "sellers update own davs" ON public.davs FOR UPDATE TO authenticated USING (seller_id = auth.uid()) WITH CHECK (seller_id = auth.uid() AND created_by = auth.uid());
CREATE TRIGGER davs_updated BEFORE UPDATE ON public.davs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.dav_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dav_id uuid NOT NULL REFERENCES public.davs(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  file_name text NOT NULL CHECK (char_length(file_name) BETWEEN 1 AND 255),
  mime_type text NOT NULL CHECK (mime_type IN ('application/pdf','image/jpeg','image/png','image/webp')),
  file_size bigint NOT NULL CHECK (file_size > 0 AND file_size <= 20000000),
  uploaded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.dav_attachments TO authenticated;
GRANT ALL ON public.dav_attachments TO service_role;
ALTER TABLE public.dav_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authorized users read dav attachments" ON public.dav_attachments FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.davs d WHERE d.id = dav_id));
CREATE POLICY "authorized users add dav attachments" ON public.dav_attachments FOR INSERT TO authenticated WITH CHECK (uploaded_by = auth.uid() AND EXISTS (SELECT 1 FROM public.davs d WHERE d.id = dav_id));
CREATE POLICY "authorized users delete dav attachments" ON public.dav_attachments FOR DELETE TO authenticated USING (uploaded_by = auth.uid() OR public.is_manager(auth.uid()));

CREATE TABLE public.notification_preferences (
  user_id uuid PRIMARY KEY,
  dav_push_enabled boolean NOT NULL DEFAULT true,
  presence_sound_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage notification preferences" ON public.notification_preferences FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER notification_preferences_updated BEFORE UPDATE ON public.notification_preferences FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own push subscriptions" ON public.push_subscriptions FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER push_subscriptions_updated BEFORE UPDATE ON public.push_subscriptions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.dav_alert_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dav_id uuid NOT NULL REFERENCES public.davs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  delivered_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dav_id, user_id)
);
GRANT SELECT ON public.dav_alert_deliveries TO authenticated;
GRANT ALL ON public.dav_alert_deliveries TO service_role;
ALTER TABLE public.dav_alert_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own dav alerts" ON public.dav_alert_deliveries FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE INDEX davs_seller_due_idx ON public.davs (seller_id, due_at);
CREATE INDEX davs_status_due_idx ON public.davs (status, due_at);
CREATE INDEX dav_attachments_dav_idx ON public.dav_attachments (dav_id);
CREATE INDEX push_subscriptions_user_idx ON public.push_subscriptions (user_id);

CREATE POLICY "authorized users manage dav files" ON storage.objects FOR ALL TO authenticated USING (
  bucket_id = 'dav-files' AND EXISTS (
    SELECT 1 FROM public.davs d WHERE d.id::text = (storage.foldername(name))[1]
  )
) WITH CHECK (
  bucket_id = 'dav-files' AND EXISTS (
    SELECT 1 FROM public.davs d WHERE d.id::text = (storage.foldername(name))[1]
  )
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'davs') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.davs;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'profiles') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;
END $$;