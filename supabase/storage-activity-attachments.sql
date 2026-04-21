-- Bucket + RLS for activity attachments. Run manually in the Supabase SQL editor
-- (or via the Storage UI for the bucket creation step) once after the
-- 20260418_add_activity_notes_attachments Prisma migration has been applied.

-- Create the private bucket. file_size_limit caps individual uploads at 25MB.
insert into storage.buckets (id, name, public, file_size_limit)
values ('activity-attachments', 'activity-attachments', false, 26214400)
on conflict (id) do update set file_size_limit = excluded.file_size_limit;

-- READ: any authenticated user who owns the activity, attended it, or
-- attendees-of-record on the activity can read the blob.
drop policy if exists "Read attachments for own/attended activities" on storage.objects;
create policy "Read attachments for own/attended activities"
  on storage.objects
  for select
  using (
    bucket_id = 'activity-attachments'
    and exists (
      select 1
      from public.activity_attachments aa
      join public.activities a on a.id = aa.activity_id
      left join public.activity_attendees att
        on att.activity_id = a.id and att.user_id = auth.uid()
      where aa.storage_path = storage.objects.name
        and (a.created_by_user_id = auth.uid() or att.user_id is not null)
    )
  );

-- INSERT: any authenticated user. The route handler validates that the user
-- owns or attends the target activity before writing the row + blob.
drop policy if exists "Authenticated users can upload attachments" on storage.objects;
create policy "Authenticated users can upload attachments"
  on storage.objects
  for insert
  with check (
    bucket_id = 'activity-attachments'
    and auth.role() = 'authenticated'
  );

-- DELETE: only the uploader can remove their own blob.
drop policy if exists "Uploaders can delete own attachments" on storage.objects;
create policy "Uploaders can delete own attachments"
  on storage.objects
  for delete
  using (
    bucket_id = 'activity-attachments'
    and exists (
      select 1
      from public.activity_attachments aa
      where aa.storage_path = storage.objects.name
        and aa.uploaded_by_id = auth.uid()
    )
  );
