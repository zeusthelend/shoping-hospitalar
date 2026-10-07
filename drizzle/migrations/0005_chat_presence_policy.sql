CREATE OR REPLACE FUNCTION public.is_approved_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid() AND active AND approved
  )
$$;
REVOKE ALL ON FUNCTION public.is_approved_user() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_approved_user() TO authenticated;

REVOKE UPDATE ON public.chat_participants FROM authenticated;
GRANT UPDATE (muted, pinned, last_read_at) ON public.chat_participants TO authenticated;

CREATE OR REPLACE FUNCTION public.create_chat_conversation(_kind text, _name text, _members uuid[])
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
  _uid uuid := auth.uid();
  _peer uuid;
BEGIN
  IF _uid IS NULL OR NOT public.is_approved_user() THEN
    RAISE EXCEPTION 'Acesso não aprovado';
  END IF;
  IF _kind NOT IN ('direct', 'group') THEN
    RAISE EXCEPTION 'Tipo de conversa inválido';
  END IF;

  SELECT coalesce(array_agg(member_id ORDER BY member_id), '{}'::uuid[])
  INTO _members
  FROM (
    SELECT DISTINCT requested.member_id
    FROM unnest(coalesce(_members, '{}'::uuid[])) AS requested(member_id)
    JOIN public.profiles p ON p.id = requested.member_id
    WHERE requested.member_id <> _uid AND p.active AND p.approved
  ) members;

  IF cardinality(_members) = 0 THEN
    RAISE EXCEPTION 'Selecione pelo menos uma pessoa aprovada';
  END IF;

  IF _kind = 'direct' THEN
    IF cardinality(_members) <> 1 THEN
      RAISE EXCEPTION 'Conversa individual exige uma pessoa';
    END IF;
    _peer := _members[1];
    SELECT c.id INTO _id
    FROM public.chat_conversations c
    WHERE c.kind = 'direct'
      AND EXISTS (
        SELECT 1 FROM public.chat_participants a
        WHERE a.conversation_id = c.id AND a.user_id = _uid
      )
      AND EXISTS (
        SELECT 1 FROM public.chat_participants b
        WHERE b.conversation_id = c.id AND b.user_id = _peer
      )
    LIMIT 1;
    IF _id IS NOT NULL THEN
      RETURN _id;
    END IF;
  ELSIF coalesce(length(trim(_name)), 0) = 0 THEN
    RAISE EXCEPTION 'Informe o nome do grupo';
  END IF;

  INSERT INTO public.chat_conversations (kind, name, created_by)
  VALUES (_kind, CASE WHEN _kind = 'group' THEN left(trim(_name), 120) END, _uid)
  RETURNING id INTO _id;

  INSERT INTO public.chat_participants (conversation_id, user_id)
  SELECT _id, member_id FROM unnest(_members) AS members(member_id)
  ON CONFLICT DO NOTHING;

  RETURN _id;
