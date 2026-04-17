-- Reorganisation requests submitted by non-admin users.
--
-- After creating this table, grant yourself admin access in the Supabase dashboard:
--   Authentication → Users → click your user → Edit → app_metadata → { "role": "admin" }
-- This is what the RLS policies use to identify admins.

create table if not exists requests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users not null,
  user_email  text,
  action      text not null check (action in ('move', 'copy', 'delete')),
  num         integer not null,
  -- source location
  from_pat    text not null,
  from_bi     integer not null,
  from_si     integer not null,
  from_role   text not null,
  -- target location (null for delete)
  to_pat      text,
  to_bi       integer,
  to_si       integer,
  to_role     text,
  -- optional context from the requester
  note        text,
  status      text not null default 'pending'
                check (status in ('pending', 'approved', 'rejected')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table requests enable row level security;

-- Any authenticated user can submit a request for themselves
create policy "users insert own requests" on requests
  for insert
  with check (auth.uid() = user_id);

-- Users can read their own requests (to see status updates)
create policy "users read own requests" on requests
  for select
  using (auth.uid() = user_id);

-- Admins can read all requests
create policy "admins read all requests" on requests
  for select
  using (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
  );

-- Admins can update status (approve / reject)
create policy "admins update requests" on requests
  for update
  using (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
  )
  with check (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
  );

-- Keep updated_at current
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger requests_updated_at
  before update on requests
  for each row execute function set_updated_at();
