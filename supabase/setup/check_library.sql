begin;
insert into private.members(email, approved) values ('library-check@example.invalid', true);
insert into auth.users(id, email, email_confirmed_at)
values ('fefefefe-2222-4222-8222-222222222222', 'library-check@example.invalid', now());
set local role authenticated;
select set_config('request.jwt.claim.sub', 'fefefefe-2222-4222-8222-222222222222', true);
insert into public.clips(id, data) values ('fefefefe-3333-4333-8333-333333333333', '{"title":"test"}');
do $$
declare link text;
begin
 link := public.share_clip('fefefefe-3333-4333-8333-333333333333');
 if link is null or length(link) <> 24 then raise exception 'Invalid link'; end if;
 if public.share_clip('fefefefe-3333-4333-8333-333333333333') <> link then raise exception 'Link changed'; end if;
 if public.get_shared_clip(link)->>'title' <> 'test' then raise exception 'Shared lookup failed'; end if;
 begin
   perform public.admin_set_member('attacker@example.invalid', true);
   raise exception 'TEST FAILED: admin escalation';
 exception when others then
   if sqlerrm <> 'Admin access required.' then raise; end if;
 end;
end $$;
-- A different identity cannot read or edit this library.
select set_config('request.jwt.claim.sub', 'fefefefe-4444-4444-8444-444444444444', true);
do $$
begin
 if exists(select 1 from public.clips) then raise exception 'Cross-account leak'; end if;
end $$;
reset role;
do $$
declare link text;
begin
 select id into link from private.shared_clips where clip_id = 'fefefefe-3333-4333-8333-333333333333';
 delete from public.clips where id = 'fefefefe-3333-4333-8333-333333333333';
 if public.get_shared_clip(link) is not null then raise exception 'Deleted link still accessible'; end if;
end $$;
rollback;