END
$$;
REVOKE ALL ON FUNCTION public.create_chat_conversation(text, text, uuid[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_chat_conversation(text, text, uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_access_pin(_label text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _pin text;
  _bytes bytea;
  _number numeric;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem emitir PINs';
  END IF;

  LOOP
    _bytes := extensions.gen_random_bytes(5);
    _number :=
      get_byte(_bytes, 0)::numeric * 4294967296
      + get_byte(_bytes, 1)::numeric * 16777216
      + get_byte(_bytes, 2)::numeric * 65536
      + get_byte(_bytes, 3)::numeric * 256
      + get_byte(_bytes, 4)::numeric;
    _pin := lpad(mod(_number, 100000000)::bigint::text, 8, '0');
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.access_pins
      WHERE pin_hash = encode(extensions.digest(_pin, 'sha256'), 'hex')
    );
  END LOOP;

  INSERT INTO public.access_pins (pin_hash, label, created_by)
  VALUES (encode(extensions.digest(_pin, 'sha256'), 'hex'), left(_label, 120), auth.uid());
  RETURN _pin;
END
$$;
REVOKE ALL ON FUNCTION public.create_access_pin(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_access_pin(text) TO authenticated;
REVOKE SELECT ON public.access_pins FROM authenticated;
GRANT SELECT (id, label, created_by, expires_at, used_by, used_at, created_at)
  ON public.access_pins TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    NEW.position_id := OLD.position_id;
    NEW.department_id := OLD.department_id;
    NEW.active := OLD.active;
    NEW.email := OLD.email;
    IF current_setting('shopping_hospitalar.pin_approval_user', true)
       IS DISTINCT FROM auth.uid()::text THEN
      NEW.approved := OLD.approved;
    END IF;
  END IF;
  RETURN NEW;
END
$$;

CREATE TABLE public.access_pin_attempts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  window_started_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.access_pin_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.access_pin_attempts FROM public, anon, authenticated;
GRANT ALL ON public.access_pin_attempts TO service_role;

CREATE OR REPLACE FUNCTION public.redeem_access_pin(_pin text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _row uuid;
  _attempts integer;
  _window_started_at timestamptz;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND active AND NOT approved
  ) THEN
    RETURN false;
  END IF;

  INSERT INTO public.access_pin_attempts (user_id)
  VALUES (auth.uid())
  ON CONFLICT (user_id) DO NOTHING;

  SELECT attempts, window_started_at
  INTO _attempts, _window_started_at
  FROM public.access_pin_attempts
  WHERE user_id = auth.uid()
  FOR UPDATE;

  IF _window_started_at < now() - interval '15 minutes' THEN
    UPDATE public.access_pin_attempts
    SET attempts = 0, window_started_at = now()
    WHERE user_id = auth.uid();
    _attempts := 0;
  END IF;

  IF _attempts >= 20 THEN
    RETURN false;
  END IF;

  UPDATE public.access_pins
  SET used_by = auth.uid(), used_at = now()
  WHERE id = (
    SELECT id
    FROM public.access_pins
    WHERE pin_hash = encode(extensions.digest(trim(_pin), 'sha256'), 'hex')
      AND used_by IS NULL
      AND expires_at > now()
    LIMIT 1
    FOR UPDATE
  )
  RETURNING id INTO _row;

  IF _row IS NULL THEN
    UPDATE public.access_pin_attempts
    SET attempts = attempts + 1
    WHERE user_id = auth.uid();
    RETURN false;
  END IF;

  DELETE FROM public.access_pin_attempts WHERE user_id = auth.uid();
  PERFORM set_config('shopping_hospitalar.pin_approval_user', auth.uid()::text, true);
  UPDATE public.profiles SET approved = true WHERE id = auth.uid();
  PERFORM set_config('shopping_hospitalar.pin_approval_user', '', true);
  RETURN true;
END
$$;
REVOKE ALL ON FUNCTION public.redeem_access_pin(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.redeem_access_pin(text) TO authenticated;

DROP POLICY IF EXISTS "users create chat conversations" ON public.chat_conversations;
CREATE POLICY "approved users create chat conversations"
  ON public.chat_conversations FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND public.is_approved_user());

DROP POLICY IF EXISTS "members read chat conversations" ON public.chat_conversations;
CREATE POLICY "approved members read chat conversations"
  ON public.chat_conversations FOR SELECT TO authenticated
  USING (public.is_approved_user() AND public.is_chat_member(id, auth.uid()));

DROP POLICY IF EXISTS "members read chat participants" ON public.chat_participants;
CREATE POLICY "approved members read chat participants"
  ON public.chat_participants FOR SELECT TO authenticated
  USING (public.is_approved_user() AND public.is_chat_member(conversation_id, auth.uid()));

DROP POLICY IF EXISTS "admins add chat participants" ON public.chat_participants;
CREATE POLICY "approved admins add chat participants"
  ON public.chat_participants FOR INSERT TO authenticated
  WITH CHECK (
    public.is_approved_user()
    AND public.is_chat_admin(conversation_id, auth.uid())
  );

DROP POLICY IF EXISTS "members update own chat preferences" ON public.chat_participants;
CREATE POLICY "approved members update chat preferences"
  ON public.chat_participants FOR UPDATE TO authenticated
  USING (
    public.is_approved_user()
    AND (user_id = auth.uid() OR public.is_chat_admin(conversation_id, auth.uid()))
  )
  WITH CHECK (
    public.is_approved_user()
    AND (user_id = auth.uid() OR public.is_chat_admin(conversation_id, auth.uid()))
  );

DROP POLICY IF EXISTS "admins remove chat participants" ON public.chat_participants;
CREATE POLICY "approved members remove chat participants"
  ON public.chat_participants FOR DELETE TO authenticated
  USING (
    public.is_approved_user()
    AND (user_id = auth.uid() OR public.is_chat_admin(conversation_id, auth.uid()))
  );

DROP POLICY IF EXISTS "admins update chat conversations" ON public.chat_conversations;
CREATE POLICY "approved admins update chat conversations"
  ON public.chat_conversations FOR UPDATE TO authenticated
  USING (public.is_approved_user() AND public.is_chat_admin(id, auth.uid()))
  WITH CHECK (public.is_approved_user() AND public.is_chat_admin(id, auth.uid()));

DROP POLICY IF EXISTS "admins delete chat conversations" ON public.chat_conversations;
CREATE POLICY "approved admins delete chat conversations"
  ON public.chat_conversations FOR DELETE TO authenticated
  USING (public.is_approved_user() AND public.is_chat_admin(id, auth.uid()));

DROP POLICY IF EXISTS "members read chat messages" ON public.chat_messages;
CREATE POLICY "approved members read chat messages"
  ON public.chat_messages FOR SELECT TO authenticated
  USING (public.is_approved_user() AND public.is_chat_member(conversation_id, auth.uid()));

DROP POLICY IF EXISTS "members send chat messages" ON public.chat_messages;
CREATE POLICY "approved members send chat messages"
  ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.is_approved_user()
    AND public.is_chat_member(conversation_id, auth.uid())
  );

DROP POLICY IF EXISTS "senders edit chat messages" ON public.chat_messages;
CREATE POLICY "approved senders edit chat messages"
  ON public.chat_messages FOR UPDATE TO authenticated
  USING (
    sender_id = auth.uid()
    AND public.is_approved_user()
    AND public.is_chat_member(conversation_id, auth.uid())
  )
  WITH CHECK (
    sender_id = auth.uid()
    AND public.is_approved_user()
    AND public.is_chat_member(conversation_id, auth.uid())
  );

DROP POLICY IF EXISTS "senders delete chat messages" ON public.chat_messages;
CREATE POLICY "approved senders delete chat messages"
  ON public.chat_messages FOR DELETE TO authenticated
  USING (
    sender_id = auth.uid()
    AND public.is_approved_user()
    AND public.is_chat_member(conversation_id, auth.uid())
  );

DROP POLICY IF EXISTS "members read chat reactions" ON public.chat_reactions;
CREATE POLICY "approved members read chat reactions"
  ON public.chat_reactions FOR SELECT TO authenticated
  USING (
    public.is_approved_user()
    AND EXISTS (
      SELECT 1 FROM public.chat_messages m
      WHERE m.id = message_id AND public.is_chat_member(m.conversation_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "members add chat reactions" ON public.chat_reactions;
CREATE POLICY "approved members add chat reactions"
  ON public.chat_reactions FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.is_approved_user()
    AND EXISTS (
      SELECT 1 FROM public.chat_messages m
      WHERE m.id = message_id AND public.is_chat_member(m.conversation_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "users remove own chat reactions" ON public.chat_reactions;
CREATE POLICY "approved users remove own chat reactions"
  ON public.chat_reactions FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND public.is_approved_user());

DROP POLICY IF EXISTS "chat members manage chat files" ON storage.objects;
CREATE POLICY "approved chat members manage chat files"
  ON storage.objects FOR ALL TO authenticated
  USING (
    bucket_id = 'chat-files'
    AND public.is_approved_user()
    AND public.is_chat_member(((storage.foldername(name))[1])::uuid, auth.uid())
  )
  WITH CHECK (
    bucket_id = 'chat-files'
    AND public.is_approved_user()
    AND public.is_chat_member(((storage.foldername(name))[1])::uuid, auth.uid())
  );

CREATE OR REPLACE FUNCTION public.can_delete_davs(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id = auth.uid() AND (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'gerente')
    )
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.positions po ON po.id = p.position_id
      WHERE p.id = auth.uid() AND po.name = 'Encarregado de Estoque'
    )
  )
$$;
REVOKE ALL ON FUNCTION public.can_delete_davs(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.can_delete_davs(uuid) TO authenticated;

DROP POLICY IF EXISTS "authorized delete davs" ON public.davs;
CREATE POLICY "authorized delete davs"
  ON public.davs FOR DELETE TO authenticated
  USING (public.can_delete_davs(auth.uid()));

DROP POLICY IF EXISTS "authorized delete dav attachments" ON public.dav_attachments;
CREATE POLICY "authorized delete dav attachments"
  ON public.dav_attachments FOR DELETE TO authenticated
  USING (public.can_delete_davs(auth.uid()));

SELECT cron.schedule(
  'presence-offline-tick',
  '* * * * *',
  $job$
    UPDATE public.profiles
    SET status = 'offline'
    WHERE status <> 'offline'
      AND (NOT active OR last_seen_at IS NULL OR last_seen_at < now() - interval '150 seconds')
  $job$
);
