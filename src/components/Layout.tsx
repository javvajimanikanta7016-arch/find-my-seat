import { Clapperboard, Cloud, CloudOff, Home, LogOut, ShieldCheck, Ticket } from 'lucide-react';
import type { ReactNode } from 'react';
import { useApp } from '../lib/store/appStore';
import { isSupabaseConfigured } from '../lib/supabase/client';
import type { ViewName } from '../types';

const TABS: Array<{ id: ViewName; label: string; icon: typeof Home }> = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'tickets', label: 'Tickets', icon: Ticket },
  { id: 'admin', label: 'Admin', icon: ShieldCheck },
];

export function Layout({ children }: { children: ReactNode }) {
  const { view, go, user, signOut, notify, resetFlow, toast } = useApp();
  const hideTabs = view === 'navigate' || view === 'arrival';

  const handleHome = () => {
    if (view === 'upload' || view === 'confirm') resetFlow();
    go('home');
  };

  const handleSignOut = async () => {
    await signOut();
    notify('Signed out.');
    go('home');
  };

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-cinema-950/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-md items-center justify-between gap-2 px-4">
          <button onClick={handleHome} className="flex items-center gap-2 text-left">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold-400 text-zinc-950 shadow-glow">
              <Clapperboard size={20} strokeWidth={2.4} />
            </span>
            <span className="leading-tight">
              <span className="block text-[15px] font-extrabold tracking-tight">Find My Seat</span>
              <span className="block text-[11px] font-medium text-zinc-400">
                {isSupabaseConfigured ? (
                  <span className="inline-flex items-center gap-1 text-emerald-300">
                    <Cloud size={11} /> Live
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-amber-300">
                    <CloudOff size={11} /> Demo mode
                  </span>
                )}
              </span>
            </span>
          </button>
          {user ? (
            <div className="flex items-center gap-2">
              <span className="chip max-w-[140px] truncate">
                {user.name || user.email}
                {user.role === 'admin' ? ' · admin' : ''}
              </span>
              <button
                onClick={handleSignOut}
                className="rounded-lg p-2 text-zinc-400 transition hover:bg-white/5 hover:text-white"
                aria-label="Sign out"
              >
                <LogOut size={18} />
              </button>
            </div>
          ) : (
            <button onClick={() => go('auth')} className="btn-ghost !py-2 text-gold-300">
              Sign in
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-md px-4 pb-32 pt-4">{children}</main>

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4">
          <div className="toast-in max-w-md rounded-xl border border-white/15 bg-zinc-900/95 px-4 py-3 text-sm font-medium text-zinc-100 shadow-2xl">
            {toast}
          </div>
        </div>
      )}

      {!hideTabs && (
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-cinema-950/92 pb-[env(safe-area-inset-bottom)] backdrop-blur">
          <div className="mx-auto grid max-w-md grid-cols-3 px-4 py-2">
            {TABS.map((tab) => {
              const active =
                view === tab.id ||
                (tab.id === 'home' && ['upload', 'confirm', 'map'].includes(view));
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => go(tab.id)}
                  className={`flex flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-semibold transition ${
                    active ? 'text-gold-400' : 'text-zinc-500 hover:text-zinc-200'
                  }`}
                >
                  <Icon size={21} strokeWidth={active ? 2.4 : 2} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
