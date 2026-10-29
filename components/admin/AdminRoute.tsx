import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { auth } from '../../firebase';
import { isUserAdmin } from '../../services/firestoreDataService';
import LoadingSpinner from '../ui/LoadingSpinner';

/**
 * Wraps admin-only pages.
 *
 * This is a convenience gate so non-admins never see admin screens. The real
 * enforcement is in firestore.rules / storage.rules: even if someone bypasses
 * this component, their writes are rejected unless their verified email is in
 * config/admin.adminEmails.
 */
const AdminRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { currentUser } = useAuth();
  const [status, setStatus] = useState<'checking' | 'allowed' | 'denied'>('checking');

  useEffect(() => {
    let cancelled = false;
    async function check() {
      const fbUser = auth.currentUser;
      if (!currentUser || !fbUser || !fbUser.emailVerified) {
        if (!cancelled) setStatus('denied');
        return;
      }
      const ok = await isUserAdmin(fbUser.email ?? undefined);
      if (!cancelled) setStatus(ok ? 'allowed' : 'denied');
    }
    setStatus('checking');
    check();
    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  if (!currentUser) return <Navigate to="/auth" />;
  if (status === 'checking') return <LoadingSpinner />;
  if (status === 'denied') {
    return (
      <div className="max-w-xl mx-auto bg-white rounded-lg border border-gray-200 p-6 text-center">
        <h1 className="text-xl font-bold text-midnight-navy mb-2">Admins only</h1>
        <p className="text-sm text-gray-600">
          This area is restricted. If you should have access, ask an existing admin to add your
          email, and make sure you sign in with a verified email (Google sign-in is verified
          automatically).
        </p>
      </div>
    );
  }
  return children;
};

export default AdminRoute;
