import {
  Armchair,
  Camera,
  Check,
  Clapperboard,
  MapPin,
  QrCode,
  ScanText,
  Sparkles,
  Ticket,
  Upload,
} from 'lucide-react';
import { useApp } from '../lib/store/appStore';

const STEPS = [
  { icon: ScanText, title: 'Upload ticket', text: 'Screenshot, photo or PDF from any app.' },
  { icon: Check, title: 'Confirm seat', text: 'We read Screen · Row · Seat for you.' },
  { icon: QrCode, title: 'Follow route', text: 'Scan checkpoints, follow simple arrows.' },
  { icon: Armchair, title: 'Reach seat', text: '🎬 You\u2019ve arrived — enjoy the movie!' },
];

export function HomePage() {
  const { go, setUploadMode, user } = useApp();

  return (
    <div className="space-y-4">
      {/* hero */}
      <div className="card overflow-hidden !p-0">
        <div className="bg-gradient-to-br from-gold-400/20 via-transparent to-red-500/10 p-6 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gold-400 text-zinc-950 shadow-glow">
            <Clapperboard size={30} strokeWidth={2.2} />
          </span>
          <h1 className="pt-3 text-3xl font-extrabold tracking-tight">Find My Seat</h1>
          <p className="mx-auto mt-1 max-w-[260px] text-sm leading-snug text-zinc-400">
            Upload your movie ticket. We&apos;ll guide you to your seat.
          </p>
        </div>
        <div className="space-y-2.5 p-4">
          <button
            onClick={() => {
              setUploadMode('file');
              go('upload');
            }}
            className="btn-primary"
          >
            <Upload size={20} /> Upload Ticket
          </button>
          <button
            onClick={() => {
              setUploadMode('camera');
              go('upload');
            }}
            className="btn-secondary"
          >
            <Camera size={20} /> Scan Ticket
          </button>
          <button onClick={() => go(user ? 'tickets' : 'auth')} className="btn-ghost mx-auto">
            <Ticket size={16} /> My Tickets
          </button>
        </div>
      </div>

      {/* how it works */}
      <div className="card space-y-3">
        <p className="section-title">How it works</p>
        <ol className="space-y-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex items-center gap-3">
              <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 text-gold-300">
                <s.icon size={19} />
                <span className="absolute -left-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-gold-400 text-[10px] font-extrabold text-zinc-950">
                  {i + 1}
                </span>
              </span>
              <span>
                <span className="block text-sm font-bold">{s.title}</span>
                <span className="block text-xs text-zinc-400">{s.text}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>

      {/* demo theatre */}
      <button
        onClick={() => {
          setUploadMode('file');
          go('upload');
        }}
        className="card flex w-full items-center gap-3 border-gold-400/25 text-left transition hover:border-gold-400/50"
      >
        <MapPin size={24} className="shrink-0 text-gold-400" />
        <span>
          <span className="flex items-center gap-1.5 text-sm font-bold">
            Try the 60-second demo <Sparkles size={14} className="text-gold-400" />
          </span>
          <span className="block text-xs text-zinc-400">
            PVR INOX Example Mall · Screen 4 · Seat G18 — no sign-up needed.
          </span>
        </span>
      </button>

      <div className="flex flex-wrap items-center justify-center gap-2 pb-2">
        {['BookMyShow', 'District', 'Paytm Movies', 'PDF e-tickets'].map((p) => (
          <span key={p} className="chip">{p}</span>
        ))}
      </div>
    </div>
  );
}
