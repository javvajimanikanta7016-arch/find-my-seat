// Turn-by-turn indoor navigation UI, QR checkpoint scanner, arrival screen.

import {
  Armchair,
  Camera,
  Check,
  ChevronRight,
  CornerUpRight,
  DoorOpen,
  Flag,
  Footprints,
  Home,
  Keyboard,
  ListChecks,
  MapPin,
  Navigation as NavIcon,
  Popcorn,
  QrCode,
  RefreshCw,
  ChevronsUp,
  Ticket,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { RouteLeg } from '../types';
import { seatLabel } from '../lib/data/sampleTheatre';
import { remainingDistance } from '../lib/navigation/instructions';
import { useApp } from '../lib/store/appStore';
import { SeatingMap, TheatreMap } from './TheatreMap';

export function LegIcon({ icon, size = 30 }: { icon: RouteLeg['icon']; size?: number }) {
  switch (icon) {
    case 'stairs':
      return <ChevronsUp size={size} />;
    case 'door':
      return <DoorOpen size={size} />;
    case 'ticket':
      return <Ticket size={size} />;
    case 'seat':
      return <Armchair size={size} />;
    case 'flag':
      return <Flag size={size} />;
    case 'turn':
      return <CornerUpRight size={size} />;
    default:
      return <Footprints size={size} />;
  }
}

export function NavigationView() {
  const {
    legs,
    stepIndex,
    pathIds,
    routePoints,
    routeEdges,
    seats,
    destSeat,
    confirmed,
    totalDistance,
    etaMinutes,
    offRoute,
    advanceStep,
    endNavigation,
    scanCheckpoint,
  } = useApp();
  const [scannerOpen, setScannerOpen] = useState(false);

  const leg = legs[Math.min(stepIndex, legs.length - 1)];
  const current = routePoints.find((p) => p.id === pathIds[stepIndex]);
  const remaining = remainingDistance(legs, stepIndex);
  const remainingEta = Math.max(1, Math.ceil(remaining / 55));
  const progress = legs.length ? Math.min(1, stepIndex / legs.length) : 0;
  const upcoming = legs.slice(stepIndex + 1, stepIndex + 4);

  return (
    <div className="space-y-3">
      {/* progress */}
      <div className="card !p-3">
        <div className="flex items-center justify-between text-xs font-semibold text-zinc-400">
          <span>
            Step {Math.min(stepIndex + 1, legs.length)} of {legs.length}
          </span>
          <span>
            {remaining} m left · ~{remainingEta} min
          </span>
        </div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-gold-500 to-gold-300 transition-all duration-500"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      </div>

      {offRoute && (
        <div className="card flex items-center gap-2 border-amber-400/40 bg-amber-400/10 text-sm font-semibold text-amber-200">
          <RefreshCw size={17} className="animate-spin [animation-duration:1.6s]" />
          You&apos;re slightly off route. Recalculating…
        </div>
      )}

      {/* current location */}
      <div className="flex items-center gap-2 text-sm">
        <MapPin size={16} className="text-gold-400" />
        <span className="text-zinc-400">You are at</span>
        <span className="font-bold text-zinc-100">{current?.name ?? '…'}</span>
      </div>

      {/* next instruction */}
      {leg && (
        <div className="card border-gold-400/30 bg-gradient-to-br from-gold-400/10 to-transparent">
          <p className="section-title">Next</p>
          <div className="mt-2 flex items-center gap-4">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gold-400 text-zinc-950 shadow-glow">
              <LegIcon icon={leg.icon} />
            </span>
            <div className="min-w-0">
              <p className="text-xl font-extrabold leading-tight tracking-tight">{leg.title}</p>
              <p className="mt-0.5 text-sm leading-snug text-zinc-300">{leg.detail}</p>
              <p className="mt-1 text-xs font-bold uppercase tracking-wider text-gold-300">
                {leg.distance} m · towards {leg.toName}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* actions */}
      <button onClick={() => setScannerOpen(true)} className="btn-primary">
        <QrCode size={20} /> Scan checkpoint
      </button>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={advanceStep} className="btn-secondary !py-3 text-sm">
          <Check size={17} /> Reached {leg ? `· ${leg.toName}` : ''}
        </button>
        <button onClick={() => endNavigation(false)} className="btn-ghost border border-white/10 text-sm">
          End
        </button>
      </div>

      {/* mini map */}
      <div className="card !p-2">
        <TheatreMap
          points={routePoints}
          edges={routeEdges}
          seats={seats}
          pathIds={pathIds}
          currentId={pathIds[stepIndex]}
          destSeat={destSeat}
        />
      </div>

      {/* upcoming */}
      {upcoming.length > 0 && (
        <div className="card space-y-2">
          <p className="section-title">Coming up</p>
          {upcoming.map((u) => (
            <div key={u.toId} className="flex items-center gap-3 text-sm">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5 text-zinc-300">
                <LegIcon icon={u.icon} size={18} />
              </span>
              <div className="min-w-0">
                <p className="truncate font-semibold text-zinc-200">{u.title}</p>
                <p className="truncate text-xs text-zinc-500">{u.toName} · {u.distance} m</p>
              </div>
              <ChevronRight size={16} className="ml-auto shrink-0 text-zinc-600" />
            </div>
          ))}
        </div>
      )}

      <p className="text-center text-xs text-zinc-500">
        Total route {totalDistance} m · ~{etaMinutes} min · Destination{' '}
        {confirmed ? seatLabel(confirmed.row, confirmed.seat) : ''}
      </p>

      {scannerOpen && (
        <CheckpointScanner onClose={() => setScannerOpen(false)} onScan={scanCheckpoint} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Checkpoint scanner modal: pick from list, type a code, or use the camera.
// ---------------------------------------------------------------------------

interface ScannerProps {
  onClose: () => void;
  onScan: (input: string) => { ok: boolean; message: string };
}

export function CheckpointScanner({ onClose, onScan }: ScannerProps) {
  const { routePoints, points } = useApp();
  const [tab, setTab] = useState<'list' | 'code' | 'camera'>('list');
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const [msgOk, setMsgOk] = useState(true);

  const list = (routePoints.length ? routePoints : points).filter((p) => p.type !== 'seat');

  const submit = (input: string) => {
    const result = onScan(input);
    setMsg(result.message);
    setMsgOk(result.ok);
    if (result.ok && /arrived/i.test(result.message)) {
      window.setTimeout(onClose, 900);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center">
      <div className="m-3 max-h-[86dvh] w-full max-w-md overflow-auto rounded-2xl border border-white/10 bg-cinema-800 p-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
            <QrCode size={20} className="text-gold-400" /> Scan checkpoint
          </h2>
          <button onClick={onClose} className="rounded-lg p-2 text-zinc-400 hover:bg-white/5 hover:text-white" aria-label="Close scanner">
            <X size={19} />
          </button>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-1 rounded-xl bg-black/30 p-1 text-xs font-bold">
          {(
            [
              { id: 'list', label: 'Pick', icon: ListChecks },
              { id: 'code', label: 'Code', icon: Keyboard },
              { id: 'camera', label: 'Camera', icon: Camera },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setTab(t.id);
                setMsg('');
              }}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-2.5 transition ${
                tab === t.id ? 'bg-gold-400 text-zinc-950' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <t.icon size={15} /> {t.label}
            </button>
          ))}
        </div>

        {msg && (
          <div
            className={`mt-3 rounded-xl border p-3 text-sm font-semibold ${
              msgOk
                ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
                : 'border-red-400/30 bg-red-400/10 text-red-200'
            }`}
          >
            {msg}
          </div>
        )}

        {tab === 'list' && (
          <div className="mt-3 space-y-2">
            <p className="text-xs text-zinc-500">
              In the theatre you&apos;d scan the QR at each spot — here, tap where you are.
            </p>
            {list.map((p) => (
              <button
                key={p.id}
                onClick={() => submit(p.qr_code || p.id)}
                className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left transition hover:border-gold-400/40 hover:bg-gold-400/5"
              >
                <MapPin size={17} className="shrink-0 text-gold-400" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold">{p.name}</span>
                  <span className="block text-xs text-zinc-500">
                    {p.qr_code ?? p.id} · {p.floor ?? '—'}
                  </span>
                </span>
                <ChevronRight size={16} className="ml-auto shrink-0 text-zinc-600" />
              </button>
            ))}
          </div>
        )}

        {tab === 'code' && (
          <form
            className="mt-3 space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              submit(code);
            }}
          >
            <label className="label" htmlFor="qr-code">Checkpoint code (e.g. FMS-LOB-02)</label>
            <input
              id="qr-code"
              className="input uppercase"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="FMS-…"
              autoComplete="off"
            />
            <button type="submit" className="btn-primary">
              <Check size={19} /> Confirm location
            </button>
          </form>
        )}

        {tab === 'camera' && <CameraScanner onScan={submit} />}
      </div>
    </div>
  );
}

function CameraScanner({ onScan }: { onScan: (text: string) => void }) {
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);
  const qrRef = useRef<{ stop: () => Promise<unknown>; clear: () => void } | null>(null);
  const lastRef = useRef<{ text: string; at: number }>({ text: '', at: 0 });

  const stop = async () => {
    try {
      await qrRef.current?.stop();
      qrRef.current?.clear();
    } catch {
      /* ignore */
    }
    qrRef.current = null;
    setScanning(false);
  };

  useEffect(() => {
    return () => {
      try {
        qrRef.current?.stop();
      } catch {
        /* ignore */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = async () => {
    setError('');
    setScanning(true);
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const qr = new Html5Qrcode('fms-qr-reader');
      qrRef.current = qr;
      await qr.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (text) => {
          const now = Date.now();
          if (text === lastRef.current.text && now - lastRef.current.at < 2500) return;
          lastRef.current = { text, at: now };
          onScan(text);
        },
        undefined,
      );
    } catch {
      setError('Camera unavailable here. Use the code or list instead.');
      setScanning(false);
    }
  };

  return (
    <div className="mt-3 space-y-2">
      <div id="fms-qr-reader" className="overflow-hidden rounded-xl bg-black/40" />
      {error && <p className="text-sm text-red-300">{error}</p>}
      {!scanning ? (
        <button onClick={start} className="btn-primary">
          <Camera size={19} /> Start camera
        </button>
      ) : (
        <button onClick={stop} className="btn-secondary">
          Stop camera
        </button>
      )}
      <p className="text-xs text-zinc-500">Point at a checkpoint QR such as FMS-LOB-02.</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Arrival
// ---------------------------------------------------------------------------

export function ArrivalScreen() {
  const { confirmed, destSeat, seats, screen, theatre, go, resetFlow } = useApp();

  if (!confirmed) {
    return (
      <div className="card space-y-3 text-center">
        <p className="font-bold">No active trip.</p>
        <button onClick={() => go('home')} className="btn-primary">Back to home</button>
      </div>
    );
  }

  return (
    <div className="space-y-3 text-center">
      <div className="card space-y-1 border-gold-400/30 bg-gradient-to-b from-gold-400/10 to-transparent py-8">
        <p className="text-5xl">🎬</p>
        <h1 className="pt-2 text-3xl font-extrabold tracking-tight">You&apos;ve Arrived!</h1>
        <p className="text-sm text-zinc-400">
          {theatre?.name} · {screen?.screen_name ?? '—'}
        </p>
        <div className="flex items-center justify-center gap-6 pt-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Row</p>
            <p className="text-4xl font-extrabold text-gold-300">{confirmed.row}</p>
          </div>
          <div className="h-12 w-px bg-white/10" />
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Seat</p>
            <p className="text-4xl font-extrabold text-gold-300">{confirmed.seat}</p>
          </div>
        </div>
      </div>

      <div className="card !p-2">
        <SeatingMap seats={seats} destSeat={destSeat} screenName={screen?.screen_name} />
      </div>

      <p className="flex items-center justify-center gap-2 text-sm font-semibold text-zinc-300">
        <Popcorn size={18} className="text-gold-400" /> Enjoy the movie! 🍿
      </p>

      <button
        onClick={() => {
          resetFlow();
          go('upload');
        }}
        className="btn-primary"
      >
        <NavIcon size={19} /> Find another seat
      </button>
      <button onClick={() => go('home')} className="btn-ghost mx-auto">
        <Home size={16} /> Home
      </button>
    </div>
  );
}
