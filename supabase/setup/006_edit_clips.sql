begin;
-- Saved clips already support owner/admin UPDATE through RLS. Migrated clips
-- have no owner, so only admins may edit them, without changing their link.
create or replace function public.admin_update_legacy_clip(clip_key text, clip_data jsonb)
returns void language plpgsql security definer set search_path = ''
as $$
begin
 if public.current_member_role() is distinct from 'admin' then raise exception 'Admin access required.'; end if;
 if clip_data is null or jsonb_typeof(clip_data) <> 'object' or octet_length(clip_data::text) > 16384 then
   raise exception 'Invalid clip data.';
 end if;
 update private.legacy_shared_clips
 set data = (clip_data - '_kind' - '_ownerId' - '_legacyLink') || jsonb_build_object('id', 'legacy:' || clip_key)
 where id = clip_key;
 if not found then raise exception 'Clip no longer exists.'; end if;
end $$;
revoke all on function public.admin_update_legacy_clip(text,jsonb) from public, anon;
grant execute on function public.admin_update_legacy_clip(text,jsonb) to authenticated;
commit;
