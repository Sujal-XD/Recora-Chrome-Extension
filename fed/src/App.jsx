import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useLenis } from './hooks/useLenis';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import HomePage from './pages/HomePage';

import RewardsPage from './pages/RewardsPage';
import HistoryPage from './pages/HistoryPage';
import RecordingGuidePage from './pages/RecordingGuidePage';
import ProtectedRoute from './components/ProtectedRoute';

// This is the beautiful, performant "corner blob" background from your screenshot.
const AnimatedGradientBackground = () => (
  <div className="fixed top-0 left-0 w-full h-full z-[-1] overflow-hidden">
    <motion.div
      className="absolute -top-1/2 -left-1/4 w-3/4 h-3/4 rounded-full bg-purple-600/30 dark:bg-purple-900/40 filter blur-3xl opacity-50"
      animate={{ x: [-100, 100, -100], y: [-100, 100, -100] }}
      transition={{ duration: 25, repeat: Infinity, repeatType: "mirror", ease: 'easeInOut' }}
    />
    <motion.div
      className="absolute -bottom-1/2 -right-1/4 w-3/4 h-3/4 rounded-full bg-sky-500/30 dark:bg-sky-900/40 filter blur-3xl opacity-50"
      animate={{ x: [100, -100, 100], y: [100, -100, 100] }}
      transition={{ duration: 25, repeat: Infinity, repeatType: "mirror", ease: 'easeInOut' }}
    />
  </div>
);

function App() {
  useLenis();

  return (
    <Router>
      <div className="min-h-screen font-sans relative">
        <AnimatedGradientBackground />
        {/* Navbar and Footer are now present on all pages */}
        <Navbar />
        <main>
          <Routes>
            <Route path="/" element={<HomePage />} />
            
            <Route path="/rewards" element={<RewardsPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/record" element={<ProtectedRoute><RecordingGuidePage /></ProtectedRoute>} />
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  );
}

export default App;