-- ============================================================
-- Find My Seat — 003: seed sample theatre (MVP demo data)
-- Theatre: PVR INOX Example Mall, Hyderabad — Screen 4, seat G18 demo
-- Run after 001 + 002. Safe to re-run (uses fixed UUIDs + upserts).
-- Map coordinate space: SVG viewBox 0 0 480 600 (see TheatreMap.tsx)
-- ============================================================

-- ---------- theatre ----------
insert into public.theatres (id, name, location, city, address, latitude, longitude, map_data)
values (
  '10000000-0000-0000-0000-000000000001',
  'PVR INOX Example Mall',
  'Example Mall, 2nd Floor',
  'Hyderabad',
  'Example Mall, Road No. 12, Banjara Hills, Hyderabad 500034',
  17.4235,
  78.4442,
  '{"viewBox": "0 0 480 600", "floors": ["Ground", "Level 2"]}'::jsonb
)
on conflict (id) do update set
  name = excluded.name, location = excluded.location, city = excluded.city,
  address = excluded.address, map_data = excluded.map_data;

-- ---------- screen ----------
insert into public.screens (id, theatre_id, screen_name, floor, seating_layout, map_data)
values (
  '20000000-0000-0000-0000-000000000004',
  '10000000-0000-0000-0000-000000000001',
  'Screen 4',
  'Level 2',
  '{"rows": {"A": 12, "B": 12, "C": 12, "D": 12, "E": 12, "F": 12, "G": 20}}'::jsonb,
  '{}'::jsonb
)
on conflict (id) do update set
  screen_name = excluded.screen_name, floor = excluded.floor,
  seating_layout = excluded.seating_layout;

-- ---------- seats: rows A–F × 12, row G × 20 ----------
-- x = 240 + (n - (count+1)/2) * 16 ; y = 40 + rowIndex * 9
with rowspec(row_name, row_idx, seat_count) as (
  values ('A',0,12),('B',1,12),('C',2,12),('D',3,12),('E',4,12),('F',5,12),('G',6,20)
),
gen as (
  select
    r.row_name,
    s.n as seat_number,
    240 + (s.n - (r.seat_count + 1) / 2.0) * 16 as x,
    40 + r.row_idx * 9 as y,
    case when r.row_name = 'G' then 'recliner' else 'standard' end as seat_type
  from rowspec r
  cross join lateral generate_series(1, r.seat_count) as s(n)
)
insert into public.seats (screen_id, row_name, seat_number, x_position, y_position, seat_type)
select '20000000-0000-0000-0000-000000000004', g.row_name, g.seat_number, g.x, g.y, g.seat_type
from gen g
on conflict (screen_id, row_name, seat_number) do update set
  x_position = excluded.x_position, y_position = excluded.y_position,
  seat_type = excluded.seat_type;

-- ---------- navigation points ----------
insert into public.navigation_points
  (id, theatre_id, screen_id, name, type, x_position, y_position, floor, qr_code)
values
  ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001', null, 'Main Entrance',   'entrance',     240, 566, 'Ground',  'FMS-ENT-01'),
  ('30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001', null, 'Lobby',           'checkpoint',   240, 512, 'Ground',  'FMS-LOB-02'),
  ('30000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001', null, 'Ticket Check',    'checkpoint',   240, 462, 'Ground',  'FMS-TCK-03'),
  ('30000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001', null, 'Corridor A',      'corridor',     240, 408, 'Ground',  'FMS-COR-04'),
  ('30000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000001', null, 'Food Counter',    'food_counter', 140, 408, 'Ground',  'FMS-FOD-05'),
  ('30000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000001', null, 'Restrooms',       'restroom',     340, 408, 'Ground',  'FMS-RES-06'),
  ('30000000-0000-0000-0000-000000000007','10000000-0000-0000-0000-000000000001', null, 'Stairs / Escalator','stairs',     240, 348, 'Ground',  'FMS-STR-07'),
  ('30000000-0000-0000-0000-000000000008','10000000-0000-0000-0000-000000000001', null, 'Level 2 Landing', 'checkpoint',   240, 282, 'Level 2', 'FMS-LVL-08'),
  ('30000000-0000-0000-0000-000000000009','10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004', 'Screen 4 Corridor', 'corridor', 240, 222, 'Level 2', 'FMS-S4C-09'),
  ('30000000-0000-0000-0000-000000000010','10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004', 'Screen 4 Entrance', 'screen_entry', 240, 168, 'Level 2', 'FMS-S4E-10'),
  ('30000000-0000-0000-0000-000000000011','10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004', 'Row G Aisle', 'checkpoint', 240, 108, 'Level 2', 'FMS-AIS-11')
on conflict (id) do update set
  name = excluded.name, type = excluded.type,
  x_position = excluded.x_position, y_position = excluded.y_position,
  floor = excluded.floor, qr_code = excluded.qr_code;

-- ---------- navigation edges (main accessible route + branches) ----------
-- Entrance → Lobby → Ticket Check → Corridor A → Stairs → Landing →
-- Screen 4 Corridor → Screen 4 Entrance → Row G Aisle
with e(from_id, to_id, dist, dir, acc) as (
  values
    ('30000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002', 12, 'Walk straight through the main doors into the lobby', true),
    ('30000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000003', 10, 'Walk straight to the ticket checking counter', true),
    ('30000000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000004', 11, 'Continue straight into Corridor A', true),
    ('30000000-0000-0000-0000-000000000004','30000000-0000-0000-0000-000000000007', 13, 'Walk to the end of the corridor to the stairs', true),
    ('30000000-0000-0000-0000-000000000007','30000000-0000-0000-0000-000000000008', 9,  'Take the stairs or escalator up to Level 2', true),
    ('30000000-0000-0000-0000-000000000008','30000000-0000-0000-0000-000000000009', 12, 'Turn into the Screen 4 corridor', true),
    ('30000000-0000-0000-0000-000000000009','30000000-0000-0000-0000-000000000010', 11, 'Walk to the Screen 4 entrance', true),
    ('30000000-0000-0000-0000-000000000010','30000000-0000-0000-0000-000000000011', 10, 'Enter Screen 4 and walk down to the Row G aisle', true),
    ('30000000-0000-0000-0000-000000000004','30000000-0000-0000-0000-000000000005', 14, 'Food counter is on your left', true),
    ('30000000-0000-0000-0000-000000000004','30000000-0000-0000-0000-000000000006', 14, 'Restrooms are on your right', true)
)
insert into public.navigation_edges (from_point_id, to_point_id, distance, direction, accessible)
select e.from_id::uuid, e.to_id::uuid, e.dist, e.dir, e.acc from e
on conflict do nothing;

-- keep connected_points in sync (informational; edges are the source of truth)
update public.navigation_points p
set connected_points = sub.ids
from (
  select n.id, coalesce(array_agg(e2.to_point_id), '{}') as ids
  from public.navigation_points n
  left join public.navigation_edges e2 on e2.from_point_id = n.id
  group by n.id
) sub
where p.id = sub.id;
