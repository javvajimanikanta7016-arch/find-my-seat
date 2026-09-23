import { useEffect } from 'react';
import { AppProvider, useApp } from './lib/store/appStore';
import { friendlyAuthError } from './lib/supabase/client';
import { Layout } from './components/Layout';
import { AuthForm } from './components/AuthForm';
import {
  UploadView,
  ConfirmView,
  MapView,
  NavigateView,
  ArrivalView,
} from './components/FlowViews';
import { HomePage } from './pages/HomePage';
import { MyTicketsPage } from './pages/MyTicketsPage';
import { AdminPage } from './pages/AdminPage';

function Shell() {
  const { view, go, notify } = useApp();

  // Surface OAuth/redirect failures (cancelled Google login, unlisted
  // redirect URL, provider errors) instead of failing silently.
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const err = params.get('error');
      if (err) {
        const desc = (params.get('error_description') || '').replace(/\+/g, ' ');
        notify(friendlyAuthError(desc || err));
        params.delete('error');
        params.delete('error_description');
        params.delete('error_code');
        const qs = params.toString();
        window.history.replaceState(
          {},
          '',
          `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`,
        );
        go('auth');
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Layout>
      {view === 'home' && <HomePage />}
      {view === 'auth' && <AuthForm />}
      {view === 'upload' && <UploadView />}
      {view === 'confirm' && <ConfirmView />}
      {view === 'map' && <MapView />}
      {view === 'navigate' && <NavigateView />}
      {view === 'arrival' && <ArrivalView />}
      {view === 'tickets' && <MyTicketsPage />}
      {view === 'admin' && <AdminPage />}
    </Layout>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
