# 🎬 Find My Seat

> **Give us your ticket. We'll show you exactly how to reach your seat.**

A modern, mobile-first web app that reads a movie ticket (BookMyShow, District, …),
extracts the exact seat, and guides the user step-by-step through an indoor theatre
map to their seat — **Upload → Extract → Confirm → Navigate → Arrive**.

Built for **Replit** deployment with **Supabase** as the database, auth, storage and
backend layer. Works in **demo mode** with zero configuration (sample theatre
included), and lights up Supabase features automatically once credentials are set.

---

## ✨ Features (MVP)

- 📤 **Ticket upload** — screenshot / JPG / PNG / PDF (+ camera capture on mobile)
- 🔍 **On-device OCR** (Tesseract.js) + smart ticket parser for BookMyShow / District
- ✅ **Ticket confirmation** screen with per-field editing + confidence indicator
- 🏛️ **Theatre matching** against Supabase (graceful "not supported yet" state)
- 🗺️ **Interactive indoor SVG map** — entrance → lobby → corridors → screen → seat
- 🧭 **Dijkstra pathfinding** over the Supabase navigation graph → plain-language steps
- 📷 **QR checkpoint system** — camera scan, code entry, or tap-to-simulate; off-route recalculation
- 🎉 **Arrival screen** with highlighted seat
- 🔐 **Supabase Auth** — email/password + Google OAuth, RLS-protected data
- 🛠️ **Admin dashboard** — manage theatres, screens, seats, nav points, edges, QR codes
- 📱 **Mobile-first dark cinema UI** with large touch targets

---

## 🚀 Quick start (Replit)

1. **Import / create** this project in Replit (Node.js).
2. Open **Secrets** (🔒 in the left sidebar) and add:
   - `VITE_SUPABASE_URL` → your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` → your Supabase anon/public key
3. Press **Run**. Replit executes `npm run dev` (see `.replit`).
4. Open the preview → the app starts on mobile-friendly home screen.

> No Supabase credentials? The app runs in **demo mode** with a built-in sample
> theatre (PVR INOX Example Mall, Screen 4, seat G18) and local session history.
> A banner shows which mode is active.

### Local development (outside Replit)

```bash
cd find-my-seat
cp .env.example .env   # then fill in VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
npm install
npm run dev            # → http://localhost:5000
```

### Production build / deploy

```bash
npm run build      # typecheck + vite build → dist/
npm run preview    # serve the production build (Replit deployment uses this)
```

On Replit: **Deploy → Autoscale / Reserved VM**, build command `npm run build`,
run command `npm run preview`.

---

## 🔌 Connect: GitHub · Supabase · Vercel

Full step-by-step guide: **[DEPLOY.md](./DEPLOY.md)**

```bash
# GitHub — push the repo (CI builds every push to main)
git remote add origin https://github.com/<YOU>/find-my-seat.git && git push -u origin main

# Supabase — run the 3 SQL migrations, then:
cp .env.example .env   # fill in keys
npm run verify:supabase

# Vercel — vercel.com/new → import repo → add the 2 VITE_* env vars → Deploy
```

---

## 🗄️ Supabase setup

### 1. Create a project

Create a free project at [supabase.com](https://supabase.com), then copy
**Project URL** and **anon public key** into Replit Secrets / `.env`.

### 2. Run the migrations (in order)

Supabase Dashboard → **SQL Editor** → run each file from `database/migrations/`:

1. `001_initial_schema.sql` — tables, indexes, `tickets` storage bucket, `is_admin()`
2. `002_rls_policies.sql` — Row Level Security (users see only their own tickets,
   private per-user storage paths, admin-only venue writes)
3. `003_seed_sample_theatre.sql` — sample theatre + Screen 4 + 92 seats +
   11 navigation points + route edges (the G18 demo)

### 3. Auth

- **Authentication → Providers**: enable **Email** (and **Google** for OAuth —
  add your Replit/prod URL to redirect URLs).
- After a user signs up, a row is expected in `public.users`. The app creates it
  automatically on first login (see `ensureProfile` in `src/lib/supabase/client.ts`).
- **Make an admin**: in SQL Editor —
  `update public.users set role = 'admin' where email = 'you@example.com';`

### 4. Storage

The `tickets` bucket is created by migration 001 (private). Uploaded files live at
`tickets/{user_id}/{ticket_id}/{filename}` and are readable only by their owner.

### Tables

| Table | Purpose |
|---|---|
| `users` | Profile rows linked to `auth.users` (+ `role`) |
| `theatres` | Supported venues + map metadata |
| `screens` | Auditoriums per theatre |
| `seats` | Individual seats with map coordinates |
| `navigation_points` | Entrances, corridors, stairs, checkpoints, QR codes |
| `navigation_edges` | Routable connections (distance, direction, accessible) |
| `tickets` | Parsed user tickets + upload URL + confidence |
| `navigation_sessions` | Active/completed guidance sessions |

---

## 🧭 The core flow

```
Upload Ticket → OCR + Parse → Confirm Seat → Match Theatre
     → Indoor Map → Pick/Scan Start → Dijkstra Route
     → Follow Steps (+ QR checkpoints) → 🎬 Arrived at G18
