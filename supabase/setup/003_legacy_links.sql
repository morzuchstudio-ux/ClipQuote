begin;
create table if not exists private.legacy_shared_clips (
  id text primary key check(id ~ '^[A-Za-z0-9_-]{16}$'),
  data jsonb not null,
  migrated_at timestamptz not null default now()
);
alter table private.legacy_shared_clips enable row level security;
revoke all on private.legacy_shared_clips from public, anon, authenticated;
create or replace function public.get_shared_clip(link_id text)
returns jsonb language sql stable security definer set search_path = ''
as $$
select coalesce(
  (select c.data || jsonb_build_object('id', c.id::text)
   from private.shared_clips s join public.clips c on c.id = s.clip_id where s.id = link_id),
  (select data from private.legacy_shared_clips where id = link_id)
)
$$;
revoke all on function public.get_shared_clip(text) from public;
grant execute on function public.get_shared_clip(text) to anon, authenticated;
commit;
