begin;
insert into private.members(email,approved) values ('shared-check@example.invalid',true);
insert into auth.users(id,email,email_confirmed_at) values ('fefefefe-7777-4777-8777-777777777777','shared-check@example.invalid',now());
insert into public.clips(id,owner_id,data) values ('fefefefe-8888-4888-8888-888888888888',(select id from auth.users where email='morzuchstudio@gmail.com'),'{"title":"Shared catalog test"}');
select set_config('request.jwt.claim.sub','fefefefe-7777-4777-8777-777777777777',true);
set local role authenticated;
do $$
declare link text; affected integer;
begin
 if not exists(select 1 from jsonb_array_elements(public.shared_clip_catalog()) c where c->>'id'='fefefefe-8888-4888-8888-888888888888') then raise exception 'Other owner clip missing'; end if;
 link := public.share_clip('fefefefe-8888-4888-8888-888888888888');
 if public.get_shared_clip(link)->>'title' <> 'Shared catalog test' then raise exception 'Share failed'; end if;
 if public.share_clip('fefefefe-8888-4888-8888-888888888888') <> link then raise exception 'Unstable link'; end if;
 delete from public.clips where id='fefefefe-8888-4888-8888-888888888888';
 get diagnostics affected = row_count;
 if affected <> 0 then raise exception 'Member deleted another owner clip'; end if;
end $$;
reset role;
update private.members set approved=false where email='shared-check@example.invalid';
set local role authenticated;
do $$
begin
 begin
 perform public.shared_clip_catalog();
 raise exception 'Suspended member accessed catalog';
 exception when others then if sqlerrm <> 'Approved account required.' then raise; end if;
 end;
end $$;
reset role;
do $$ begin
 if has_function_privilege('anon','public.shared_clip_catalog()','execute') then raise exception 'Anonymous catalog access'; end if;
end $$;
rollback;
