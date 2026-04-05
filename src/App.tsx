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
import PwaInstallPrompt from './components/PwaInstallPrompt';
import OfflineBanner from './components/OfflineBanner';

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
      {/* Redirect sign-in/sign-up to home if already signed in */}
      <Route path="/sign-in/*" element={<Navigate to="/" replace />} />
      <Route path="/sign-up/*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function PublicRoutes() {
  return (
    <Routes>
      <Route path="/sign-in/*" element={<SignInPage />} />
      <Route path="/sign-up/*" element={<SignUpPage />} />
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
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        height: '100dvh', background: '#0a0e1a', color: '#22d3ee', fontSize: 18
      }}>
        Loading...
      </div>
    );
  }

  return (
    <>
      <SignedIn>
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

function App() {
  return (
    <BrowserRouter>
      <OfflineBanner />
      {HAS_CLERK ? <ClerkAppContent /> : <UnauthenticatedApp />}
      <PwaInstallPrompt />
    </BrowserRouter>
  );
}

export default App;
