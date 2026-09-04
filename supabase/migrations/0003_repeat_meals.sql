-- Repeating a meal. Most meals are meals you have eaten before, so re-logging
-- one is a copy of rows you already own -- never a second photo, never a second
-- AI call. "Recent", "frequent" and "favourite" are three orderings of one list,
-- so there is one function behind all of them, not three tables.

alter table meals add column is_favourite boolean not null default false;

-- Partial: favourites are a handful of rows out of every meal ever logged.
create index meals_user_favourite_idx on meals (user_id) where is_favourite;

/*
 * The re-log picker. Collapses repeats of the same meal into one row keyed by
 * its sorted item names, so eating oats every morning is one suggestion with a
 * count, not thirty identical ones. Ordered favourites, then most eaten, then
 * most recent -- which is what "quick log the things I actually eat" means.
 */
create function meal_suggestions(p_limit int default 12)
returns table (
  meal_id      uuid,
  label        text,
  calories     int,
  image_key    text,
  is_favourite boolean,
  times_logged int,
  last_logged  timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  with mine as (
    select m.id, m.calories, m.image_key, m.is_favourite, m.logged_at,
           -- Identity of a meal is what was in it, normalised and order-free.
           (select string_agg(lower(btrim(fi.name)), '|' order by lower(btrim(fi.name)))
              from food_items fi where fi.meal_id = m.id) as signature,
           -- Biggest item first: the label has to make sense truncated.
           (select string_agg(fi.name, ' · ' order by fi.calories desc, fi.name)
              from food_items fi where fi.meal_id = m.id) as label
      from meals m
     where m.user_id = (select auth.uid())
  ),
  grouped as (
    select *,
           row_number() over (partition by signature order by logged_at desc) as newest,
           count(*) over (partition by signature)                             as eaten,
           bool_or(is_favourite) over (partition by signature)                as starred
      from mine
     where signature is not null
  )
  -- One row per distinct meal: the most recent copy, since its photo is likeliest to still exist.
  select id, label, calories, image_key, starred, eaten::int, logged_at
    from grouped
   where newest = 1
   order by starred desc, eaten desc, logged_at desc
   limit greatest(1, least(p_limit, 50));
$$;

/*
 * Log an earlier meal again, onto today. Same shape as log_meal: the date is
 * computed server-side from the caller's timezone and the user id is never
 * taken from the client. RLS scopes the source select, so another user's meal
 * is simply not found rather than refused.
 */
create function repeat_meal(p_meal_id uuid, p_meal_type text)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_tz  text;
  v_new uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select timezone into v_tz from profiles where id = v_uid;
  if v_tz is null then raise exception 'no profile'; end if;

  -- The photo is shared with the original, not re-uploaded. Deletion accounts
  -- for that by only dropping the object when the last meal using it goes.
  insert into meals (user_id, local_date, meal_type, image_key, calories, protein_g, carbs_g, fat_g)
  select v_uid, (now() at time zone v_tz)::date, p_meal_type, m.image_key,
         m.calories, m.protein_g, m.carbs_g, m.fat_g
    from meals m
   where m.id = p_meal_id
  returning id into v_new;

  if v_new is null then raise exception 'meal not found'; end if;

  insert into food_items (meal_id, name, quantity, unit, calories, protein_g, carbs_g, fat_g, confidence)
  select v_new, fi.name, fi.quantity, fi.unit, fi.calories,
         fi.protein_g, fi.carbs_g, fi.fat_g, fi.confidence
    from food_items fi
   where fi.meal_id = p_meal_id;

  return v_new;
end $$;
