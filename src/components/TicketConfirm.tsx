import {
  Armchair,
  Building2,
  Check,
  Clock,
  Film,
  Loader2,
  MonitorPlay,
  ScanText,
  Ticket,
} from 'lucide-react';
import { useState } from 'react';
import type { TicketDraft } from '../types';
import { seatLabel } from '../lib/data/sampleTheatre';

export function ConfidenceBadge({ level, confidence }: { level: TicketDraft['level']; confidence: number }) {
  const styles =
    level === 'high'
      ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300'
      : level === 'medium'
        ? 'border-amber-400/40 bg-amber-400/10 text-amber-300'
        : 'border-red-400/40 bg-red-400/10 text-red-300';
  const label = level === 'high' ? 'High' : level === 'medium' ? 'Medium' : 'Low';
  return (
    <span className={`chip ${styles}`}>
      Confidence: {label} · {Math.round(confidence)}%
    </span>
  );
}

interface Props {
  initial: TicketDraft;
  busy: boolean;
  onConfirm: (final: TicketDraft) => void;
}

export function TicketConfirm({ initial, busy, onConfirm }: Props) {
  const [form, setForm] = useState({
    movie: initial.movie,
    theatre: initial.theatre,
    screen: initial.screen,
    showTime: initial.showTime,
    row: initial.row,
    seat: initial.seat,
    platform: initial.platform,
  });
  const [showRaw, setShowRaw] = useState(false);

  const set =
    (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const valid = form.row.trim().length > 0 && form.seat.trim().length > 0;

  const submit = () => {
    onConfirm({
      ...initial,
      movie: form.movie.trim(),
      theatre: form.theatre.trim(),
      screen: form.screen.trim(),
      showTime: form.showTime.trim(),
      row: form.row.trim().toUpperCase(),
      seat: form.seat.trim(),
      platform: form.platform,
    });
  };

  return (
    <div className="space-y-3">
      <div className="card border-gold-400/30 bg-gradient-to-br from-gold-400/10 to-transparent">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
              Seat detected
            </p>
            <p className="text-3xl font-extrabold tracking-tight text-gold-300">
              {form.row && form.seat ? seatLabel(form.row, form.seat) : '—'}
            </p>
          </div>
          <Armchair size={40} className="text-gold-400/70" />
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <ConfidenceBadge level={initial.level} confidence={initial.confidence} />
          {initial.fileName && <span className="chip">{initial.fileName}</span>}
        </div>
      </div>

      {initial.fileDataUrl && (
        <div className="overflow-hidden rounded-2xl border border-white/10">
          <img
            src={initial.fileDataUrl}
            alt="Uploaded ticket"
            className="max-h-44 w-full object-contain bg-black"
          />
        </div>
      )}

      <div className="card space-y-3">
        <div>
          <label className="label" htmlFor="cf-movie"><Film size={12} className="mr-1 inline" /> Movie</label>
          <input id="cf-movie" className="input" value={form.movie} onChange={set('movie')} placeholder="Movie name" />
        </div>
        <div>
          <label className="label" htmlFor="cf-theatre"><Building2 size={12} className="mr-1 inline" /> Theatre</label>
          <input id="cf-theatre" className="input" value={form.theatre} onChange={set('theatre')} placeholder="Theatre name" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="cf-screen"><MonitorPlay size={12} className="mr-1 inline" /> Screen</label>
            <input id="cf-screen" className="input" value={form.screen} onChange={set('screen')} placeholder="4" />
          </div>
          <div>
            <label className="label" htmlFor="cf-platform"><Ticket size={12} className="mr-1 inline" /> Platform</label>
            <select id="cf-platform" className="input" value={form.platform} onChange={set('platform')}>
              {['BookMyShow', 'District', 'Paytm Movies', 'TicketNew', 'Other'].map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="cf-time"><Clock size={12} className="mr-1 inline" /> Show time</label>
          <input id="cf-time" className="input" value={form.showTime} onChange={set('showTime')} placeholder="7:30 PM" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="cf-row">Row</label>
            <input id="cf-row" className="input text-center text-lg font-bold uppercase" value={form.row} onChange={set('row')} placeholder="G" maxLength={2} />
          </div>
          <div>
            <label className="label" htmlFor="cf-seat">Seat</label>
            <input id="cf-seat" className="input text-center text-lg font-bold" value={form.seat} onChange={set('seat')} placeholder="18" maxLength={3} inputMode="numeric" />
          </div>
        </div>
        {!valid && (
          <p className="text-sm text-amber-300">
            Please double-check the row and seat — we guide you to that exact seat.
          </p>
        )}
      </div>

      {initial.rawText && (
        <div className="card">
          <button
            onClick={() => setShowRaw((v) => !v)}
            className="flex w-full items-center gap-2 text-sm font-semibold text-zinc-300"
          >
            <ScanText size={16} /> {showRaw ? 'Hide scanned text' : 'View scanned text'}
          </button>
          {showRaw && (
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-xl bg-black/40 p-3 text-xs leading-relaxed text-zinc-400">
              {initial.rawText}
            </pre>
          )}
        </div>
      )}

      <button onClick={submit} className="btn-primary" disabled={!valid || busy}>
        {busy ? <Loader2 size={20} className="animate-spin" /> : <Check size={20} />}
        Confirm Seat
      </button>
      <p className="text-center text-xs text-zinc-500">
        Edit anything above — the ticket reader isn&apos;t always perfect.
      </p>
    </div>
  );
}
