-- Private bucket for meal photos. Never public: reads go through short-lived
-- signed URLs created server-side.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('meal-images', 'meal-images', false, 8388608,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- A user may only touch objects inside their own {user_id}/ folder. This is the
-- storage twin of the table RLS: the path prefix is the ownership check.
create policy own_meal_images_read on storage.objects
  for select using (
    bucket_id = 'meal-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy own_meal_images_insert on storage.objects
  for insert with check (
    bucket_id = 'meal-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy own_meal_images_delete on storage.objects
  for delete using (
    bucket_id = 'meal-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
