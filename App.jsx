import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/supabaseClient';

import Dashboard from '@/pages/Dashboard';
import AdminDashboard from '@/pages/AdminDashboard';
import ExamSession from '@/pages/ExamSession';
import PublicExamPlayer from '@/pages/PublicExamPlayer';
import LoginPage from '@/pages/LoginPage';
import PublicExams from '@/pages/PublicExams';
import SessionResults from '@/pages/SessionResults';
import { Toaster } from '@/components/ui/toaster';

const AdminRoute = ({ children, session }) => {
  const isAdmin = sessionStorage.getItem('isAdminAccess') === 'true';
  if (!session) return <Navigate to="/login" />;
  if (!isAdmin) return <Navigate to="/dashboard" />;
  return children;
};

const ProtectedRoute = ({ children, session }) => {
    if (!session) {
      return <Navigate to="/login" />;
    }
    return children;
};

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setLoading(false);
    };

    getSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (_event === 'SIGNED_OUT') {
        sessionStorage.removeItem('isAdminAccess');
      }
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-indigo-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400"></div>
      </div>
    );
  }

  return (
    <Router>
      <Helmet>
        <title>منصة الاختبارات التفاعلية</title>
        <meta name="description" content="نظام متطور لإنشاء وإدارة الاختبارات الثابتة والجلسات المباشرة مع تجميع النتائج." />
      </Helmet>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-indigo-900">
        <Routes>
          <Route path="/" element={<PublicExams />} />
          <Route path="/login" element={!session ? <LoginPage /> : <Navigate to="/dashboard" />} />
          <Route path="/dashboard" element={<ProtectedRoute session={session}><Dashboard /></ProtectedRoute>} />
          <Route path="/admin" element={<AdminRoute session={session}><AdminDashboard /></AdminRoute>} />
          <Route path="/results/:testId" element={<ProtectedRoute session={session}><SessionResults /></ProtectedRoute>} />
          <Route path="/session/:examId" element={<ExamSession />} />
          <Route path="/exam/:examId" element={<PublicExamPlayer />} />
        </Routes>
        <Toaster />
      </div>
    </Router>
  );
}

export default App;