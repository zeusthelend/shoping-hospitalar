CREATE TABLE public.firebase_push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  platform text NOT NULL DEFAULT 'web' CHECK (platform IN ('web', 'android', 'ios')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.firebase_push_tokens TO authenticated;
GRANT ALL ON public.firebase_push_tokens TO service_role;
ALTER TABLE public.firebase_push_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own firebase tokens" ON public.firebase_push_tokens FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER firebase_push_tokens_updated BEFORE UPDATE ON public.firebase_push_tokens FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX firebase_push_tokens_user_idx ON public.firebase_push_tokens (user_id);