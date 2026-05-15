import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SignedIn, SignedOut, useAuth } from '@clerk/clerk-react';
import AuthProvider from './components/AuthProvider';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Learn from './pages/Learn';
import Lesson from './pages/Lesson';
import Practice from './pages/Practice';
import Reference from './pages/Reference';
import Hypnosis from './pages/Hypnosis';
import Audios from './pages/Audios';
import Sessions from './pages/Sessions';
import Insights from './pages/Insights';
import Identity from './pages/Identity';
import SignInPage from './pages/SignIn';
import SignUpPage from './pages/SignUp';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import PwaInstallPrompt from './components/PwaInstallPrompt';
import OfflineBanner from './components/OfflineBanner';
import SignupTracker from './components/SignupTracker';
import Admin from './pages/Admin';
import AnalyticsTracker from './components/AnalyticsTracker';
import LeadConnectorWidget from './components/LeadConnectorWidget';

function ProtectedRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/hypnosis" element={<Hypnosis />} />
        <Route path="/sessions" element={<Sessions />} />
        <Route path="/insights" element={<Insights />} />
        <Route path="/identity" element={<Identity />} />
        <Route path="/audios" element={<Audios />} />
        <Route path="/learn" element={<Learn />} />
        <Route path="/learn/:lessonId" element={<Lesson />} />
        <Route path="/practice" element={<Practice />} />
        <Route path="/reference" element={<Reference />} />
      </Route>
      {/* Admin dashboard — outside Layout for full-page view */}
      <Route path="/admin" element={<Admin />} />
      {/* Redirect sign-in/sign-up to home if already signed in */}
      <Route path="/sign-in/*" element={<Navigate to="/" replace />} />
      <Route path="/sign-up/*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function PublicRoutes() {
  return (
    <Routes>
      {/* Redirect everything else to sign-in */}
      <Route path="*" element={<Navigate to="/sign-in" replace />} />
    </Routes>
  );
}

// Fallback for when Clerk is not configured (no publishable key)
function UnauthenticatedApp() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/hypnosis" element={<Hypnosis />} />
        <Route path="/sessions" element={<Sessions />} />
        <Route path="/insights" element={<Insights />} />
        <Route path="/identity" element={<Identity />} />
        <Route path="/audios" element={<Audios />} />
        <Route path="/learn" element={<Learn />} />
        <Route path="/learn/:lessonId" element={<Lesson />} />
        <Route path="/practice" element={<Practice />} />
        <Route path="/reference" element={<Reference />} />
      </Route>
    </Routes>
  );
}

// Clerk-aware content: only rendered inside ClerkProvider
function ClerkAppContent() {
  const { isLoaded } = useAuth();

  if (!isLoaded) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
        height: '100dvh', background: '#0B0F19', color: '#D4A853', fontSize: 16, gap: '24px'
      }}>
        <img src="/icons/icon-192x192.png" alt="" style={{ width: 64, height: 64, borderRadius: 16, opacity: 0.9 }} />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: 40, height: 40, border: '3px solid rgba(212,168,83,0.2)',
            borderTopColor: '#D4A853', borderRadius: '50%',
            animation: 'spin 0.8s linear infinite'
          }} />
          <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 300, letterSpacing: '0.1em', fontSize: 13, color: '#94a3b8' }}>
            INITIALIZING
          </span>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  return (
    <>
      <SignedIn>
        <SignupTracker />
        <AuthProvider>
          <ProtectedRoutes />
        </AuthProvider>
      </SignedIn>
      <SignedOut>
        <PublicRoutes />
      </SignedOut>
    </>
  );
}

const HAS_CLERK = !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

function AdminWrapper() {
  const { isLoaded } = useAuth();

  if (!isLoaded) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
        height: '100dvh', background: '#0B0F19', color: '#D4A853', fontSize: 16, gap: '24px'
      }}>
        <div style={{
          width: 40, height: 40, border: '3px solid rgba(212,168,83,0.2)',
          borderTopColor: '#D4A853', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  return (
    <>
      <SignedIn>
        <AuthProvider>
          <Admin />
        </AuthProvider>
      </SignedIn>
      <SignedOut>
        <Navigate to="/sign-in?redirect_url=%2Fadmin" replace />
      </SignedOut>
    </>
  );
}

function AuthPageWrapper({ children }: { children: React.ReactNode }) {
  const { isLoaded } = useAuth();

  if (!isLoaded) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
        height: '100dvh', background: '#0B0F19', color: '#D4A853', fontSize: 16, gap: '24px'
      }}>
        <div style={{
          width: 40, height: 40, border: '3px solid rgba(212,168,83,0.2)',
          borderTopColor: '#D4A853', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
      <AnalyticsTracker />
      {HAS_CLERK && <LeadConnectorWidget />}
      <Routes>
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/admin" element={<AdminWrapper />} />
        <Route path="/sign-up/*" element={
          <AuthPageWrapper><SignUpPage /></AuthPageWrapper>
        } />
        <Route path="/sign-in/*" element={
          <AuthPageWrapper><SignInPage /></AuthPageWrapper>
        } />
        <Route path="*" element={
          <div style={{ minHeight: '100dvh' }}>
            <OfflineBanner />
            {HAS_CLERK ? <ClerkAppContent /> : <UnauthenticatedApp />}
            <PwaInstallPrompt />
          </div>
        } />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
