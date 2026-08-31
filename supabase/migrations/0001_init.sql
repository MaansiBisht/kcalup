-- Kcalup schema. Four tables; daily totals are derived, never cached.

create table profiles (
  id                  uuid primary key references auth.users on delete cascade,
  name                text,
  timezone            text not null default 'UTC',
  daily_calorie_goal  int  not null default 2000 check (daily_calorie_goal between 500 and 20000),
  goal_type           text not null default 'maintain' check (goal_type in ('lose','maintain','gain')),
  target_weight_kg    numeric,
  protein_goal_g      int,
  carbs_goal_g        int,
  fat_goal_g          int,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table meals (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles on delete cascade,
  logged_at  timestamptz not null default now(),
  -- computed server-side from the profile timezone; reads are plain date equality
  local_date date not null,
  meal_type  text not null check (meal_type in ('breakfast','lunch','dinner','snack')),
  image_key  text,
  calories   int  not null check (calories >= 0),
  protein_g  numeric check (protein_g >= 0),
  carbs_g    numeric check (carbs_g   >= 0),
  fat_g      numeric check (fat_g     >= 0),
  created_at timestamptz not null default now()
);
create index meals_user_date_idx on meals (user_id, local_date desc);

create table food_items (
  id         uuid primary key default gen_random_uuid(),
  meal_id    uuid not null references meals on delete cascade,
  name       text not null,
  quantity   numeric,
  unit       text,
  calories   int  not null default 0 check (calories >= 0),
  protein_g  numeric,
  carbs_g    numeric,
  fat_g      numeric,
  confidence numeric
);
create index food_items_meal_idx on food_items (meal_id);

-- Rate limiting. One row per analyse attempt; no Redis.
create table ai_calls (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles on delete cascade,
  created_at timestamptz not null default now()
);
create index ai_calls_user_time_idx on ai_calls (user_id, created_at desc);

-- Row level security. The client cannot send a user_id that works.
alter table profiles   enable row level security;
alter table meals      enable row level security;
alter table food_items enable row level security;
alter table ai_calls   enable row level security;

create policy own_profile on profiles
  for all using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy own_meals on meals
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- food_items has no user_id; ownership is inherited through the meal.
create policy own_food_items on food_items
  for all using (exists (
    select 1 from meals m where m.id = food_items.meal_id and m.user_id = (select auth.uid())
  )) with check (exists (
    select 1 from meals m where m.id = food_items.meal_id and m.user_id = (select auth.uid())
  ));

create policy own_ai_calls on ai_calls
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- A profile row must exist for every auth user, created at signup.
create function handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, name) values (new.id, new.raw_user_meta_data->>'name');
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- Insert a meal and its items atomically, with local_date computed server-side
-- from the caller's stored timezone. Never trusts a client-supplied user_id.
create function log_meal(
  p_meal_type text,
  p_image_key text,
  p_items     jsonb
) returns uuid language plpgsql security invoker set search_path = public as $$
declare
  v_uid  uuid := (select auth.uid());
  v_tz   text;
  v_meal uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select timezone into v_tz from profiles where id = v_uid;
  if v_tz is null then raise exception 'no profile'; end if;

  if jsonb_array_length(p_items) = 0 then raise exception 'meal has no items'; end if;

  -- Aggregate in a subquery so exactly one meal row is always inserted.
  insert into meals (user_id, local_date, meal_type, image_key, calories, protein_g, carbs_g, fat_g)
  select v_uid, (now() at time zone v_tz)::date, p_meal_type, p_image_key, t.cal, t.pro, t.carb, t.fat
  from (
    select coalesce(sum((i->>'calories')::int), 0)      as cal,
           coalesce(sum((i->>'protein_g')::numeric), 0) as pro,
           coalesce(sum((i->>'carbs_g')::numeric), 0)   as carb,
           coalesce(sum((i->>'fat_g')::numeric), 0)     as fat
    from jsonb_array_elements(p_items) i
  ) t
  returning id into v_meal;

  insert into food_items (meal_id, name, quantity, unit, calories, protein_g, carbs_g, fat_g, confidence)
  select v_meal, i->>'name', (i->>'quantity')::numeric, i->>'unit',
         (i->>'calories')::int, (i->>'protein_g')::numeric,
         (i->>'carbs_g')::numeric, (i->>'fat_g')::numeric, (i->>'confidence')::numeric
  from jsonb_array_elements(p_items) i;

  return v_meal;
end $$;
