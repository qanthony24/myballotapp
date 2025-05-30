import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom'; // Removed BrowserRouter
import { AuthProvider, useAuth } from './hooks/useAuth';
import { BallotProvider } from './hooks/useBallot';
import Header from './components/layout/Header';
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

const AppRoutes: React.FC = () => {
  const { currentUser } = useAuth();

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/ballot-measures" element={<BallotMeasuresListPage />} />
      <Route path="/ballot-measure/:id" element={<BallotMeasureDetailPage />} />
      <Route path="/my-ballot" element={currentUser ? <MyBallotPage /> : <Navigate to="/auth" />} />
      <Route path="/compare" element={<CompareCandidatesPage />} />
      <Route path="/candidate/:id" element={<CandidateProfilePage />} />
      <Route path="/profile" element={currentUser ? <UserProfilePage /> : <Navigate to="/auth" />} />
      <Route path="/auth" element={!currentUser ? <AuthPage /> : <Navigate to="/" />} />
      <Route path="/election-info" element={<ElectionInfoPage />} />
      <Route path="/onboarding" element={currentUser ? <OnboardingPage /> : <Navigate to="/auth" />} />
      {/* Add a catch-all route or a 404 page if desired */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
};

const App: React.FC = () => {
  return (
      <AuthProvider>
        <BallotProvider>
          <div className="min-h-screen flex flex-col">
            <Header />
            {/* Adjusted padding: pt-20 for header (h-16 + p-4), px-4 for horizontal, pb-20 for Navbar */}
            <main className="flex-grow container mx-auto px-4 pt-20 pb-20">
              <AppRoutes />
            </main>
            <Navbar />
          </div>
        </BallotProvider>
      </AuthProvider>
  );
};

export default App;