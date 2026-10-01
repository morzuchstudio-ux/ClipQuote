begin;
create table if not exists private.hidden_examples (
  id text primary key check (length(id) between 1 and 100)
);
alter table private.hidden_examples enable row level security;
revoke all on private.hidden_examples from public, anon, authenticated;

create or replace function public.hidden_example_ids()
returns setof text language sql stable security definer set search_path = ''
as $$ select id from private.hidden_examples $$;
revoke all on function public.hidden_example_ids() from public;
grant execute on function public.hidden_example_ids() to anon, authenticated;

create or replace function public.admin_clip_catalog()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
begin
 if public.current_member_role() is distinct from 'admin' then raise exception 'Admin access required.'; end if;
 return coalesce((
   select jsonb_agg(item) from (
     select (c.data - '_legacyLink' - '_kind' - '_ownerId') || jsonb_build_object('id',c.id::text,'_kind','saved','_ownerId',c.owner_id::text) as item
     from public.clips c
     union all
     select l.data || jsonb_build_object('id','legacy:' || l.id,'_kind','legacy','_legacyLink',l.id) as item
     from private.legacy_shared_clips l
   ) records
 ), '[]'::jsonb);
end $$;
revoke all on function public.admin_clip_catalog() from public, anon;
grant execute on function public.admin_clip_catalog() to authenticated;

create or replace function public.admin_delete_clip(clip_kind text, clip_key text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
 if public.current_member_role() is distinct from 'admin' then raise exception 'Admin access required.'; end if;
 if clip_kind = 'saved' then
   delete from public.clips where id::text = clip_key;
   if not found then raise exception 'Clip no longer exists.'; end if;
   delete from public.favorites where clip_id = clip_key;
 elsif clip_kind = 'legacy' then
   delete from private.legacy_shared_clips where id = clip_key;
   if not found then raise exception 'Clip no longer exists.'; end if;
 elsif clip_kind = 'example' then
   if clip_key is null or length(clip_key) > 100 then raise exception 'Invalid example.'; end if;
   insert into private.hidden_examples(id) values(clip_key) on conflict do nothing;
 else raise exception 'Invalid clip type.';
 end if;
end $$;
revoke all on function public.admin_delete_clip(text,text) from public, anon;
grant execute on function public.admin_delete_clip(text,text) to authenticated;
commit;
