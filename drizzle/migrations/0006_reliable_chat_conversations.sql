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

  SELECT coalesce(array_agg(m.member_id ORDER BY m.member_id), '{}'::uuid[])
  INTO _members
  FROM (
    SELECT DISTINCT requested.member_id
    FROM unnest(coalesce(_members, '{}'::uuid[])) AS requested(member_id)
    JOIN public.profiles p ON p.id = requested.member_id
    WHERE requested.member_id <> _uid
      AND p.active
      AND p.approved
  ) AS m;

  IF cardinality(_members) = 0 THEN
    RAISE EXCEPTION 'Selecione pelo menos uma pessoa aprovada';
  END IF;

  IF _kind = 'direct' THEN
    IF cardinality(_members) <> 1 THEN
      RAISE EXCEPTION 'Conversa individual exige uma pessoa';
    END IF;
    _peer := _members[1];

    PERFORM pg_advisory_xact_lock(
      hashtextextended(least(_uid::text, _peer::text) || ':' || greatest(_uid::text, _peer::text), 0)
    );

    SELECT c.id INTO _id
    FROM public.chat_conversations c
    JOIN public.chat_participants cp ON cp.conversation_id = c.id
    WHERE c.kind = 'direct'
    GROUP BY c.id
    HAVING count(*) = 2
      AND bool_and(cp.user_id IN (_uid, _peer))
      AND bool_or(cp.user_id = _uid)
      AND bool_or(cp.user_id = _peer)
    ORDER BY c.created_at
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

  INSERT INTO public.chat_participants (conversation_id, user_id, is_admin)
  VALUES (_id, _uid, true)
  ON CONFLICT (conversation_id, user_id)
  DO UPDATE SET is_admin = true;

  INSERT INTO public.chat_participants (conversation_id, user_id)
  SELECT _id, member_id
  FROM unnest(_members) AS members(member_id)
  ON CONFLICT (conversation_id, user_id) DO NOTHING;

  RETURN _id;
END
$$;

REVOKE ALL ON FUNCTION public.create_chat_conversation(text, text, uuid[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_chat_conversation(text, text, uuid[]) TO authenticated;
