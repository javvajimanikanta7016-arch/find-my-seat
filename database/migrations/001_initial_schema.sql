-- ============================================================
-- Find My Seat — 001: initial schema
-- Run this in Supabase Dashboard → SQL Editor (in order).
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- users (profile rows linked to Supabase Auth) ----------
create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  name text,
  email text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

-- ---------- theatres ----------
create table if not exists public.theatres (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text,
  city text,
  address text,
  latitude double precision,
  longitude double precision,
  map_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists theatres_name_idx on public.theatres (name);
create index if not exists theatres_city_idx on public.theatres (city);

-- ---------- screens ----------
create table if not exists public.screens (
  id uuid primary key default gen_random_uuid(),
  theatre_id uuid not null references public.theatres (id) on delete cascade,
  screen_name text not null,
  floor text,
  seating_layout jsonb not null default '{}'::jsonb,
  map_data jsonb not null default '{}'::jsonb
);
create index if not exists screens_theatre_idx on public.screens (theatre_id);

-- ---------- seats ----------
create table if not exists public.seats (
  id uuid primary key default gen_random_uuid(),
  screen_id uuid not null references public.screens (id) on delete cascade,
  row_name text not null,
  seat_number integer not null,
  x_position double precision,
  y_position double precision,
  seat_type text not null default 'standard',
  accessibility_info text,
  unique (screen_id, row_name, seat_number)
);
create index if not exists seats_screen_idx on public.seats (screen_id);

-- ---------- navigation_points ----------
create table if not exists public.navigation_points (
  id uuid primary key default gen_random_uuid(),
  theatre_id uuid not null references public.theatres (id) on delete cascade,
  screen_id uuid references public.screens (id) on delete set null,
  name text not null,
  type text not null default 'checkpoint',
  x_position double precision not null default 0,
  y_position double precision not null default 0,
  floor text,
  qr_code text unique,
  connected_points uuid[] not null default '{}'
);
create index if not exists nav_points_theatre_idx on public.navigation_points (theatre_id);

-- ---------- navigation_edges ----------
create table if not exists public.navigation_edges (
  id uuid primary key default gen_random_uuid(),
  from_point_id uuid not null references public.navigation_points (id) on delete cascade,
  to_point_id uuid not null references public.navigation_points (id) on delete cascade,
  distance double precision,
  direction text,
  accessible boolean not null default true,
  check (from_point_id <> to_point_id)
);
create index if not exists nav_edges_from_idx on public.navigation_edges (from_point_id);
create index if not exists nav_edges_to_idx on public.navigation_edges (to_point_id);

-- ---------- tickets ----------
create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  booking_platform text,
  theatre_id uuid references public.theatres (id) on delete set null,
  movie_name text,
  screen_id uuid references public.screens (id) on delete set null,
  show_time text,
  row_name text,
  seat_number text,
  uploaded_file_url text,
  extraction_confidence integer,
  created_at timestamptz not null default now()
);
create index if not exists tickets_user_idx on public.tickets (user_id);

-- ---------- navigation_sessions ----------
create table if not exists public.navigation_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  ticket_id uuid references public.tickets (id) on delete set null,
  starting_point uuid references public.navigation_points (id) on delete set null,
  destination_seat uuid references public.seats (id) on delete set null,
  current_navigation_point uuid references public.navigation_points (id) on delete set null,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists nav_sessions_user_idx on public.navigation_sessions (user_id);

-- ---------- storage bucket for ticket uploads ----------
insert into storage.buckets (id, name, public)
values ('tickets', 'tickets', false)
on conflict (id) do nothing;

-- ---------- helper: is the current user an admin? ----------
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role = 'admin'
  );
$$;
