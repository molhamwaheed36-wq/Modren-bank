-- Run this once in Supabase → SQL Editor → New query → Run

create table if not exists public.app_users (
  id text primary key,
  username text unique not null,
  email text default '',
  hash text not null,
  role text not null default 'user',
  status text not null default 'active',
  created_at timestamptz default now()
);

alter table public.app_users enable row level security;

-- Block direct table access from the client (use RPCs only)
drop policy if exists "no direct access" on public.app_users;
create policy "no direct access" on public.app_users
  for all using (false) with check (false);

create or replace function public.admin_count()
returns int
language sql
security definer
set search_path = public
as $$
  select count(*)::int from public.app_users where role = 'admin';
$$;

create or replace function public.create_first_admin(p_username text, p_hash text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id text;
  cnt int;
begin
  select count(*) into cnt from public.app_users where role = 'admin';
  if cnt > 0 then
    return json_build_object('error', 'admin_exists');
  end if;
  if exists (select 1 from public.app_users where lower(username) = lower(p_username)) then
    return json_build_object('error', 'exists');
  end if;
  new_id := 'usr_' || gen_random_uuid()::text;
  insert into public.app_users (id, username, hash, role, status)
  values (new_id, p_username, p_hash, 'admin', 'active');
  return json_build_object(
    'id', new_id,
    'username', p_username,
    'role', 'admin',
    'status', 'active'
  );
end;
$$;

create or replace function public.login_user(p_username text, p_hash text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  u public.app_users%rowtype;
begin
  select * into u from public.app_users
  where lower(username) = lower(p_username)
    and hash = p_hash
    and status = 'active';
  if not found then
    return json_build_object('error', 'wrong');
  end if;
  return json_build_object(
    'id', u.id,
    'username', u.username,
    'role', u.role,
    'status', u.status,
    'email', coalesce(u.email, '')
  );
end;
$$;

grant execute on function public.admin_count() to anon, authenticated;
grant execute on function public.create_first_admin(text, text) to anon, authenticated;
grant execute on function public.login_user(text, text) to anon, authenticated;
