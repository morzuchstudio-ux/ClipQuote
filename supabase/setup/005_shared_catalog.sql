begin;
-- All approved members share the library; direct writes remain owner/admin-only.
create or replace function public.shared_clip_catalog()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
begin
 if public.current_member_role() is null then raise exception 'Approved account required.'; end if;
 return coalesce((
   select jsonb_agg(item order by added_at desc, item->>'id') from (
     select (c.data - '_legacyLink' - '_kind' - '_ownerId') || jsonb_build_object('id',c.id::text,'_kind','saved') as item, c.created_at as added_at
     from public.clips c
     union all
     select (l.data - '_legacyLink' - '_kind' - '_ownerId') || jsonb_build_object('id','legacy:' || l.id,'_kind','legacy','_legacyLink',l.id), l.migrated_at
     from private.legacy_shared_clips l
   ) records
 ), '[]'::jsonb);
end $$;
revoke all on function public.shared_clip_catalog() from public, anon;
grant execute on function public.shared_clip_catalog() to authenticated;

create or replace function public.share_clip(clip_id uuid)
returns text language plpgsql security definer set search_path = ''
as $$
declare result text;
begin
 if public.current_member_role() is null or not exists (
   select 1 from public.clips c where c.id = clip_id
 ) then raise exception 'An approved account and an existing clip are required.'; end if;
 insert into private.shared_clips(clip_id) values (clip_id)
 on conflict on constraint shared_clips_clip_id_key do update set clip_id = excluded.clip_id returning id into result;
 return result;
end $$;
revoke all on function public.share_clip(uuid) from public, anon;
grant execute on function public.share_clip(uuid) to authenticated;
commit;
