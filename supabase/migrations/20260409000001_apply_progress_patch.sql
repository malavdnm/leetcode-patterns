-- RPC used by the Worker for v:2 (delta) saves.
--
-- Behaviour:
--   INSERT a new row with the patch as the initial store.
--   ON CONFLICT merge the patch over the existing store using the || operator,
--   then strip any keys whose value is JSON null (our deletion signal).
--
-- Single round-trip — no separate read required.
--
-- Equivalent SQL (expanded):
--   INSERT INTO progress (user_id, data, updated_at)
--     VALUES (p_user_id, jsonb_build_object('v',1,'store', jsonb_strip_nulls(p_patch)), now())
--   ON CONFLICT (user_id) DO UPDATE
--     SET data = jsonb_set(
--                  progress.data,
--                  '{store}',
--                  jsonb_strip_nulls((progress.data->'store') || p_patch)
--                ),
--         updated_at = now();

create or replace function apply_progress_patch(
  p_user_id uuid,
  p_patch    jsonb
)
returns void
language plpgsql
security definer          -- runs as the function owner, bypasses RLS for the upsert
set search_path = public
as $$
begin
  insert into progress (user_id, data, updated_at)
    values (
      p_user_id,
      jsonb_build_object('v', 1, 'store', jsonb_strip_nulls(p_patch)),
      now()
    )
  on conflict (user_id) do update
    set data = jsonb_set(
                 progress.data,
                 '{store}',
                 jsonb_strip_nulls(
                   coalesce(progress.data -> 'store', '{}'::jsonb) || p_patch
                 )
               ),
        updated_at = now();
end;
$$;

-- Only the service-role key (used by the Worker) may call this function.
-- Anon / authenticated roles cannot invoke it directly.
revoke execute on function apply_progress_patch(uuid, jsonb) from public, anon, authenticated;
grant  execute on function apply_progress_patch(uuid, jsonb) to service_role;
