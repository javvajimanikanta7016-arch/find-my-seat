import { AlertTriangle, Eye, EyeOff, Loader2, LogIn, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { useApp } from '../lib/store/appStore';
import {
  demoSignIn,
  friendlyAuthError,
  isInAppBrowser,
  isSupabaseConfigured,
  signInWithGoogle,
  signInWithPassword,
  signUpWithPassword,
} from '../lib/supabase/client';

export function AuthForm() {
  const { setUser, go, notify } = useApp();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [inAppBrowser] = useState(() => isInAppBrowser());

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setBusy(true);
    try {
      const user =
        mode === 'signin'
          ? await signInWithPassword(email.trim(), password)
          : await signUpWithPassword(email.trim(), password, name.trim() || undefined);
      setUser(user);
      notify(`Welcome${user.name ? `, ${user.name.split(' ')[0]}` : ''}!`);
      go('home');
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(friendlyAuthError(err));
      setBusy(false);
    }
  };

  const handleDemo = (admin: boolean) => {
    const user = demoSignIn(admin ? 'admin@findmyseat.app' : 'demo@findmyseat.app');
    setUser(user);
    notify(admin ? 'Signed in as demo admin.' : 'Continuing as demo user.');
    go(admin ? 'admin' : 'home');
  };

  return (
    <div className="space-y-4">
      <div className="pt-2 text-center">
        <h1 className="text-2xl font-extrabold tracking-tight">
          {mode === 'signin' ? 'Welcome back' : 'Create your account'}
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Sign in to keep your tickets and navigation history.
        </p>
      </div>

      {!isSupabaseConfigured && (
        <div className="card border-amber-400/30 bg-amber-400/5 text-sm text-amber-200">
          Supabase isn&apos;t connected, so cloud sign-in is off. Use a demo account — everything
          works locally.
        </div>
      )}

      <form onSubmit={submit} className="card space-y-3">
        {mode === 'signup' && (
          <div>
            <label className="label" htmlFor="fms-name">Name</label>
            <input
              id="fms-name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Aarav Sharma"
              autoComplete="name"
            />
          </div>
        )}
        <div>
          <label className="label" htmlFor="fms-email">Email</label>
          <input
            id="fms-email"
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="fms-password">Password</label>
          <div className="relative">
            <input
              id="fms-password"
              className="input pr-11"
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              required
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-zinc-400 hover:text-white"
              aria-label={showPw ? 'Hide password' : 'Show password'}
            >
              {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        <button type="submit" className="btn-primary" disabled={busy || !isSupabaseConfigured}>
          {busy ? (
            <Loader2 size={19} className="animate-spin" />
          ) : mode === 'signin' ? (
            <LogIn size={19} />
          ) : (
            <UserPlus size={19} />
          )}
          {mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>

        {isSupabaseConfigured && (
          <>
            <button type="button" onClick={handleGoogle} className="btn-secondary" disabled={busy}>
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.3H12v4.5h6.5c-.1 1.1-.8 2.7-2.4 3.8l-.1.1 3.5 2.7.2.1c2.2-2 3.8-5 3.8-8.9z" />
                <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.8-2.9c-1 .7-2.4 1.2-4.1 1.2-3.1 0-5.8-2.1-6.8-5l-.1.1-3.6 2.8v.1C3.5 21.3 7.5 24 12 24z" />
                <path fill="#FBBC05" d="M5.2 14.4c-.2-.7-.4-1.5-.4-2.4s.1-1.7.4-2.4l-.1-.1-3.5-2.7-.1.1C.5 8.9 0 10.4 0 12s.5 3.1 1.5 4.5l3.7-2.1z" />
                <path fill="#EA4335" d="M12 4.7c1.8 0 3 .8 3.7 1.4l3.3-3.2C17.9 1.1 15.2 0 12 0 7.5 0 3.5 2.7 1.5 6.9l3.7 2.9c1-2.9 3.7-5.1 6.8-5.1z" />
              </svg>
              Continue with Google
            </button>
            {inAppBrowser && (
              <p className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-3 text-xs leading-relaxed text-amber-200">
                You&apos;re opening this inside another app&apos;s browser, where Google sign-in
                often fails. If it doesn&apos;t work, open this page in{' '}
                <span className="font-bold">Chrome</span> (Android) or{' '}
                <span className="font-bold">Safari</span> (iPhone) — usually via the ⋮ / share
                menu → “Open in browser”.
              </p>
            )}
          </>
        )}

        <button
          type="button"
          onClick={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin');
            setError('');
          }}
          className="w-full pt-1 text-center text-sm font-semibold text-gold-300 hover:text-gold-400"
        >
          {mode === 'signin' ? "New here? Create an account" : 'Already have an account? Sign in'}
        </button>
      </form>

      <div className="card space-y-2">
        <p className="section-title">Just looking around?</p>
        <button onClick={() => handleDemo(false)} className="btn-secondary">
          Continue as demo user
        </button>
        <button onClick={() => handleDemo(true)} className="btn-ghost w-full text-xs text-zinc-400">
          or explore as demo admin
        </button>
      </div>
    </div>
  );
}
