-- Progress table: one row per user, JSONB blob
create table if not exists progress (
  user_id    uuid references auth.users primary key,
  data       jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

-- Hard cap at DB level (last line of defence — Worker already rejects >100 KB)
alter table progress
  add constraint data_size_limit
  check (length(data::text) < 102400);

-- Row-level security: users can only touch their own row
alter table progress enable row level security;

create policy "own row only" on progress
  using      (auth.uid() = user_id)
  with check (auth.uid() = user_id);
