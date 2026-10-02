-- ============================================================================
-- Concierge Go — 0004 Storage buckets and object policies
--
-- Layout
--   avatars/<profile_id>/<file>            public read, owner write
--   task-attachments/<task_id>/<file>      private, task participants
--   task-proofs/<task_id>/<file>           private, assigned agent writes
--
-- Because the first path segment is always the owning entity id, an object
-- policy can resolve authorization with public.storage_task_id().
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'avatars',
    'avatars',
    true,
    5242880, -- 5 MB
    array['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
  ),
  (
    'task-attachments',
    'task-attachments',
    false,
    26214400, -- 25 MB
    array[
      'image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/heic',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ]
  ),
  (
    'task-proofs',
    'task-proofs',
    false,
    52428800, -- 50 MB (short proof videos)
    array[
      'image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/heic',
      'application/pdf',
      'video/mp4', 'video/quicktime', 'video/webm',
      'text/plain'
    ]
  )
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- avatars
-- ---------------------------------------------------------------------------

create policy "avatars are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "users upload their own avatar"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users replace their own avatar"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users delete their own avatar"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------------
-- task-attachments
-- ---------------------------------------------------------------------------

create policy "task participants read attachments"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'task-attachments'
    and public.can_access_task(public.storage_task_id(name))
  );

create policy "task participants upload attachments"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'task-attachments'
    and public.can_access_task(public.storage_task_id(name))
    and owner = auth.uid()
  );

create policy "uploader removes attachments"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'task-attachments'
    and (owner = auth.uid() or public.is_admin())
  );

-- ---------------------------------------------------------------------------
-- task-proofs
-- ---------------------------------------------------------------------------

create policy "task participants read proofs"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'task-proofs'
    and public.can_access_task(public.storage_task_id(name))
  );

create policy "assigned agents upload proofs"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'task-proofs'
    and owner = auth.uid()
    and (
      public.is_admin()
      or public.is_assigned_agent(public.storage_task_id(name))
    )
  );

create policy "admins remove proofs"
  on storage.objects for delete to authenticated
  using (bucket_id = 'task-proofs' and public.is_admin());
