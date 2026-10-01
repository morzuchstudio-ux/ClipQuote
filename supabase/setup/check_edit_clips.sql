begin;
insert into private.members(email,approved) values ('edit-check@example.invalid',true);
insert into auth.users(id,email,email_confirmed_at) values ('fafafafa-1111-4111-8111-111111111111','edit-check@example.invalid',now());
insert into public.clips(id,owner_id,data) values
 ('fafafafa-2222-4222-8222-222222222222','fafafafa-1111-4111-8111-111111111111','{"title":"Before"}'),
 ('fafafafa-3333-4333-8333-333333333333',(select id from auth.users where email='morzuchstudio@gmail.com'),'{"title":"Other owner"}');
insert into private.shared_clips(id,clip_id) values ('fafafafa2222422282220000','fafafafa-2222-4222-8222-222222222222');
insert into private.legacy_shared_clips(id,data) values ('EDITTEST00000001','{"title":"Migrated before"}');
select set_config('request.jwt.claim.sub','fafafafa-1111-4111-8111-111111111111',true);
set local role authenticated;
do $$ declare affected integer; begin
 update public.clips set data='{"title":"Owner edited", "start":7.3,"end":10.4}' where id='fafafafa-2222-4222-8222-222222222222';
 get diagnostics affected = row_count;
 if affected <> 1 then raise exception 'Owner edit failed'; end if;
 if public.get_shared_clip('fafafafa2222422282220000')->>'title' <> 'Owner edited' then raise exception 'Shared link did not update'; end if;
 update public.clips set data='{"title":"Unauthorized"}' where id='fafafafa-3333-4333-8333-333333333333';
 get diagnostics affected = row_count;
 if affected <> 0 then raise exception 'Member edited another owner clip'; end if;
 begin
  perform public.admin_update_legacy_clip('EDITTEST00000001','{"title":"Unauthorized"}');
  raise exception 'Member edited legacy clip';
 exception when others then if sqlerrm <> 'Admin access required.' then raise; end if;
 end;
end $$;
reset role;
update private.members set approved=false where email='edit-check@example.invalid';
set local role authenticated;
do $$ declare affected integer; begin
 update public.clips set data='{"title":"Revoked"}' where id='fafafafa-2222-4222-8222-222222222222';
 get diagnostics affected = row_count;
 if affected <> 0 then raise exception 'Revoked member edited a clip'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from auth.users where email='morzuchstudio@gmail.com'),true);
set local role authenticated;
do $$ declare affected integer; begin
 update public.clips set data='{"title":"Admin edited"}' where id='fafafafa-2222-4222-8222-222222222222';
 get diagnostics affected = row_count;
 if affected <> 1 then raise exception 'Admin could not edit another owner clip'; end if;
 if public.get_shared_clip('fafafafa2222422282220000')->>'title' <> 'Admin edited' then raise exception 'Share link changed'; end if;
 perform public.admin_update_legacy_clip('EDITTEST00000001','{"title":"Migrated edited","_legacyLink":"fake","_ownerId":"fake","_kind":"fake"}');
 if public.get_shared_clip('EDITTEST00000001')->>'title' <> 'Migrated edited' then raise exception 'Legacy link changed'; end if;
 if public.get_shared_clip('EDITTEST00000001') ? '_legacyLink' then raise exception 'Reserved metadata retained'; end if;
 begin
  perform public.admin_update_legacy_clip('MISSING000000001','{}');
  raise exception 'Missing clip was silently accepted';
 exception when others then if sqlerrm <> 'Clip no longer exists.' then raise; end if;
 end;
end $$;
reset role;
do $$ begin
 if has_table_privilege('anon','public.clips','update') then raise exception 'Anonymous update allowed'; end if;
 if has_function_privilege('anon','public.admin_update_legacy_clip(text,jsonb)','execute') then raise exception 'Anonymous legacy update allowed'; end if;
 if (select owner_id from public.clips where id='fafafafa-2222-4222-8222-222222222222') <> 'fafafafa-1111-4111-8111-111111111111'::uuid then raise exception 'Owner changed'; end if;
end $$;
rollback;