```

- **OCR**: images via Tesseract.js in-browser; PDFs via pdf.js (native text first,
  OCR render fallback). Nothing leaves the device except the stored upload.
- **Parsing**: `src/lib/ocr/ticketParser.ts` extracts platform, movie, theatre,
  screen, showtime, row + seat with a confidence score.
- **Routing**: `src/lib/navigation/graph.ts` (Dijkstra) +
  `src/lib/navigation/instructions.ts` (legs → human steps + ETA).
- **Checkpoints**: each nav point has a `qr_code` (e.g. `FMS-ENT-01`). Scanning a
  checkpoint off the expected path triggers *"You're slightly off route.
  Recalculating…"*.

---

## 🗂️ Project structure

```
find-my-seat/
├── src/
│   ├── main.tsx                  # entry
│   ├── App.tsx                   # view router + providers
│   ├── index.css                 # tailwind + theme
│   ├── types/index.ts            # shared TypeScript types
│   ├── lib/
│   │   ├── supabase/client.ts    # supabase client + data layer (+demo fallback)
│   │   ├── ocr/ticketOcr.ts      # tesseract.js + pdf.js extraction
│   │   ├── ocr/ticketParser.ts   # ticket text → structured seat data
│   │   ├── navigation/graph.ts   # Dijkstra over nav graph
│   │   ├── navigation/instructions.ts  # path → human steps, ETA
│   │   ├── data/sampleTheatre.ts # sample venue + demo ticket
│   │   └── store/appStore.tsx    # global flow state (React context)
│   ├── components/
│   │   ├── Layout.tsx            # header, tabs, toasts
│   │   ├── AuthForm.tsx          # login / signup / Google / demo
│   │   ├── TicketUploader.tsx    # file/camera/sample + OCR progress
│   │   ├── TicketConfirm.tsx     # editable confirmation + confidence
│   │   ├── TheatreMap.tsx        # indoor SVG map + seating map
│   │   └── Navigate.tsx          # guidance UI + QR scanner + arrival
│   └── pages/
│       ├── HomePage.tsx
│       ├── MyTicketsPage.tsx
│       └── AdminPage.tsx
├── database/migrations/          # 001 schema, 002 RLS, 003 seed
├── public/                       # icon + printable sample ticket
├── .env.example                  # required env vars (no secrets inside)
├── .replit                       # Replit run + deploy config
└── package.json
```

---

## 🔒 Security notes

- No keys are hard-coded; the anon key is public-by-design and all access is
  gated by **RLS**. The `service_role` key is **never** used in the frontend.
- Uploads: 10 MB limit, image/PDF allow-list, per-user private storage paths.
- OCR text is parsed locally; only structured ticket fields are stored.
- Admin routes check `users.role = 'admin'` (Supabase) / demo-admin flag (demo).
- Errors never leak backend details to the UI.

---

## 🧪 Demo script (60 seconds, no login needed)

1. Home → **Upload Ticket** → **Use sample ticket** (or upload
   `public/sample-ticket.svg` as a screenshot to exercise real OCR).
2. Confirm **Screen 4 · Row G · Seat 18** → **Confirm Seat**.
3. Theatre map appears with the highlighted route. Pick **Main Entrance** →
   **Start Navigation**.
4. Tap **Scan checkpoint** → pick checkpoints (or enter codes like `FMS-LOB-02`)
   to walk the route. Scan a wrong one to see recalculation.
5. Arrive → **🎬 You've Arrived! Row G · Seat 18. Enjoy the movie! 🍿**

---

## 🛣️ Roadmap

AR arrows · voice guidance · wheelchair-accessible routing · multi-floor maps ·
parking-to-seat · more venues (stadiums, airports, malls). The nav-graph schema
already supports all of these (floors, `accessible` edges, typed points).

---

Made for moviegoers who are tired of squinting at row letters in the dark. 🍿
