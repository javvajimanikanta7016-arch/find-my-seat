// Admin-only venue management: theatres, screens, seats,
// navigation points, edges and QR checkpoints.

import {
  Armchair,
  Building2,
  Check,
  Copy,
  Loader2,
  LogIn,
  MapPin,
  MonitorPlay,
  Pencil,
  Plus,
  QrCode,
  RefreshCw,
  Route,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { seatCoords } from '../lib/data/sampleTheatre';
import { useApp } from '../lib/store/appStore';
import {
  adminDelete,
  adminList,
  adminUpsert,
  demoSignIn,
  isSupabaseConfigured,
  resetDemoVenue,
} from '../lib/supabase/client';

type Row = Record<string, unknown>;
type Tab = 'theatres' | 'screens' | 'points' | 'edges' | 'seats' | 'qr';
type AdminKind = 'theatres' | 'screens' | 'seats' | 'navigation_points' | 'navigation_edges';

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));
const num = (v: unknown, fallback = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const POINT_TYPES = [
  'entrance',
  'checkpoint',
  'corridor',
  'stairs',
  'escalator',
  'screen_entry',
  'ticket_check',
  'food_counter',
  'restroom',
];

function Field({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="label">{label}</label>
      <input className="input !py-2.5 text-sm" {...props} />
    </div>
  );
}

export function AdminPage() {
  const { user, isAdmin, setUser, go, notify } = useApp();
  const [tab, setTab] = useState<Tab>('theatres');
  const [busy, setBusy] = useState(false);

  const [theatres, setTheatres] = useState<Row[]>([]);
  const [theatreId, setTheatreId] = useState('');
  const [screens, setScreens] = useState<Row[]>([]);
  const [screenId, setScreenId] = useState('');
  const [points, setPoints] = useState<Row[]>([]);
  const [edges, setEdges] = useState<Row[]>([]);
  const [seats, setSeats] = useState<Row[]>([]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Row>({});

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const loadTheatres = useCallback(async () => {
    setBusy(true);
    try {
      const rows = await adminList('theatres');
      setTheatres(rows);
      setTheatreId((prev) => prev || str(rows[0]?.id));
    } catch {
      notify('Could not load theatres.');
    } finally {
      setBusy(false);
    }
  }, [notify]);

  useEffect(() => {
    if (isAdmin) loadTheatres();
  }, [isAdmin, loadTheatres]);

  useEffect(() => {
    setEditingId(null);
    setForm({});
  }, [tab, theatreId, screenId]);

  const loadScreens = useCallback(async () => {
    if (!theatreId) return;
    setBusy(true);
    try {
      const rows = await adminList('screens', { theatreId });
      setScreens(rows);
      setScreenId((prev) => prev || str(rows[0]?.id));
    } catch {
      notify('Could not load screens.');
    } finally {
      setBusy(false);
    }
  }, [theatreId, notify]);

  const loadPoints = useCallback(async () => {
    if (!theatreId) return;
    setBusy(true);
    try {
      setPoints(await adminList('navigation_points', { theatreId }));
    } catch {
      notify('Could not load navigation points.');
    } finally {
      setBusy(false);
    }
  }, [theatreId, notify]);

  const loadEdges = useCallback(async () => {
    if (!theatreId) return;
    try {
      const pts = await adminList('navigation_points', { theatreId });
      setPoints(pts);
      const ids = pts.map((p) => str(p.id)).filter(Boolean);
      setEdges(ids.length ? await adminList('navigation_edges', { pointIds: ids }) : []);
    } catch {
      notify('Could not load routes.');
    }
  }, [theatreId, notify]);

  const loadSeats = useCallback(async () => {
    if (!screenId) {
      setSeats([]);
      return;
    }
    setBusy(true);
    try {
      setSeats(await adminList('seats', { screenId }));
    } catch {
      notify('Could not load seats.');
    } finally {
      setBusy(false);
    }
  }, [screenId, notify]);

  useEffect(() => {
    if (!isAdmin || !theatreId) return;
    if (tab === 'screens' || tab === 'seats') loadScreens();
    if (tab === 'points' || tab === 'qr') loadPoints();
    if (tab === 'edges') loadEdges();
  }, [isAdmin, theatreId, tab, loadScreens, loadPoints, loadEdges]);

  useEffect(() => {
    if (isAdmin && tab === 'seats' && screenId) loadSeats();
  }, [isAdmin, tab, screenId, loadSeats]);

  if (!isAdmin) {
    return (
      <div className="card space-y-3 text-center">
        <ShieldCheck size={30} className="mx-auto text-zinc-500" />
        <h1 className="text-lg font-extrabold">Admin access required</h1>
        <p className="text-sm text-zinc-400">
          {user
            ? 'Your account is not an admin. Venue data can only be edited by admins.'
            : 'Sign in with an admin account to manage theatres and routes.'}
        </p>
        {!isSupabaseConfigured ? (
          <button
            onClick={() => {
              setUser(demoSignIn('admin@findmyseat.app'));
              notify('Signed in as demo admin.');
            }}
            className="btn-primary"
          >
            <ShieldCheck size={19} /> Enter as demo admin
          </button>
        ) : (
          <button onClick={() => go('auth')} className="btn-primary">
            <LogIn size={19} /> Sign in
          </button>
        )}
      </div>
    );
  }

  const save = async (kind: AdminKind, refresh: () => Promise<void>, extra: Row = {}) => {
    setBusy(true);
    try {
      const payload: Row = editingId ? { ...form, id: editingId } : { ...form };
      Object.assign(payload, extra);
      // Coerce numeric columns (form values are strings); drop blanks.
      for (const k of ['x_position', 'y_position', 'distance', 'latitude', 'longitude', 'seat_number']) {
        if (!(k in payload)) continue;
        const v = payload[k];
        if (v === '' || v === null || v === undefined) {
          if (k === 'distance') payload[k] = 10;
          else if (k === 'x_position' || k === 'y_position') payload[k] = 0;
          else delete payload[k];
        } else if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) {
          payload[k] = Number(v);
        }
      }
      if (payload.qr_code === '') delete payload.qr_code;
      await adminUpsert(kind, payload);
      setForm({});
      setEditingId(null);
      await refresh();
      notify('Saved.');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  };

  const addSeat = async () => {
    const row = str(form.row_name).toUpperCase();
    const n = num(form.seat_number);
    if (!row || !n || !screenId) return;
    const inRow = seats.filter((s) => str(s.row_name) === row).length;
    const { x, y } = seatCoords(row || 'A', n || 1, Math.max(inRow + 1, 12));
    setBusy(true);
    try {
      await adminUpsert('seats', {
        screen_id: screenId,
        row_name: row,
        seat_number: n,
        seat_type: str(form.seat_type || 'standard'),
        x_position: x,
        y_position: y,
      });
      setForm({});
      await loadSeats();
      notify('Saved.');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (kind: AdminKind, id: string, refresh: () => Promise<void>) => {
    if (!window.confirm('Delete this? This cannot be undone.')) return;
    setBusy(true);
    try {
      await adminDelete(kind, id);
      await refresh();
      notify('Deleted.');
    } catch {
      notify('Could not delete.');
    } finally {
      setBusy(false);
    }
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      notify('Copied to clipboard.');
    } catch {
      notify(text);
    }
  };

  const pointName = (id: string) => str(points.find((p) => str(p.id) === id)?.name || id).slice(0, 24);

  const TABS: Array<{ id: Tab; label: string; icon: typeof Building2 }> = [
    { id: 'theatres', label: 'Venues', icon: Building2 },
    { id: 'screens', label: 'Screens', icon: MonitorPlay },
    { id: 'points', label: 'Points', icon: MapPin },
    { id: 'edges', label: 'Routes', icon: Route },
    { id: 'seats', label: 'Seats', icon: Armchair },
    { id: 'qr', label: 'QR', icon: QrCode },
  ];

  const seatRows = [...new Set(seats.map((s) => str(s.row_name)))].sort();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-xl font-extrabold tracking-tight">
          <ShieldCheck size={20} className="text-gold-400" /> Admin
        </h1>
        {!isSupabaseConfigured && (
          <button
            onClick={() => {
              resetDemoVenue();
              loadTheatres();
              notify('Demo venue reset to defaults.');
            }}
            className="btn-ghost !py-2 text-xs"
          >
            <RefreshCw size={14} /> Reset demo data
          </button>
        )}
      </div>

      {!isSupabaseConfigured && (
        <div className="card border-amber-400/30 bg-amber-400/5 text-xs text-amber-200">
          Demo sandbox — edits are stored locally in this browser until Supabase is connected.
        </div>
      )}

      <div className="grid grid-cols-6 gap-1 rounded-xl bg-black/30 p-1 text-[11px] font-bold">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex flex-col items-center gap-1 rounded-lg py-2 transition ${
              tab === t.id ? 'bg-gold-400 text-zinc-950' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {(tab === 'screens' || tab === 'points' || tab === 'edges' || tab === 'seats' || tab === 'qr') && (
        <div className="card !p-3">
          <label className="label" htmlFor="admin-theatre">Theatre</label>
          <select id="admin-theatre" className="input !py-2.5 text-sm" value={theatreId} onChange={(e) => setTheatreId(e.target.value)}>
            {theatres.map((t) => (
              <option key={str(t.id)} value={str(t.id)}>{str(t.name)}</option>
            ))}
          </select>
        </div>
      )}

      {busy && (
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <Loader2 size={16} className="animate-spin" /> Working…
        </div>
      )}

      {/* ------------------------------- THEATRES ------------------------------ */}
      {tab === 'theatres' && (
        <div className="space-y-2">
          {theatres.map((t) => (
            <div key={str(t.id)} className="card flex items-center gap-2 !p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{str(t.name)}</p>
                <p className="truncate text-xs text-zinc-500">{str(t.city)}{str(t.location) ? ` · ${str(t.location)}` : ''}</p>
              </div>
              <button onClick={() => { setEditingId(str(t.id)); setForm({ ...t }); }} className="rounded-lg p-2 text-zinc-400 hover:bg-white/5 hover:text-white" aria-label="Edit theatre">
                <Pencil size={16} />
              </button>
              <button onClick={() => remove('theatres', str(t.id), loadTheatres)} className="rounded-lg p-2 text-red-300/80 hover:bg-red-500/10" aria-label="Delete theatre">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          <div className="card space-y-2">
            <p className="section-title">{editingId ? 'Edit theatre' : 'Add theatre'}</p>
            <Field label="Name" value={str(form.name ?? '')} onChange={set('name')} placeholder="PVR INOX Example Mall" />
            <div className="grid grid-cols-2 gap-2">
              <Field label="City" value={str(form.city ?? '')} onChange={set('city')} placeholder="Hyderabad" />
              <Field label="Location" value={str(form.location ?? '')} onChange={set('location')} placeholder="Example Mall" />
            </div>
            <Field label="Address" value={str(form.address ?? '')} onChange={set('address')} placeholder="Street address" />
            <div className="flex gap-2">
              <button onClick={() => save('theatres', loadTheatres)} className="btn-primary !py-2.5 text-sm" disabled={!str(form.name).trim()}>
                {editingId ? <Check size={17} /> : <Plus size={17} />} {editingId ? 'Save' : 'Add'}
              </button>
              {editingId && (
                <button onClick={() => { setEditingId(null); setForm({}); }} className="btn-ghost border border-white/10 text-sm">
                  <X size={16} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------- SCREENS ------------------------------ */}
      {tab === 'screens' && (
        <div className="space-y-2">
          {screens.map((s) => (
            <div key={str(s.id)} className="card flex items-center gap-2 !p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{str(s.screen_name)}</p>
                <p className="truncate text-xs text-zinc-500">{str(s.floor) || 'Floor —'}</p>
              </div>
              <button onClick={() => { setEditingId(str(s.id)); setForm({ ...s }); }} className="rounded-lg p-2 text-zinc-400 hover:bg-white/5 hover:text-white" aria-label="Edit screen">
                <Pencil size={16} />
              </button>
              <button onClick={() => remove('screens', str(s.id), loadScreens)} className="rounded-lg p-2 text-red-300/80 hover:bg-red-500/10" aria-label="Delete screen">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          <div className="card space-y-2">
            <p className="section-title">{editingId ? 'Edit screen' : 'Add screen'}</p>
            <Field label="Screen name" value={str(form.screen_name ?? '')} onChange={set('screen_name')} placeholder="Screen 4" />
            <Field label="Floor" value={str(form.floor ?? '')} onChange={set('floor')} placeholder="Level 2" />
            <button
              onClick={() => save('screens', loadScreens, { theatre_id: theatreId })}
              className="btn-primary !py-2.5 text-sm"
              disabled={!str(form.screen_name).trim()}
            >
              {editingId ? <Check size={17} /> : <Plus size={17} />} {editingId ? 'Save' : 'Add'}
            </button>
          </div>
        </div>
      )}

      {/* --------------------------------- POINTS ------------------------------ */}
      {tab === 'points' && (
        <div className="space-y-2">
          {points.map((p) => (
            <div key={str(p.id)} className="card flex items-center gap-2 !p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{str(p.name)}</p>
                <p className="truncate text-xs text-zinc-500">
                  {str(p.type)} · ({num(p.x_position)}, {num(p.y_position)}) · {str(p.qr_code) || 'no QR'}
                </p>
              </div>
              <button onClick={() => { setEditingId(str(p.id)); setForm({ ...p }); }} className="rounded-lg p-2 text-zinc-400 hover:bg-white/5 hover:text-white" aria-label="Edit point">
                <Pencil size={16} />
              </button>
              <button onClick={() => remove('navigation_points', str(p.id), loadPoints)} className="rounded-lg p-2 text-red-300/80 hover:bg-red-500/10" aria-label="Delete point">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          <div className="card space-y-2">
            <p className="section-title">{editingId ? 'Edit point' : 'Add navigation point'}</p>
            <Field label="Name" value={str(form.name ?? '')} onChange={set('name')} placeholder="Lobby" />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">Type</label>
                <select className="input !py-2.5 text-sm" value={str(form.type ?? 'checkpoint')} onChange={set('type')}>
                  {POINT_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <Field label="Floor" value={str(form.floor ?? '')} onChange={set('floor')} placeholder="Ground" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Field label="X (0–480)" value={str(form.x_position ?? '')} onChange={set('x_position')} inputMode="numeric" placeholder="240" />
              <Field label="Y (0–600)" value={str(form.y_position ?? '')} onChange={set('y_position')} inputMode="numeric" placeholder="512" />
              <Field label="QR code" value={str(form.qr_code ?? '')} onChange={set('qr_code')} placeholder="FMS-…" />
            </div>
            <button
              onClick={() => save('navigation_points', loadPoints, { theatre_id: theatreId })}
              className="btn-primary !py-2.5 text-sm"
              disabled={!str(form.name).trim()}
            >
              {editingId ? <Check size={17} /> : <Plus size={17} />} {editingId ? 'Save' : 'Add'}
            </button>
          </div>
        </div>
      )}

      {/* --------------------------------- EDGES ------------------------------- */}
      {tab === 'edges' && (
        <div className="space-y-2">
          {edges.map((e) => (
            <div key={str(e.id)} className="card flex items-center gap-2 !p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">
                  {pointName(str(e.from_point_id))} → {pointName(str(e.to_point_id))}
                </p>
                <p className="truncate text-xs text-zinc-500">
                  {num(e.distance, 10)} m · {e.accessible === false ? 'not accessible' : 'accessible'}
                </p>
              </div>
              <button onClick={() => remove('navigation_edges', str(e.id), loadEdges)} className="rounded-lg p-2 text-red-300/80 hover:bg-red-500/10" aria-label="Delete route">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          <div className="card space-y-2">
            <p className="section-title">Connect two points</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">From</label>
                <select className="input !py-2.5 text-sm" value={str(form.from_point_id ?? '')} onChange={set('from_point_id')}>
                  <option value="">—</option>
                  {points.map((p) => (
                    <option key={str(p.id)} value={str(p.id)}>{str(p.name)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">To</label>
                <select className="input !py-2.5 text-sm" value={str(form.to_point_id ?? '')} onChange={set('to_point_id')}>
                  <option value="">—</option>
                  {points.map((p) => (
                    <option key={str(p.id)} value={str(p.id)}>{str(p.name)}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Distance (m)" value={str(form.distance ?? '')} onChange={set('distance')} inputMode="numeric" placeholder="10" />
              <Field label="Direction hint" value={str(form.direction ?? '')} onChange={set('direction')} placeholder="Walk straight…" />
            </div>
            <button
              onClick={() => save('navigation_edges', loadEdges)}
              className="btn-primary !py-2.5 text-sm"
              disabled={!str(form.from_point_id) || !str(form.to_point_id)}
            >
              <Plus size={17} /> Connect
            </button>
          </div>
        </div>
      )}

      {/* --------------------------------- SEATS ------------------------------- */}
      {tab === 'seats' && (
        <div className="space-y-2">
          <div className="card !p-3">
            <label className="label" htmlFor="admin-screen">Screen</label>
            <select id="admin-screen" className="input !py-2.5 text-sm" value={screenId} onChange={(e) => setScreenId(e.target.value)}>
              {screens.map((s) => (
                <option key={str(s.id)} value={str(s.id)}>{str(s.screen_name)}</option>
              ))}
            </select>
          </div>
          <div className="card !p-3 text-sm">
            <p className="section-title">Layout</p>
            <p className="mt-1 text-zinc-300">
              {seats.length} seats ·{' '}
              {seatRows.map((r) => `${r}×${seats.filter((s) => str(s.row_name) === r).length}`).join('  ')}
            </p>
          </div>
          <div className="card space-y-2">
            <p className="section-title">Add a seat</p>
            <div className="grid grid-cols-3 gap-2">
              <Field label="Row" value={str(form.row_name ?? '')} onChange={set('row_name')} placeholder="G" maxLength={2} />
              <Field label="Number" value={str(form.seat_number ?? '')} onChange={set('seat_number')} inputMode="numeric" placeholder="18" />
              <Field label="Type" value={str(form.seat_type ?? 'standard')} onChange={set('seat_type')} placeholder="standard" />
            </div>
            <button
              onClick={addSeat}
              className="btn-primary !py-2.5 text-sm"
              disabled={!str(form.row_name).trim() || !num(form.seat_number)}
            >
              <Plus size={17} /> Add seat
            </button>
            <p className="text-xs text-zinc-500">Map coordinates are computed automatically.</p>
          </div>
        </div>
      )}

      {/* ----------------------------------- QR -------------------------------- */}
      {tab === 'qr' && (
        <div className="space-y-2">
          <div className="card !p-3 text-xs leading-relaxed text-zinc-400">
            Print one QR label per checkpoint and stick it at that spot. Scanning updates the
            visitor&apos;s position; a wrong checkpoint triggers automatic recalculation.
          </div>
          {points.map((p) => (
            <div key={str(p.id)} className="card flex items-center gap-2 !p-3">
              <QrCode size={22} className="shrink-0 text-gold-400" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{str(p.name)}</p>
                <p className="font-mono text-xs text-zinc-400">{str(p.qr_code) || '— no code —'}</p>
              </div>
              {str(p.qr_code) && (
                <button onClick={() => copy(str(p.qr_code))} className="rounded-lg p-2 text-zinc-400 hover:bg-white/5 hover:text-white" aria-label="Copy code">
                  <Copy size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
