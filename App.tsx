import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import ErrorBoundary from './components/ui/ErrorBoundary';
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
import InfoHubPage from './pages/info/InfoHubPage';
import InfoEssentialsPage from './pages/info/InfoEssentialsPage';
import InfoNewsPage from './pages/info/InfoNewsPage';
import InfoResultsHomePage from './pages/info/InfoResultsHomePage';
import InfoElectionResultsPage from './pages/info/InfoElectionResultsPage';
import InfoContestResultsPage from './pages/info/InfoContestResultsPage';
import OnboardingPage from './pages/OnboardingPage';
import CandidateProfilePage from './pages/CandidateProfilePage';
import BallotMeasureDetailPage from './pages/BallotMeasureDetailPage';
import DebugBallotFeedPage from './pages/DebugBallotFeedPage';
import AdminCandidatesPage from './pages/admin/AdminCandidatesPage';
import AdminCandidateEditPage from './pages/admin/AdminCandidateEditPage';
import AdminSetupPage from './pages/admin/AdminSetupPage';
import AdminCsvImportPage from './pages/admin/AdminCsvImportPage';
import AdminBallotMeasuresPage from './pages/admin/AdminBallotMeasuresPage';
import AdminBallotMeasureEditPage from './pages/admin/AdminBallotMeasureEditPage';
import AdminSurveyQuestionsPage from './pages/admin/AdminSurveyQuestionsPage';
import AdminSurveyResponsesPage from './pages/admin/AdminSurveyResponsesPage';

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
      <Route path="/election-info" element={<Navigate to="/info" />} />
      <Route path="/info" element={<InfoNewsPage />} />
      <Route path="/info/hub" element={<InfoHubPage />} />
      <Route path="/info/essentials" element={<InfoEssentialsPage />} />
      <Route path="/info/qa" element={<ElectionInfoPage />} />
      <Route path="/info/news" element={<InfoNewsPage />} />
      <Route path="/info/results" element={<InfoResultsHomePage />} />
      <Route path="/info/results/:electionId" element={<InfoElectionResultsPage />} />
      <Route path="/info/results/:electionId/:contestId" element={<InfoContestResultsPage />} />
      <Route path="/onboarding" element={currentUser ? <OnboardingPage /> : <Navigate to="/auth" />} />
      <Route path="/debug/ballot-feed" element={<DebugBallotFeedPage />} />
      <Route path="/admin" element={currentUser ? <AdminSetupPage /> : <Navigate to="/auth" />} />
      <Route path="/admin/candidates" element={currentUser ? <AdminCandidatesPage /> : <Navigate to="/auth" />} />
      <Route path="/admin/candidates/:id" element={currentUser ? <AdminCandidateEditPage /> : <Navigate to="/auth" />} />
      <Route path="/admin/csv-import" element={currentUser ? <AdminCsvImportPage /> : <Navigate to="/auth" />} />
      <Route path="/admin/ballot-measures" element={currentUser ? <AdminBallotMeasuresPage /> : <Navigate to="/auth" />} />
      <Route path="/admin/ballot-measures/:id" element={currentUser ? <AdminBallotMeasureEditPage /> : <Navigate to="/auth" />} />
      <Route path="/admin/survey-questions" element={currentUser ? <AdminSurveyQuestionsPage /> : <Navigate to="/auth" />} />
      <Route path="/admin/survey-responses" element={currentUser ? <AdminSurveyResponsesPage /> : <Navigate to="/auth" />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
};

const App: React.FC = () => {
  const uiRefresh = import.meta.env.VITE_UI_REFRESH !== 'false';
  const HeaderComponent = uiRefresh ? ShrinkHeader : Header;

  return (
      <AuthProvider>
        <BallotProvider>
          <SettingsProvider>
          <div className="min-h-screen flex flex-col">
            <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-civic-blue focus:text-white focus:px-4 focus:py-2 focus:rounded-md focus:text-sm">
              Skip to main content
            </a>
            <HeaderComponent />
            {uiRefresh && <ElectionBanner />}
            <main id="main-content" className={`flex-grow container mx-auto px-4 pb-20 ${uiRefresh ? 'pt-28' : 'pt-20'}`}>
              <ErrorBoundary>
                <AppRoutes />
              </ErrorBoundary>
            </main>
            <Navbar />
          </div>
          </SettingsProvider>
        </BallotProvider>
      </AuthProvider>
  );
};

export default App;