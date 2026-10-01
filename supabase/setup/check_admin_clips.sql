begin;
insert into private.members(email, approved) values ('admin-check-member@example.invalid', true);
insert into auth.users(id,email,email_confirmed_at)
values ('fefefefe-5555-4555-8555-555555555555','admin-check-member@example.invalid',now());
insert into public.clips(id,owner_id,data)
values ('fefefefe-6666-4666-8666-666666666666','fefefefe-5555-4555-8555-555555555555','{"title":"admin deletion test"}');
insert into private.shared_clips(id,clip_id)
values ('fefefefe6666466686660000','fefefefe-6666-4666-8666-666666666666');
insert into private.legacy_shared_clips(id,data) values ('zzTESTADMINzz001','{"title":"legacy deletion test"}');
select set_config('request.jwt.claim.sub','fefefefe-5555-4555-8555-555555555555',true);
set local role authenticated;
do $$
begin
 begin
  perform public.admin_delete_clip('saved','fefefefe-6666-4666-8666-666666666666');
  raise exception 'TEST FAILED: member deleted with admin privileges';
 exception when others then
  if sqlerrm <> 'Admin access required.' then raise; end if;
 end;
 begin
  perform public.admin_clip_catalog();
  raise exception 'TEST FAILED: member read admin catalog';
 exception when others then
  if sqlerrm <> 'Admin access required.' then raise; end if;
 end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from auth.users where email='morzuchstudio@gmail.com'),true);
set local role authenticated;
do $$
begin
 if public.current_member_role() is distinct from 'admin' then raise exception 'Missing test admin'; end if;
 if not exists(select 1 from jsonb_array_elements(public.admin_clip_catalog()) c where c->>'id' = 'legacy:zzTESTADMINzz001') then raise exception 'Missing legacy catalog entry'; end if;
 perform public.admin_delete_clip('saved','fefefefe-6666-4666-8666-666666666666');
 if public.get_shared_clip('fefefefe6666466686660000') is not null then raise exception 'Saved link survived'; end if;
 perform public.admin_delete_clip('legacy','zzTESTADMINzz001');
 if public.get_shared_clip('zzTESTADMINzz001') is not null then raise exception 'Legacy link survived'; end if;
 perform public.admin_delete_clip('example','test-hidden-example');
 if not exists(select 1 from public.hidden_example_ids() id where id='test-hidden-example') then raise exception 'Example still visible'; end if;
end $$;
rollback;
