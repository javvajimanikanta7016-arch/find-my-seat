// Flow screens: Upload → Confirm → Map → Navigate → Arrive.

import {
  AlertTriangle,
  Armchair,
  ChevronLeft,
  Clapperboard,
  Info,
  Lightbulb,
  Loader2,
  MapPin,
  Navigation as NavIcon,
  QrCode,
  Upload,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { TicketDraft } from '../types';
import { useApp } from '../lib/store/appStore';
import { SeatingMap, TheatreMap } from './TheatreMap';
import { TicketConfirm } from './TicketConfirm';
import { TicketUploader } from './TicketUploader';
import { ArrivalScreen, CheckpointScanner, NavigationView } from './Navigate';

// ---------------------------------------------------------------- Upload ---

export function UploadView() {
  const { go } = useApp();
  return (
    <div className="space-y-4">
      <button onClick={() => go('home')} className="btn-ghost !px-2">
        <ChevronLeft size={18} /> Home
      </button>
      <div>
        <h1 className="flex items-center gap-2 text-xl font-extrabold tracking-tight">
          <Upload size={20} className="text-gold-400" /> Upload your ticket
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          We&apos;ll read it and guide you to your exact seat.
        </p>
      </div>
      <TicketUploader />
      <div className="card space-y-1.5 text-sm text-zinc-300">
        <p className="flex items-center gap-2 font-bold text-zinc-100">
          <Lightbulb size={16} className="text-gold-400" /> Tips for a clean scan
        </p>
        <p className="text-[13px] text-zinc-400">
          • Use a bright screenshot — avoid glare and cropping the seat line.
        </p>
        <p className="text-[13px] text-zinc-400">
          • PDFs work too — we read the first page.
        </p>
        <p className="text-[13px] text-zinc-400">
          • No ticket handy?{' '}
          <a href="/sample-ticket.svg" download className="font-semibold text-gold-300 underline">
            Download the sample ticket
          </a>{' '}
          and upload it to try real OCR.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Confirm --

export function ConfirmView() {
  const { draft, setDraft, confirmTicket, matchResult, useDemoTheatre, go, notify } = useApp();
  const [showForm, setShowForm] = useState(true);
  const [busy, setBusy] = useState(false);

  if (!draft) {
    return (
      <div className="card space-y-3 text-center">
        <p className="font-bold">No ticket yet.</p>
        <p className="text-sm text-zinc-400">Upload a ticket first.</p>
        <button onClick={() => go('upload')} className="btn-primary">Upload ticket</button>
      </div>
    );
  }

  const handleConfirm = async (final: TicketDraft) => {
    setDraft(final);
    setShowForm(false);
    setBusy(true);
    const result = await confirmTicket(final);
    setBusy(false);
    if (result === 'found') {
      go('map');
    } else if (result === 'unsupported') {
      notify("This theatre isn't supported yet.");
    }
  };

  if (busy || matchResult === 'searching') {
    return (
      <div className="card flex items-center gap-3">
        <Loader2 size={22} className="animate-spin text-gold-400" />
        <div>
          <p className="text-sm font-bold">Finding your theatre…</p>
          <p className="text-xs text-zinc-400">Matching “{draft.theatre || '…'}” to our venues.</p>
        </div>
      </div>
    );
  }

  if (matchResult === 'unsupported' && !showForm) {
    return (
      <div className="space-y-3">
        <div className="card space-y-2 text-center">
          <MapPin size={30} className="mx-auto text-zinc-500" />
          <h2 className="text-lg font-extrabold">This theatre isn&apos;t supported yet.</h2>
          <p className="text-sm text-zinc-400">
            We don&apos;t have an indoor map for{' '}
            <span className="font-semibold text-zinc-200">“{draft.theatre || 'this theatre'}”</span>{' '}
            yet.
          </p>
        </div>
        <button
          onClick={async () => {
            await useDemoTheatre();
            go('map');
          }}
          className="btn-primary"
        >
          <NavIcon size={19} /> Explore with the demo theatre
        </button>
        <button
          onClick={() => {
            try {
              const key = 'fms_theatre_requests';
              const prev = JSON.parse(localStorage.getItem(key) || '[]') as string[];
              prev.push(draft.theatre || 'unknown');
              localStorage.setItem(key, JSON.stringify(prev.slice(-50)));
            } catch {
              /* ignore */
            }
            notify('Thanks! We noted this theatre for future support.');
          }}
          className="btn-secondary"
        >
          Request this theatre
        </button>
        <button onClick={() => setShowForm(true)} className="btn-ghost mx-auto">
          Edit ticket details
        </button>
      </div>
    );
  }

  if (matchResult === 'error' && !showForm) {
    return (
      <div className="card space-y-3 text-center">
        <AlertTriangle size={30} className="mx-auto text-red-300" />
        <h2 className="text-lg font-extrabold">Something went wrong</h2>
        <p className="text-sm text-zinc-400">
          We couldn&apos;t match your theatre. Check the details and try again.
        </p>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          Edit ticket details
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button onClick={() => go('upload')} className="btn-ghost !px-2">
        <ChevronLeft size={18} /> Upload
      </button>
      <div>
        <h1 className="text-xl font-extrabold tracking-tight">Is this your seat?</h1>
        <p className="mt-1 text-sm text-zinc-400">Confirm before we map your route.</p>
      </div>
      <TicketConfirm initial={draft} busy={busy} onConfirm={handleConfirm} />
    </div>
  );
}

// ------------------------------------------------------------------- Map ---

export function MapView() {
  const {
    theatre,
    screens,
    screen,
    selectScreen,
    seats,
    points,
    edges,
    confirmed,
    destSeat,
    matchError,
    pathIds,
    routePoints,
    routeEdges,
    legs,
    totalDistance,
    etaMinutes,
    beginNavigation,
    go,
  } = useApp();
  const [tab, setTab] = useState<'theatre' | 'seats'>('theatre');
  const [scannerOpen, setScannerOpen] = useState(false);

  const checkpoints = points.filter((p) => p.type !== 'seat');
  const defaultStart =
    checkpoints.find((p) => p.type === 'entrance')?.id ?? checkpoints[0]?.id ?? '';
  const [selected, setSelected] = useState(defaultStart);
  useEffect(() => {
    if (!selected && defaultStart) setSelected(defaultStart);
  }, [defaultStart, selected]);

  if (!theatre || !confirmed) {
    return (
      <div className="card space-y-3 text-center">
        <p className="font-bold">No trip planned yet.</p>
        <p className="text-sm text-zinc-400">Upload a ticket to see your theatre map.</p>
        <button onClick={() => go('upload')} className="btn-primary">Upload ticket</button>
      </div>
    );
  }

  const mapPoints = pathIds.length ? routePoints : points;
  const mapEdges = pathIds.length ? routeEdges : edges;
  const hasRoute = pathIds.length > 0 && legs.length > 0;

  const startFromScan = (input: string): { ok: boolean; message: string } => {
    const q = input.trim().toLowerCase();
    const hit = points.find(
      (p) =>
        (p.qr_code ?? '').toLowerCase() === q ||
        p.id.toLowerCase() === q ||
        p.name.toLowerCase() === q,
    );
    if (!hit) {
      return { ok: false, message: "We couldn't recognize this checkpoint. Please try again." };
    }
    setScannerOpen(false);
    beginNavigation(hit.id);
    return { ok: true, message: `Starting from ${hit.name}` };
  };

  return (
    <div className="space-y-3">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-extrabold tracking-tight">
          <Clapperboard size={20} className="text-gold-400" /> {theatre.name}
        </h1>
        <p className="mt-0.5 text-sm text-zinc-400">
          {confirmed.movie || 'Your movie'}
          {confirmed.showTime ? ` · ${confirmed.showTime}` : ''}
        </p>
      </div>

      <div className="card flex items-center gap-3 !p-3">
        <Armchair size={26} className="shrink-0 text-gold-400" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Your seat</p>
          <p className="text-lg font-extrabold leading-tight">
            {confirmed.row}
            {confirmed.seat}
            <span className="ml-2 text-xs font-semibold text-zinc-400">
              Row {confirmed.row} · Seat {confirmed.seat}
            </span>
          </p>
        </div>
        <div className="w-32 shrink-0">
          <label className="label !mb-1" htmlFor="screen-pick">Screen</label>
          <select
            id="screen-pick"
            className="input !py-2 text-sm"
            value={screen?.id ?? ''}
            onChange={(e) => selectScreen(e.target.value)}
          >
            {screens.map((s) => (
              <option key={s.id} value={s.id}>{s.screen_name}</option>
            ))}
          </select>
        </div>
      </div>

      {matchError && (
        <div className="card flex items-start gap-2 border-sky-400/30 bg-sky-400/5 text-sm text-sky-200">
          <Info size={16} className="mt-0.5 shrink-0" /> {matchError}
        </div>
      )}

      <div className="grid grid-cols-2 gap-1 rounded-xl bg-black/30 p-1 text-sm font-bold">
        {(['theatre', 'seats'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg py-2.5 capitalize transition ${
              tab === t ? 'bg-gold-400 text-zinc-950' : 'text-zinc-400 hover:text-white'
            }`}
          >
            {t === 'theatre' ? 'Theatre map' : 'Seats'}
          </button>
        ))}
      </div>

      <div className="card !p-2">
        {tab === 'theatre' ? (
          <TheatreMap
            points={mapPoints}
            edges={mapEdges}
            seats={seats}
            pathIds={pathIds}
            currentId={null}
            destSeat={destSeat}
          />
        ) : (
          <SeatingMap seats={seats} destSeat={destSeat} screenName={screen?.screen_name} />
        )}
      </div>

      {hasRoute ? (
        <div className="card space-y-2 border-gold-400/30">
          <p className="text-sm font-bold">
            Route ready · {totalDistance} m · ~{etaMinutes} min
          </p>
          <button onClick={() => go('navigate')} className="btn-primary">
            <NavIcon size={19} /> Resume navigation
          </button>
          <p className="text-center text-xs text-zinc-500">or start over from a new point below</p>
        </div>
      ) : null}

      <div className="card space-y-2">
        <label className="label" htmlFor="start-pick">Where are you starting from?</label>
        <select
          id="start-pick"
          className="input"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          {checkpoints.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}{p.floor ? ` · ${p.floor}` : ''}
            </option>
          ))}
        </select>
        <button onClick={() => selected && beginNavigation(selected)} className="btn-primary" disabled={!selected}>
          <NavIcon size={19} /> Start Navigation
        </button>
        <button onClick={() => setScannerOpen(true)} className="btn-secondary">
          <QrCode size={19} /> Scan start QR instead
        </button>
      </div>

      {scannerOpen && (
        <CheckpointScanner onClose={() => setScannerOpen(false)} onScan={startFromScan} />
      )}
    </div>
  );
}

// -------------------------------------------------------------- Navigate ---

export function NavigateView() {
  const { legs, go } = useApp();
  if (!legs.length) {
    return (
      <div className="card space-y-3 text-center">
        <p className="font-bold">No active route.</p>
        <p className="text-sm text-zinc-400">Pick a starting point on the map first.</p>
        <button onClick={() => go('map')} className="btn-primary">Back to map</button>
      </div>
    );
  }
  return <NavigationView />;
}

// --------------------------------------------------------------- Arrival ---

export function ArrivalView() {
  return <ArrivalScreen />;
}
