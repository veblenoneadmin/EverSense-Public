import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
import { EmailVerified } from './pages/EmailVerified';
import { Dashboard } from './pages/Dashboard';
import { BrainDump } from './pages/BrainDump';
import { Tasks } from './pages/Tasks';
import { Timer } from './pages/Timer';
import { Projects } from './pages/Projects';
import { TimeLogs } from './pages/TimeLogs';
import { Skills } from './pages/Skills';
import { Calendar } from './pages/Calendar';
import { Clients } from './pages/Clients';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';
import { Admin } from './pages/Admin';
import { KPIReport } from './pages/KPIReport';
import { Meetings } from './pages/Meetings';
import { InviteAccept } from './pages/InviteAccept';
import { SuperAdmin } from './pages/SuperAdmin';
import { Onboarding } from './pages/Onboarding';
import { TaskHistory } from './pages/TaskHistory';
import MainLayout from './components/Layout/MainLayout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { OnboardingGuard } from './components/OnboardingGuard';
import { OrganizationProvider } from './contexts/OrganizationContext';
import { SessionProvider, useSessionContext } from './contexts/SessionContext';
import { initializeWidgets } from './lib/widgets/widgetRegistry';

// Initialize widgets on app load
initializeWidgets();

function AppContent() {
  const { session, isLoading: isPending } = useSessionContext();

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#1e1e1e' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 rounded-full animate-spin" style={{ border: '2px solid #3c3c3c', borderTopColor: '#007acc' }} />
          <p className="text-xs font-mono" style={{ color: '#858585' }}>// loading...</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <OrganizationProvider>
        <Router>
          <div className="app">
            <Routes>
              <Route path="/login" element={session ? <Navigate to="/dashboard" replace /> : <Login />} />
              <Route path="/register" element={session ? <Navigate to="/dashboard" replace /> : <Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/email-verified" element={<EmailVerified />} />
              <Route path="/invite" element={<InviteAccept />} />

              <Route path="super-admin" element={session ? <SuperAdmin /> : <Navigate to="/login" replace />} />
              <Route path="/onboarding" element={session ? <Onboarding /> : <Navigate to="/login" replace />} />

              <Route path="/*" element={session ? <OnboardingGuard><MainLayout /></OnboardingGuard> : <Navigate to="/login" replace />}>
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="brain-dump" element={<BrainDump />} />
                <Route path="tasks" element={<Tasks />} />
                <Route path="timer" element={<Timer />} />
                <Route path="projects" element={<Projects />} />
                <Route path="timesheets" element={<TimeLogs />} />
                <Route path="clients" element={<Clients />} />
                <Route path="reports" element={<Reports />} />
                <Route path="settings" element={<Settings />} />
                <Route path="admin" element={<Admin />} />
                <Route path="skills" element={<Skills />} />
                <Route path="calendar" element={<Calendar />} />
                <Route path="kpi-report" element={<KPIReport />} />
                <Route path="meetings" element={<Meetings />} />
                <Route path="meetings/:id" element={<Meetings />} />
                <Route path="task-history" element={<TaskHistory />} />
              </Route>

              <Route path="/" element={session ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />} />
            </Routes>
          </div>
        </Router>
      </OrganizationProvider>
    </ErrorBoundary>
  );
}

function App() {
  return (
    <SessionProvider>
      <AppContent />
    </SessionProvider>
  );
}

export default App;
