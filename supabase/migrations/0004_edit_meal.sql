-- Editing a saved meal. The estimate lands in an editable sheet, but until now
-- that say expired the moment you tapped save: the only way to fix a wrong
-- number was to delete the meal, and you cannot re-photograph food you have
-- already eaten. So people left the number wrong, and the day total drifted.

/*
 * Replace a meal's items and re-derive its totals. Same contract as log_meal:
 * totals are summed server-side from the items rather than trusted from the
 * client, and RLS scopes the row, so another user's meal is not found rather
 * than refused. logged_at and local_date are deliberately untouched -- editing
 * a meal corrects it, it does not move it to now.
 */
create function update_meal(
  p_meal_id   uuid,
  p_meal_type text,
  p_items     jsonb
) returns void language plpgsql security invoker set search_path = public as $$
declare
  v_uid   uuid := (select auth.uid());
  v_owned uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if jsonb_array_length(p_items) = 0 then raise exception 'meal has no items'; end if;

  select id into v_owned from meals where id = p_meal_id;
  if v_owned is null then raise exception 'meal not found'; end if;

  update meals m
     set meal_type = p_meal_type,
         calories  = t.cal,
         protein_g = t.pro,
         carbs_g   = t.carb,
         fat_g     = t.fat
    from (
      select coalesce(sum((i->>'calories')::int), 0)      as cal,
             coalesce(sum((i->>'protein_g')::numeric), 0) as pro,
             coalesce(sum((i->>'carbs_g')::numeric), 0)   as carb,
             coalesce(sum((i->>'fat_g')::numeric), 0)     as fat
        from jsonb_array_elements(p_items) i
    ) t
   where m.id = p_meal_id;

  -- Replaced wholesale rather than diffed. The sheet always sends the complete
  -- list, and rows the user can freely add, rename and delete have no stable
  -- identity to diff against. Both statements are in one implicit transaction.
  delete from food_items where meal_id = p_meal_id;

  insert into food_items (meal_id, name, quantity, unit, calories, protein_g, carbs_g, fat_g, confidence)
  select p_meal_id, i->>'name', (i->>'quantity')::numeric, i->>'unit',
         (i->>'calories')::int, (i->>'protein_g')::numeric,
         (i->>'carbs_g')::numeric, (i->>'fat_g')::numeric, (i->>'confidence')::numeric
    from jsonb_array_elements(p_items) i;
end $$;
