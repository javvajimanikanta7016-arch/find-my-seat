-- ============================================================
-- Find My Seat — 002: Row Level Security policies
-- Run after 001_initial_schema.sql
-- ============================================================

-- ---------- enable RLS ----------
alter table public.users enable row level security;
alter table public.theatres enable row level security;
alter table public.screens enable row level security;
alter table public.seats enable row level security;
alter table public.navigation_points enable row level security;
alter table public.navigation_edges enable row level security;
alter table public.tickets enable row level security;
alter table public.navigation_sessions enable row level security;

-- ---------- users ----------
create policy "users_select_own"
  on public.users for select
  using (auth.uid() = id or public.is_admin());

create policy "users_insert_own"
  on public.users for insert
  with check (auth.uid() = id);

create policy "users_update_own"
  on public.users for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ---------- theatres / screens / seats / nav graph: public read, admin write ----------
create policy "theatres_read_all"
  on public.theatres for select using (true);
create policy "theatres_admin_write"
  on public.theatres for all
  using (public.is_admin()) with check (public.is_admin());

create policy "screens_read_all"
  on public.screens for select using (true);
create policy "screens_admin_write"
  on public.screens for all
  using (public.is_admin()) with check (public.is_admin());

create policy "seats_read_all"
  on public.seats for select using (true);
create policy "seats_admin_write"
  on public.seats for all
  using (public.is_admin()) with check (public.is_admin());

create policy "nav_points_read_all"
  on public.navigation_points for select using (true);
create policy "nav_points_admin_write"
  on public.navigation_points for all
  using (public.is_admin()) with check (public.is_admin());

create policy "nav_edges_read_all"
  on public.navigation_edges for select using (true);
create policy "nav_edges_admin_write"
  on public.navigation_edges for all
  using (public.is_admin()) with check (public.is_admin());

-- ---------- tickets: users only see their own ----------
create policy "tickets_select_own"
  on public.tickets for select
  using (auth.uid() = user_id or public.is_admin());

create policy "tickets_insert_own"
  on public.tickets for insert
  with check (auth.uid() = user_id);

create policy "tickets_update_own"
  on public.tickets for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "tickets_delete_own"
  on public.tickets for delete
  using (auth.uid() = user_id or public.is_admin());

-- ---------- navigation_sessions: users only see their own ----------
create policy "sessions_select_own"
  on public.navigation_sessions for select
  using (auth.uid() = user_id or public.is_admin());

create policy "sessions_insert_own"
  on public.navigation_sessions for insert
  with check (auth.uid() = user_id);

create policy "sessions_update_own"
  on public.navigation_sessions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------- storage: private per-user ticket uploads ----------
-- Files are stored at: tickets/{user_id}/{ticket_id}/{filename}

create policy "tickets_storage_select_own"
  on storage.objects for select
  using (
    bucket_id = 'tickets'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "tickets_storage_insert_own"
  on storage.objects for insert
  with check (
    bucket_id = 'tickets'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "tickets_storage_delete_own"
  on storage.objects for delete
  using (
    bucket_id = 'tickets'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
