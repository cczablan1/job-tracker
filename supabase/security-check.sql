-- Execute against a development Supabase project after schema.sql.
-- All test data and changes roll back.
begin;
insert into auth.users(id,email) values
 ('11111111-1111-4111-8111-111111111111','rls-a@example.invalid'),
 ('22222222-2222-4222-8222-222222222222','rls-b@example.invalid');
insert into public.opportunities(owner,id,payload) values
 ('11111111-1111-4111-8111-111111111111','rls-test','{"id":"rls-test","version":1,"status":"Saved"}'),
 ('22222222-2222-4222-8222-222222222222','rls-test','{"id":"rls-test","version":1,"status":"Saved"}');
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
do $$
declare n integer;
begin
 select count(*) into n from public.opportunities where id='rls-test';
 if n<>1 then raise exception 'RLS failed: expected exactly one visible fixture'; end if;
 update public.opportunities set version=2,payload=jsonb_set(payload,'{version}','2') where owner='22222222-2222-4222-8222-222222222222' and id='rls-test';
 get diagnostics n=row_count;
 if n<>0 then raise exception 'RLS failed: other user updated'; end if;
 begin
  insert into public.opportunities(owner,id,payload) values ('22222222-2222-4222-8222-222222222222','forbidden','{"id":"forbidden","version":1,"status":"Saved"}');
  raise exception 'RLS failed: inserted as other user';
 exception when insufficient_privilege then null;
 end;
end $$;
reset role;
set local role anon;
do $$
begin
 begin
  perform 1 from public.opportunities;
  raise exception 'RLS failed: anonymous read allowed';
 exception when insufficient_privilege then null;
 end;
end $$;
rollback;
