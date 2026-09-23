import { AppProvider, useApp } from './lib/store/appStore';
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
  const { view } = useApp();

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
