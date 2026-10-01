begin;
insert into private.members(email, approved) values ('favorites-check@example.invalid', true);
insert into auth.users(id,email,email_confirmed_at)
values ('fefefefe-9999-4999-8999-999999999999','favorites-check@example.invalid',now());
insert into public.favorites(owner_id,clip_id)
values ((select id from auth.users where email='morzuchstudio@gmail.com'),'test-admin-favorite');
select set_config('request.jwt.claim.sub','fefefefe-9999-4999-8999-999999999999',true);
set local role authenticated;
do $$
declare affected integer;
begin
 -- The old merge-upsert needs UPDATE even when the favorite is new.
 begin
  insert into public.favorites(owner_id,clip_id) values(auth.uid(),'test-member-favorite')
  on conflict(owner_id,clip_id) do update set clip_id=excluded.clip_id;
  raise exception 'Expected missing UPDATE privilege';
 exception when insufficient_privilege then null;
 end;
 -- The fixed request is idempotent and only requires INSERT.
 insert into public.favorites(owner_id,clip_id) values(auth.uid(),'test-member-favorite') on conflict do nothing;
 insert into public.favorites(owner_id,clip_id) values(auth.uid(),'test-member-favorite') on conflict do nothing;
 if (select count(*) from public.favorites where clip_id='test-member-favorite') <> 1 then raise exception 'Favorite not saved'; end if;
 if exists(select 1 from public.favorites where clip_id='test-admin-favorite') then raise exception 'Favorites exposed across accounts'; end if;
 delete from public.favorites where clip_id='test-admin-favorite';
 get diagnostics affected=row_count;
 if affected <> 0 then raise exception 'Deleted another account favorite'; end if;
 delete from public.favorites where clip_id='test-member-favorite';
 get diagnostics affected=row_count;
 if affected <> 1 then raise exception 'Could not remove own favorite'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from auth.users where email='morzuchstudio@gmail.com'),true);
set local role authenticated;
do $$ begin
 insert into public.favorites(owner_id,clip_id) values(auth.uid(),'test-admin-favorite') on conflict do nothing;
 if (select count(*) from public.favorites where clip_id='test-admin-favorite') <> 1 then raise exception 'Admin favorite not available'; end if;
end $$;
rollback;
