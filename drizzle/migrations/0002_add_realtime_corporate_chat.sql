CREATE TABLE public.chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  kind text NOT NULL CHECK (kind IN ('direct','group')),
  image_url text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((kind = 'group' AND name IS NOT NULL AND char_length(name) BETWEEN 1 AND 120) OR kind = 'direct')
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_conversations TO authenticated;
GRANT ALL ON public.chat_conversations TO service_role;
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.chat_participants (
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_admin boolean NOT NULL DEFAULT false,
  muted boolean NOT NULL DEFAULT false,
  pinned boolean NOT NULL DEFAULT false,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_participants TO authenticated;
GRANT ALL ON public.chat_participants TO service_role;
ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL DEFAULT '' CHECK (char_length(body) <= 10000),
  reply_to_id uuid REFERENCES public.chat_messages(id) ON DELETE SET NULL,
  attachment_path text,
  attachment_name text,
  attachment_type text,
  attachment_size bigint CHECK (attachment_size IS NULL OR (attachment_size > 0 AND attachment_size <= 20000000)),
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (body <> '' OR attachment_path IS NOT NULL)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.chat_reactions (
  message_id uuid NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji text NOT NULL CHECK (emoji IN ('👍','❤️','😂','😮','😢','🙏')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id, emoji)
);
GRANT SELECT, INSERT, DELETE ON public.chat_reactions TO authenticated;
GRANT ALL ON public.chat_reactions TO service_role;
ALTER TABLE public.chat_reactions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_chat_member(_conversation_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_participants
    WHERE conversation_id = _conversation_id AND user_id = _user_id
  )
$$;
GRANT EXECUTE ON FUNCTION public.is_chat_member(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_chat_admin(_conversation_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_participants
    WHERE conversation_id = _conversation_id AND user_id = _user_id AND is_admin
  )
$$;
GRANT EXECUTE ON FUNCTION public.is_chat_admin(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.add_chat_creator()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.chat_participants (conversation_id, user_id, is_admin)
  VALUES (new.id, new.created_by, true);
  RETURN new;
END
$$;
CREATE TRIGGER chat_add_creator AFTER INSERT ON public.chat_conversations FOR EACH ROW EXECUTE FUNCTION public.add_chat_creator();
CREATE TRIGGER chat_conversations_updated BEFORE UPDATE ON public.chat_conversations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "members read chat conversations" ON public.chat_conversations FOR SELECT TO authenticated USING (public.is_chat_member(id, auth.uid()));
CREATE POLICY "users create chat conversations" ON public.chat_conversations FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "admins update chat conversations" ON public.chat_conversations FOR UPDATE TO authenticated USING (public.is_chat_admin(id, auth.uid())) WITH CHECK (public.is_chat_admin(id, auth.uid()));
CREATE POLICY "admins delete chat conversations" ON public.chat_conversations FOR DELETE TO authenticated USING (public.is_chat_admin(id, auth.uid()));

CREATE POLICY "members read chat participants" ON public.chat_participants FOR SELECT TO authenticated USING (public.is_chat_member(conversation_id, auth.uid()));
CREATE POLICY "admins add chat participants" ON public.chat_participants FOR INSERT TO authenticated WITH CHECK (public.is_chat_admin(conversation_id, auth.uid()));
CREATE POLICY "members update own chat preferences" ON public.chat_participants FOR UPDATE TO authenticated USING (user_id = auth.uid() OR public.is_chat_admin(conversation_id, auth.uid())) WITH CHECK (user_id = auth.uid() OR public.is_chat_admin(conversation_id, auth.uid()));
CREATE POLICY "admins remove chat participants" ON public.chat_participants FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.is_chat_admin(conversation_id, auth.uid()));

CREATE POLICY "members read chat messages" ON public.chat_messages FOR SELECT TO authenticated USING (public.is_chat_member(conversation_id, auth.uid()));
CREATE POLICY "members send chat messages" ON public.chat_messages FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid() AND public.is_chat_member(conversation_id, auth.uid()));
CREATE POLICY "senders edit chat messages" ON public.chat_messages FOR UPDATE TO authenticated USING (sender_id = auth.uid() AND public.is_chat_member(conversation_id, auth.uid())) WITH CHECK (sender_id = auth.uid() AND public.is_chat_member(conversation_id, auth.uid()));
CREATE POLICY "senders delete chat messages" ON public.chat_messages FOR DELETE TO authenticated USING (sender_id = auth.uid() AND public.is_chat_member(conversation_id, auth.uid()));

CREATE POLICY "members read chat reactions" ON public.chat_reactions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.chat_messages m WHERE m.id = message_id AND public.is_chat_member(m.conversation_id, auth.uid())));
CREATE POLICY "members add chat reactions" ON public.chat_reactions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.chat_messages m WHERE m.id = message_id AND public.is_chat_member(m.conversation_id, auth.uid())));
CREATE POLICY "users remove own chat reactions" ON public.chat_reactions FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE INDEX chat_participants_user_idx ON public.chat_participants (user_id, conversation_id);
CREATE INDEX chat_messages_conversation_created_idx ON public.chat_messages (conversation_id, created_at);
CREATE INDEX chat_reactions_message_idx ON public.chat_reactions (message_id);

CREATE POLICY "chat members manage chat files" ON storage.objects FOR ALL TO authenticated USING (
  bucket_id = 'chat-files' AND public.is_chat_member(((storage.foldername(name))[1])::uuid, auth.uid())
) WITH CHECK (
  bucket_id = 'chat-files' AND public.is_chat_member(((storage.foldername(name))[1])::uuid, auth.uid())
);

ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_reactions;