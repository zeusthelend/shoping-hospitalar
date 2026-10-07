-- lovable-cron-fallback-reviewed: overdue DAV push must reach closed/locked devices; time-based, single consolidated 5-minute job
CREATE OR REPLACE FUNCTION public.create_chat_conversation(_kind text, _name text, _members uuid[])
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid; _uid uuid := auth.uid(); _peer uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _kind NOT IN ('direct','group') THEN RAISE EXCEPTION 'invalid kind'; END IF;
  _members := array(SELECT DISTINCT m FROM unnest(coalesce(_members,'{}')) m WHERE m <> _uid AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = m));
  IF array_length(_members,1) IS NULL THEN RAISE EXCEPTION 'Selecione pelo menos uma pessoa'; END IF;
  IF _kind = 'direct' THEN
    IF array_length(_members,1) <> 1 THEN RAISE EXCEPTION 'Conversa individual exige uma pessoa'; END IF;
    _peer := _members[1];
    SELECT c.id INTO _id FROM chat_conversations c
      WHERE c.kind='direct'
        AND EXISTS (SELECT 1 FROM chat_participants a WHERE a.conversation_id=c.id AND a.user_id=_uid)
        AND EXISTS (SELECT 1 FROM chat_participants b WHERE b.conversation_id=c.id AND b.user_id=_peer)
      LIMIT 1;
    IF _id IS NOT NULL THEN RETURN _id; END IF;
  ELSE
    IF coalesce(length(trim(_name)),0) = 0 THEN RAISE EXCEPTION 'Informe o nome do grupo'; END IF;
  END IF;
  INSERT INTO chat_conversations (kind, name, created_by)
    VALUES (_kind, CASE WHEN _kind='group' THEN left(trim(_name),120) END, _uid) RETURNING id INTO _id;
  INSERT INTO chat_participants (conversation_id, user_id) SELECT _id, m FROM unnest(_members) m ON CONFLICT DO NOTHING;
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.create_chat_conversation(text,text,uuid[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_chat_conversation(text,text,uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.touch_chat_conversation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN UPDATE chat_conversations SET updated_at = now() WHERE id = new.conversation_id; RETURN new; END $$;
CREATE TRIGGER chat_messages_touch AFTER INSERT ON public.chat_messages FOR EACH ROW EXECUTE FUNCTION public.touch_chat_conversation();

INSERT INTO public.positions (name, permissions)
SELECT 'Encarregado de Estoque', '{}'::text[] WHERE NOT EXISTS (SELECT 1 FROM public.positions WHERE name = 'Encarregado de Estoque');
CREATE OR REPLACE FUNCTION public.can_delete_davs(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM user_roles WHERE user_id=_user_id AND role IN ('admin','gerente'))
      OR EXISTS (SELECT 1 FROM profiles p JOIN positions po ON po.id=p.position_id WHERE p.id=_user_id AND po.name='Encarregado de Estoque')
$$;
GRANT EXECUTE ON FUNCTION public.can_delete_davs(uuid) TO authenticated;
DROP POLICY IF EXISTS "managers manage all davs" ON public.davs;
CREATE POLICY "managers read davs" ON public.davs FOR SELECT TO authenticated USING (public.is_manager(auth.uid()) OR public.can_delete_davs(auth.uid()));
CREATE POLICY "managers create davs" ON public.davs FOR INSERT TO authenticated WITH CHECK (public.is_manager(auth.uid()) AND created_by = auth.uid());
CREATE POLICY "managers update davs" ON public.davs FOR UPDATE TO authenticated USING (public.is_manager(auth.uid())) WITH CHECK (public.is_manager(auth.uid()));
CREATE POLICY "authorized delete davs" ON public.davs FOR DELETE TO authenticated USING (public.can_delete_davs(auth.uid()));
CREATE POLICY "authorized delete dav attachments" ON public.dav_attachments FOR DELETE TO authenticated USING (public.can_delete_davs(auth.uid()));

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS approved boolean NOT NULL DEFAULT false;
UPDATE public.profiles SET approved = true;
CREATE OR REPLACE FUNCTION public.guard_profile() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  if not public.has_role(auth.uid(),'admin') then
    new.position_id := old.position_id; new.department_id := old.department_id; new.active := old.active; new.email := old.email; new.approved := old.approved;
  end if;
  return new;
end $$;
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare first_admin boolean := not exists (select 1 from public.user_roles where role='admin');
begin
  insert into public.profiles (id, full_name, email, avatar_url, approved)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1)), new.email, new.raw_user_meta_data->>'avatar_url', first_admin);
  insert into public.user_roles (user_id, role) values (new.id, case when first_admin then 'admin'::app_role else 'funcionario'::app_role end);
  return new;
end $$;

CREATE TABLE public.access_pins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pin_hash text NOT NULL UNIQUE,
  label text,
  created_by uuid NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
  used_by uuid,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, DELETE ON public.access_pins TO authenticated;
GRANT ALL ON public.access_pins TO service_role;
ALTER TABLE public.access_pins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read pins" ON public.access_pins FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins delete pins" ON public.access_pins FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.create_access_pin(_label text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE _pin text;
BEGIN
  IF NOT has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Apenas administradores'; END IF;
  LOOP
    _pin := lpad(((('x'||encode(gen_random_bytes(4),'hex'))::bit(32)::bigint) % 100000000)::text, 8, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM access_pins WHERE pin_hash = encode(digest(_pin,'sha256'),'hex'));
  END LOOP;
  INSERT INTO access_pins (pin_hash, label, created_by) VALUES (encode(digest(_pin,'sha256'),'hex'), left(_label,120), auth.uid());
  RETURN _pin;
END $$;
REVOKE ALL ON FUNCTION public.create_access_pin(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_access_pin(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.redeem_access_pin(_pin text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE _row uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  UPDATE access_pins SET used_by = auth.uid(), used_at = now()
    WHERE id = (SELECT id FROM access_pins WHERE pin_hash = encode(digest(trim(_pin),'sha256'),'hex') AND used_by IS NULL AND expires_at > now() LIMIT 1 FOR UPDATE)
    RETURNING id INTO _row;
  IF _row IS NULL THEN RETURN false; END IF;
  UPDATE profiles SET approved = true WHERE id = auth.uid();
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.redeem_access_pin(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.redeem_access_pin(text) TO authenticated;

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE TABLE public.scheduler_tokens (name text PRIMARY KEY, token text NOT NULL DEFAULT encode(extensions.gen_random_bytes(32),'hex'));
GRANT ALL ON public.scheduler_tokens TO service_role;
ALTER TABLE public.scheduler_tokens ENABLE ROW LEVEL SECURITY;
INSERT INTO public.scheduler_tokens (name) VALUES ('dav-push');
SELECT cron.schedule('dav-push-tick', '*/5 * * * *', $c$
  SELECT net.http_post(
    url := 'https://shopping-hospitalar.lovable.app/api/public/dav-push-tick',
    headers := jsonb_build_object('Content-Type','application/json','x-scheduler-token',(SELECT token FROM public.scheduler_tokens WHERE name='dav-push')),
    body := '{}'::jsonb)
$c$);