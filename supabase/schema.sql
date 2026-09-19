-- Run once in the new project's SQL Editor, before enabling the app.
begin;
create table public.opportunities (
 owner uuid not null references auth.users(id) on delete cascade,
 id text not null check(id ~ '^[a-zA-Z0-9_-]{1,100}$'),
 payload jsonb not null,
 version integer not null default 1 check(version>0),
 created timestamptz not null default now(),
 primary key(owner,id),
 constraint payload_object check(jsonb_typeof(payload)='object'),
 constraint payload_size check(octet_length(payload::text)<=25000),
 constraint payload_id check(payload ? 'id' and payload->>'id'=id),
 constraint payload_version check(payload ? 'version' and (payload->>'version')::integer=version),
 constraint payload_status check(payload ? 'status' and payload->>'status' in ('Saved','Preparing','Submitted','Waiting for Recommendation','Interview','Offer','Rejected','Declined','Withdrawn'))
);
alter table public.opportunities enable row level security;
revoke all on public.opportunities from anon, authenticated;
grant select,insert,update on public.opportunities to authenticated;
create policy read_own on public.opportunities for select to authenticated using((select auth.uid())=owner);
create policy insert_own on public.opportunities for insert to authenticated with check((select auth.uid())=owner);
create policy update_own on public.opportunities for update to authenticated using((select auth.uid())=owner) with check((select auth.uid())=owner);
-- Even a direct client cannot reassign a record, reset its version, or change its creation date.
create function public.check_opportunity_version() returns trigger language plpgsql set search_path='' as $$
begin
 if TG_OP='INSERT' then
  if NEW.version<>1 then raise exception 'New records must start at version 1'; end if;
 else
  if NEW.owner<>OLD.owner or NEW.id<>OLD.id or NEW.created<>OLD.created then raise exception 'Record identity cannot change'; end if;
  if NEW.version<>OLD.version+1 then raise exception 'Invalid record version'; end if;
 end if;
 return NEW;
end;
$$;
revoke all on function public.check_opportunity_version() from public;
create trigger check_opportunity_version before insert or update on public.opportunities for each row execute function public.check_opportunity_version();
commit;
