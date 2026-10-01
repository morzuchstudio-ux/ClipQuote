begin;
create table if not exists private.shared_clips (
  id text primary key default encode(gen_random_bytes(12), 'hex'),
  clip_id uuid not null unique references public.clips(id) on delete cascade
);
alter table private.shared_clips enable row level security;
revoke all on private.shared_clips from public, anon, authenticated;

create or replace function public.get_shared_clip(link_id text)
returns jsonb language sql stable security definer set search_path = ''
as $$
select c.data || jsonb_build_object('id', c.id::text)
from private.shared_clips s join public.clips c on c.id = s.clip_id
where s.id = link_id
$$;
revoke all on function public.get_shared_clip(text) from public;
grant execute on function public.get_shared_clip(text) to anon, authenticated;

create or replace function public.share_clip(clip_id uuid)
returns text language plpgsql security definer set search_path = ''
as $$
declare result text;
begin
  if public.current_member_role() is null or not exists (
    select 1 from public.clips c where c.id = clip_id and c.owner_id = auth.uid()
  ) then raise exception 'Sign in with an approved account to share your clip.'; end if;
  insert into private.shared_clips(clip_id) values (clip_id)
  on conflict on constraint shared_clips_clip_id_key do update set clip_id = excluded.clip_id returning id into result;
  return result;
end $$;
revoke all on function public.share_clip(uuid) from public, anon;
grant execute on function public.share_clip(uuid) to authenticated;

create or replace function public.admin_members()
returns table(email text, role text, approved boolean) language plpgsql security definer set search_path = ''
as $$
begin
 if public.current_member_role() is distinct from 'admin' then raise exception 'Admin access required.'; end if;
 return query select m.email, m.role, m.approved from private.members m order by m.created_at;
end $$;
revoke all on function public.admin_members() from public, anon;
grant execute on function public.admin_members() to authenticated;

create or replace function public.admin_set_member(member_email text, allow_access boolean)
returns void language plpgsql security definer set search_path = ''
as $$
begin
 if public.current_member_role() is distinct from 'admin' then raise exception 'Admin access required.'; end if;
 if member_email is null or length(member_email) > 254 or member_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
   raise exception 'Enter a valid email address.';
 end if;
 if exists(select 1 from private.members where email = lower(trim(member_email)) and role = 'admin') then
   raise exception 'The admin account cannot be changed here.';
 end if;
 insert into private.members(email, approved) values(lower(trim(member_email)), allow_access)
 on conflict(email) do update set approved = excluded.approved;
 -- Existing sessions immediately lose database access via current_member_role.
end $$;
revoke all on function public.admin_set_member(text, boolean) from public, anon;
grant execute on function public.admin_set_member(text, boolean) to authenticated;
commit;
