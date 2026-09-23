# 🔌 Connect: GitHub · Supabase · Vercel

End-to-end guide to take Find My Seat from this workspace to a live production URL.

```
GitHub (source of truth) → Vercel (hosting) + Supabase (database/auth/storage)
```

---

## Part A — GitHub (5 min)

The project is already a git repo with an initial commit. You just need to create
the remote and push.

### 1. Create the repository

- Go to [github.com/new](https://github.com/new)
- Name: `find-my-seat` (public or private — either works)
- **Do NOT** tick “Add a README / .gitignore / license” (the project already has them)
- Click **Create repository**

### 2. Push from this project

```bash
cd find-my-seat
git remote add origin https://github.com/<YOUR-USERNAME>/find-my-seat.git
git branch -M main
git push -u origin main
```

(If GitHub asks for credentials, use a
[Personal Access Token](https://github.com/settings/tokens) as the password,
or `gh auth login` if you have the GitHub CLI.)

### 3. Done — CI runs automatically

`.github/workflows/ci.yml` typechecks + builds every push/PR to `main`.
A green tick on GitHub means the app is deployable.

> `.env` is git-ignored — secrets can never be pushed by accident.

---

## Part B — Supabase (10 min)

### 1. Create the project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**
2. Name: `find-my-seat`, pick a strong database password, choose the closest region
3. Wait ~2 minutes for provisioning

### 2. Run the migrations (in order!)

Supabase Dashboard → **SQL Editor** → **New query**, then paste & run each file
from `database/migrations/`:

| Order | File | What it does |
|---|---|---|
| 1 | `001_initial_schema.sql` | 8 tables, indexes, `tickets` storage bucket |
| 2 | `002_rls_policies.sql` | Row Level Security (private tickets, admin-only venues) |
| 3 | `003_seed_sample_theatre.sql` | Demo theatre + Screen 4 + 92 seats + QR checkpoints |

Each run should end with `Success. No rows returned`.

### 3. Connect the app locally

```bash
cd find-my-seat
cp .env.example .env
```

Then fill in `.env` from Supabase Dashboard → **Project Settings → API**:

```text
VITE_SUPABASE_URL=https://xyzcompany.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...   (the "anon public" key)
```

> Use the **anon public** key only. The `service_role` key must never go into
> the app — all access is gated by RLS instead.

### 4. Verify the connection

```bash
npm run verify:supabase
```

Expected output:

```text
PASS  REST API reachable — connected
PASS  table: theatres — exists
... (all 8 tables)
PASS  storage bucket: tickets — exists
PASS  seed data: sample theatre — PVR INOX Example Mall
Supabase is fully connected!
```

Restart the dev server (`npm run dev`) — the header badge flips from
**Demo mode** to **Live**.

### 5. Auth providers (optional but recommended)

- **Authentication → Providers → Email**: ON (enabled by default)
- **Google**: ON → add your local URL (`http://localhost:5000`) and later your
  Vercel URL to **Authentication → URL Configuration → Redirect URLs**

### 6. Make yourself admin

After signing up once in the app, run in the SQL Editor:

```sql
update public.users set role = 'admin' where email = 'you@example.com';
```

Re-sign-in → the **Admin** tab unlocks venue management.

---

## Part C — Vercel (5 min)

### 1. Import the repo

1. Go to [vercel.com/new](https://vercel.com/new) → **Import** your `find-my-seat` repo
   (connect GitHub first if prompted)
2. Vercel auto-detects **Vite** from `vercel.json` — keep the defaults:
   - Build command: `npm run build`
   - Output directory: `dist`
3. **Before deploying**, open **Environment Variables** and add:
   - `VITE_SUPABASE_URL` → your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` → your Supabase anon key
4. Click **Deploy** → you get `https://find-my-seat-....vercel.app` 🎉

### 2. After deploy

- Every `git push` to `main` redeploys automatically; PRs get preview URLs
- Add the Vercel URL to Supabase **Authentication → Redirect URLs** (for Google OAuth)
- Custom domain? Vercel Dashboard → project → **Settings → Domains**

> Changing env vars later? Edit them in Vercel → **Deployments → Redeploy**
> (Vite bakes `VITE_*` vars in at build time).

---

## 🧪 End-to-end check on the live URL

1. Open the Vercel URL → header shows **Live** (not Demo mode)
2. Sign up → upload the sample ticket → confirm G18 → navigate → arrive
3. Supabase Dashboard → **Table Editor → tickets** → your ticket row appears
4. **Storage → tickets/** → the uploaded file appears under your user id

---

## 🆘 Troubleshooting

| Symptom | Fix |
|---|---|
| Header still says “Demo mode” on Vercel | Env vars missing/typo'd → add in Vercel project settings → Redeploy |
| `verify:supabase` → table missing | Re-run that migration in SQL Editor (check for errors, run in order) |
| `verify:supabase` → HTTP 401 on everything | Wrong anon key — copy it again from Project Settings → API |
| Vercel build fails | Check the build log; locally run `npm run build`. Node 20 is used by default (see `engines` in `package.json`) |
| Google login loops back | Add the exact Vercel URL (incl. `https://`) to Supabase Redirect URLs |
| `git push` asks for password | Use a Personal Access Token, not your GitHub password |

---

## One-line recap

```bash
# GitHub
git remote add origin https://github.com/<YOU>/find-my-seat.git && git push -u origin main
# Supabase: run 3 SQL migrations → cp .env.example .env → fill keys → npm run verify:supabase
# Vercel: vercel.com/new → import repo → add 2 env vars → Deploy
```
