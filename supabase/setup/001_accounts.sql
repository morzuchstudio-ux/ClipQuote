begin;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.members (
  email text primary key check (email = lower(email)),
  role text not null default 'member' check (role in ('admin', 'member')),
  approved boolean not null default false,
  created_at timestamptz not null default now()
);
alter table private.members enable row level security;
revoke all on private.members from public, anon, authenticated;
insert into private.members(email, role, approved)
values ('morzuchstudio@gmail.com', 'admin', true)
on conflict (email) do nothing;

-- Resolve permissions from verified Auth data, never editable user metadata.
create or replace function public.current_member_role()
returns text language sql stable security definer set search_path = ''
as $$
  select m.role from private.members m
  join auth.users u on lower(u.email) = m.email
  where u.id = auth.uid() and u.email_confirmed_at is not null and m.approved
$$;
revoke all on function public.current_member_role() from public, anon;
grant execute on function public.current_member_role() to authenticated;

-- Enforce the approval list even when signup is called outside our UI.
create or replace function private.require_approved_signup()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (
    select 1 from private.members where email = lower(new.email) and approved
  ) then
    raise exception 'ClipQuote is invite-only. Ask the administrator for access.';
  end if;
  return new;
end;
$$;
revoke all on function private.require_approved_signup() from public, anon, authenticated;
drop trigger if exists clipquote_approved_signup on auth.users;
create trigger clipquote_approved_signup before insert on auth.users
for each row execute function private.require_approved_signup();

create table if not exists public.clips (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  data jsonb not null check (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 16384),
  created_at timestamptz not null default now()
);
alter table public.clips enable row level security;
revoke all on public.clips from anon, authenticated;
grant select, insert, update, delete on public.clips to authenticated;
drop policy if exists clip_owner_access on public.clips;
create policy clip_owner_access on public.clips for all to authenticated
using (public.current_member_role() is not null and (owner_id = auth.uid() or public.current_member_role() = 'admin'))
with check (public.current_member_role() is not null and (owner_id = auth.uid() or public.current_member_role() = 'admin'));
create index if not exists clips_owner_idx on public.clips(owner_id);

create table if not exists public.favorites (
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  clip_id text not null check (length(clip_id) <= 100),
  primary key (owner_id, clip_id)
);
alter table public.favorites enable row level security;
revoke all on public.favorites from anon, authenticated;
grant select, insert, delete on public.favorites to authenticated;
drop policy if exists favorites_owner_access on public.favorites;
create policy favorites_owner_access on public.favorites for all to authenticated
using (owner_id = auth.uid() and public.current_member_role() is not null)
with check (owner_id = auth.uid() and public.current_member_role() is not null);
commit;
