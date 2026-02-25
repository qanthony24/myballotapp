import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom'; // Removed BrowserRouter
import { AuthProvider, useAuth } from './hooks/useAuth';
import { BallotProvider } from './hooks/useBallot';
import { SettingsProvider } from './hooks/useSettings';
import Header from './components/layout/Header';
import ShrinkHeader from './components/ShrinkHeader';
import ElectionBanner from './components/ElectionBanner';
import Navbar from './components/layout/Navbar';
import HomePage from './pages/HomePage';
import BallotMeasuresListPage from './pages/BallotMeasuresListPage';
import MyBallotPage from './pages/MyBallotPage';
import CompareCandidatesPage from './pages/CompareCandidatesPage';
import UserProfilePage from './pages/UserProfilePage';
import AuthPage from './pages/AuthPage';
import ElectionInfoPage from './pages/ElectionInfoPage';
import OnboardingPage from './pages/OnboardingPage';
import CandidateProfilePage from './pages/CandidateProfilePage';
import BallotMeasureDetailPage from './pages/BallotMeasureDetailPage';
import DebugBallotFeedPage from './pages/DebugBallotFeedPage';
import AdminCandidatesPage from './pages/admin/AdminCandidatesPage';
import AdminCandidateEditPage from './pages/admin/AdminCandidateEditPage';
import AdminSetupPage from './pages/admin/AdminSetupPage';

const AppRoutes: React.FC = () => {
  const { currentUser } = useAuth();

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/ballot-measures" element={<BallotMeasuresListPage />} />
      <Route path="/ballot-measure/:id" element={<BallotMeasureDetailPage />} />
      <Route path="/my-ballot" element={<MyBallotPage />} />
      <Route path="/compare" element={<CompareCandidatesPage />} />
      <Route path="/candidate/:id" element={<CandidateProfilePage />} />
      <Route path="/profile" element={currentUser ? <UserProfilePage /> : <Navigate to="/auth" />} />
      <Route path="/auth" element={!currentUser ? <AuthPage /> : <Navigate to="/" />} />
      <Route path="/election-info" element={<ElectionInfoPage />} />
      <Route path="/onboarding" element={currentUser ? <OnboardingPage /> : <Navigate to="/auth" />} />
      <Route path="/debug/ballot-feed" element={<DebugBallotFeedPage />} />
      <Route path="/admin" element={currentUser ? <AdminSetupPage /> : <Navigate to="/auth" />} />
      <Route path="/admin/candidates" element={currentUser ? <AdminCandidatesPage /> : <Navigate to="/auth" />} />
      <Route path="/admin/candidates/:id" element={currentUser ? <AdminCandidateEditPage /> : <Navigate to="/auth" />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
};

const App: React.FC = () => {
  const uiRefresh = process.env.UI_REFRESH !== 'false';
  const HeaderComponent = uiRefresh ? ShrinkHeader : Header;

  return (
      <AuthProvider>
        <BallotProvider>
          <SettingsProvider>
          <div className="min-h-screen flex flex-col">
            <HeaderComponent />
            {uiRefresh && <ElectionBanner />}
            <main className={`flex-grow container mx-auto px-4 pb-20 ${uiRefresh ? 'pt-28' : 'pt-20'}`}>
              <AppRoutes />
            </main>
            <Navbar />
          </div>
          </SettingsProvider>
        </BallotProvider>
      </AuthProvider>
  );
};

export default App;