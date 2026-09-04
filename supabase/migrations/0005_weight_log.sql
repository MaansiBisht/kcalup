-- Weight and goal tracking. The app had target_weight_kg from day one and no way
-- to record an actual weight against it, so it could tell you how much you ate
-- but never whether any of it worked. Calories are the instrument; weight is the
-- outcome the person actually came for.

create table weights (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles on delete cascade,
  -- Computed server-side from the profile timezone, exactly like meals.local_date.
  local_date date not null,
  weight_kg  numeric not null check (weight_kg > 20 and weight_kg < 500),
  created_at timestamptz not null default now(),
  -- One reading per day. Weighing twice replaces rather than accumulates: daily
  -- weight is mostly water, and two readings for one day would fake a trend.
  unique (user_id, local_date)
);
create index weights_user_date_idx on weights (user_id, local_date desc);

alter table weights enable row level security;

create policy own_weights on weights
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

/*
 * Record today's weight. Same contract as log_meal: the date comes from the
 * caller's stored timezone rather than the client, and the user id can never be
 * supplied. Re-weighing on the same day overwrites that day's reading.
 */
create function log_weight(p_weight_kg numeric)
returns void language plpgsql security invoker set search_path = public as $$
declare
  v_uid uuid := (select auth.uid());
  v_tz  text;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select timezone into v_tz from profiles where id = v_uid;
  if v_tz is null then raise exception 'no profile'; end if;

  insert into weights (user_id, local_date, weight_kg)
  values (v_uid, (now() at time zone v_tz)::date, p_weight_kg)
  on conflict (user_id, local_date) do update set weight_kg = excluded.weight_kg;
end $$;
