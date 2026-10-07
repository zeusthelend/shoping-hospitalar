create type public.app_role as enum ('admin','diretor','gerente','funcionario');
create type public.user_status as enum ('online','offline','ausente','ocupado');

create or replace function public.set_updated_at() returns trigger language plpgsql set search_path=public as $$
begin new.updated_at = now(); return new; end $$;

create table public.departments (id uuid primary key default gen_random_uuid(), name text not null unique, created_at timestamptz not null default now());
create table public.positions (id uuid primary key default gen_random_uuid(), name text not null unique, permissions text[] not null default '{}', created_at timestamptz not null default now());

create table public.profiles (
  id uuid primary key,
  full_name text not null default '',
  email text,
  phone text, extension text, unit text, description text, avatar_url text,
  position_id uuid references public.positions(id) on delete set null,
  department_id uuid references public.departments(id) on delete set null,
  status public.user_status not null default 'offline',
  active boolean not null default true,
  joined_at date default current_date,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();

create table public.user_roles (id uuid primary key default gen_random_uuid(), user_id uuid not null, role public.app_role not null, unique(user_id, role));

create table public.announcements (id uuid primary key default gen_random_uuid(), title text not null, body text not null default '', important boolean not null default false, author_id uuid, created_at timestamptz not null default now());
create table public.meetings (id uuid primary key default gen_random_uuid(), title text not null, description text, starts_at timestamptz not null, location text, link text, organizer_id uuid, created_at timestamptz not null default now());
create table public.documents (id uuid primary key default gen_random_uuid(), title text not null, category text, file_path text not null, file_name text, file_size bigint, uploaded_by uuid, created_at timestamptz not null default now());
create table public.posts (id uuid primary key default gen_random_uuid(), title text not null, body text not null default '', image_url text, author_id uuid, created_at timestamptz not null default now());
create table public.banners (id uuid primary key default gen_random_uuid(), title text, image_url text not null, link text, active boolean not null default true, created_at timestamptz not null default now());
create table public.app_settings (id int primary key default 1 check (id = 1), company_name text not null default 'Shopping Hospitalar', logo_url text, updated_at timestamptz not null default now());
insert into public.app_settings (id) values (1);

do $$ declare t text; begin
  foreach t in array array['departments','positions','profiles','announcements','meetings','documents','posts','banners','app_settings'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated; grant all on public.%I to service_role; alter table public.%I enable row level security;', t, t, t);
  end loop;
end $$;
grant select on public.app_settings to anon;
grant select on public.user_roles to authenticated; grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role) returns boolean language sql stable security definer set search_path=public as $$
  select exists (select 1 from public.user_roles where user_id=_user_id and role=_role) $$;
create or replace function public.is_manager(_user_id uuid) returns boolean language sql stable security definer set search_path=public as $$
  select exists (select 1 from public.user_roles where user_id=_user_id and role in ('admin','diretor','gerente')) $$;

create policy "read roles" on public.user_roles for select to authenticated using (true);
create policy "admin manage roles" on public.user_roles for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create policy "read profiles" on public.profiles for select to authenticated using (true);
create policy "update own profile" on public.profiles for update to authenticated using (id = auth.uid() or public.has_role(auth.uid(),'admin')) with check (id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "admin delete profile" on public.profiles for delete to authenticated using (public.has_role(auth.uid(),'admin'));

create or replace function public.guard_profile() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if not public.has_role(auth.uid(),'admin') then
    new.position_id := old.position_id; new.department_id := old.department_id; new.active := old.active; new.email := old.email;
  end if;
  return new;
end $$;
create trigger profiles_guard before update on public.profiles for each row execute function public.guard_profile();

create policy "public read settings" on public.app_settings for select to anon using (true);

do $$ declare t text; begin
  foreach t in array array['departments','positions','banners','app_settings'] loop
    execute format('create policy "read %1$s" on public.%1$I for select to authenticated using (true);', t);
    execute format('create policy "admin write %1$s" on public.%1$I for all to authenticated using (public.has_role(auth.uid(),''admin'')) with check (public.has_role(auth.uid(),''admin''));', t);
  end loop;
  foreach t in array array['announcements','meetings','documents','posts'] loop
    execute format('create policy "read %1$s" on public.%1$I for select to authenticated using (true);', t);
    execute format('create policy "managers write %1$s" on public.%1$I for all to authenticated using (public.is_manager(auth.uid())) with check (public.is_manager(auth.uid()));', t);
  end loop;
end $$;

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles (id, full_name, email, avatar_url)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1)), new.email, new.raw_user_meta_data->>'avatar_url');
  if not exists (select 1 from public.user_roles where role='admin') then
    insert into public.user_roles (user_id, role) values (new.id,'admin');
  else
    insert into public.user_roles (user_id, role) values (new.id,'funcionario');
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

insert into public.departments (name) values ('Administrativo'),('Diretoria'),('Estoque'),('Vendas'),('Financeiro'),('RH'),('Operacional');
insert into public.positions (name, permissions) values ('Administrador','{all}'),('Diretor','{admin_view,manage_content}'),('Gerente','{team_view,manage_content}'),('Administrativo','{}'),('Estoque','{}'),('Vendedor(a)','{}'),('Financeiro','{}'),('RH','{}'),('Supervisor','{team_view}'),('Operacional','{}');
insert into public.announcements (title, body, important) values ('Bem-vindo ao Shopping Hospitalar','Esta é a nova plataforma interna da empresa. Atualize seu perfil!', true);

create policy "read avatars" on storage.objects for select to authenticated using (bucket_id='avatars');
create policy "upload own avatar" on storage.objects for insert to authenticated with check (bucket_id='avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "update own avatar" on storage.objects for update to authenticated using (bucket_id='avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "read branding" on storage.objects for select to anon, authenticated using (bucket_id='branding');
create policy "admin branding ins" on storage.objects for insert to authenticated with check (bucket_id='branding' and public.has_role(auth.uid(),'admin'));
create policy "admin branding upd" on storage.objects for update to authenticated using (bucket_id='branding' and public.has_role(auth.uid(),'admin'));
create policy "read documents" on storage.objects for select to authenticated using (bucket_id='documents');
create policy "managers upload documents" on storage.objects for insert to authenticated with check (bucket_id='documents' and public.is_manager(auth.uid()));
create policy "managers delete documents" on storage.objects for delete to authenticated using (bucket_id='documents' and public.is_manager(auth.uid()));