-- Verification only: all test records are rolled back.
begin;
do $$
begin
  begin
    insert into auth.users(id, email) values(gen_random_uuid(), 'unapproved@example.invalid');
    raise exception 'TEST FAILED: unapproved signup accepted';
  exception when others then
    if sqlerrm not like 'ClipQuote is invite-only.%' then raise; end if;
  end;
  if not exists(select 1 from private.members where email = 'morzuchstudio@gmail.com' and role = 'admin' and approved) then
    raise exception 'TEST FAILED: missing admin';
  end if;
  if has_table_privilege('anon', 'public.clips', 'SELECT')
     or has_table_privilege('authenticated', 'private.members', 'UPDATE') then
    raise exception 'TEST FAILED: excessive grants';
  end if;
end $$;
insert into private.members(email, approved) values ('test-approved@example.invalid', true);
insert into auth.users(id, email, email_confirmed_at)
values ('fefefefe-1111-4111-8111-111111111111', 'test-approved@example.invalid', now());
set local role authenticated;
select set_config('request.jwt.claim.sub', 'fefefefe-1111-4111-8111-111111111111', true);
do $$
begin
  if public.current_member_role() is distinct from 'member' then
    raise exception 'TEST FAILED: approved role missing';
  end if;
end $$;
insert into public.clips(data) values ('{"title":"permission test"}');
reset role;
update private.members set approved = false where email = 'test-approved@example.invalid';
set local role authenticated;
do $$
begin
  if public.current_member_role() is not null then raise exception 'TEST FAILED: suspended role'; end if;
  if exists(select 1 from public.clips) then raise exception 'TEST FAILED: suspended read'; end if;
end $$;
rollback;
