import { Armchair, Clock, Film, Loader2, LogIn, MapPin, Ticket, Trash2, Upload } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { TicketListItem } from '../types';
import { useApp } from '../lib/store/appStore';
import { deleteTicketRecord, demoSignIn, listUserTickets } from '../lib/supabase/client';

export function MyTicketsPage() {
  const { user, setUser, go, resumeTicket, notify } = useApp();
  const [items, setItems] = useState<TicketListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [resuming, setResuming] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    listUserTickets(user.id)
      .then(setItems)
      .catch(() => notify('Could not load your tickets.'))
      .finally(() => setLoading(false));
  }, [user, notify]);

  if (!user) {
    return (
      <div className="card space-y-3 text-center">
        <Ticket size={30} className="mx-auto text-zinc-500" />
        <h1 className="text-lg font-extrabold">Your tickets live here</h1>
        <p className="text-sm text-zinc-400">Sign in to see past tickets and resume navigation.</p>
        <button onClick={() => go('auth')} className="btn-primary">
          <LogIn size={19} /> Sign in
        </button>
        <button
          onClick={() => {
            setUser(demoSignIn());
            notify('Continuing as demo user.');
          }}
          className="btn-ghost mx-auto"
        >
          Continue as demo instead
        </button>
      </div>
    );
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteTicketRecord(id);
      setItems((prev) => prev.filter((t) => t.id !== id));
      notify('Ticket removed.');
    } catch {
      notify('Could not remove that ticket.');
    }
  };

  const handleResume = async (item: TicketListItem) => {
    setResuming(item.id);
    try {
      await resumeTicket(item);
    } catch {
      notify('Could not resume that ticket.');
      setResuming(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-xl font-extrabold tracking-tight">
          <Ticket size={20} className="text-gold-400" /> My Tickets
        </h1>
        <button onClick={() => go('upload')} className="btn-ghost !py-2 text-gold-300">
          <Upload size={16} /> New
        </button>
      </div>

      {loading && (
        <div className="card flex items-center gap-3">
          <Loader2 size={20} className="animate-spin text-gold-400" />
          <p className="text-sm font-semibold">Loading your tickets…</p>
        </div>
      )}

      {!loading && !items.length && (
        <div className="card space-y-3 text-center">
          <p className="font-bold">No tickets yet.</p>
          <p className="text-sm text-zinc-400">Upload your first ticket to get going.</p>
          <button onClick={() => go('upload')} className="btn-primary">Upload ticket</button>
        </div>
      )}

      {items.map((t) => (
        <div key={t.id} className="card space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 truncate text-[15px] font-extrabold">
                <Film size={15} className="shrink-0 text-gold-400" /> {t.movie || 'Movie'}
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-zinc-400">
                <MapPin size={12} className="shrink-0" /> {t.theatre || '—'}
                {t.screen ? ` · ${t.screen}` : ''}
              </p>
              {t.showTime && (
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-400">
                  <Clock size={12} className="shrink-0" /> {t.showTime}
                </p>
              )}
            </div>
            <span className="chip shrink-0 !border-gold-400/40 !bg-gold-400/10 !text-gold-200">
              <Armchair size={13} /> {t.row}
              {t.seat}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleResume(t)}
              disabled={resuming === t.id}
              className="btn-secondary flex-1 !py-2.5 text-sm"
            >
              {resuming === t.id ? <Loader2 size={17} className="animate-spin" /> : null}
              Navigate again
            </button>
            <button onClick={() => handleDelete(t.id)} className="btn-danger-ghost" aria-label="Delete ticket">
              <Trash2 size={17} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
