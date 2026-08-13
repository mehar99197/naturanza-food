import { Navigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAdminAuth } from '../context/AdminAuthContext';
import { adminSecurityAPI } from '../services/api';
import { Loader } from '../components/Loader';
import AdminIpBlocked from './AdminIpBlocked';

const AdminProtectedRoute = ({ children, requireSuper }) => {
  const { admin, loading, adminLogout } = useAdminAuth();
  const location = useLocation();
  // ipAccess === null => gate has not resolved yet (initial check).
  // { allowed: false, enforced, currentIp } => blocked: render the warning screen.
  const [ipAccess, setIpAccess] = useState(null);
  const [ipChecking, setIpChecking] = useState(true);

  const checkIpAccess = async () => {
    setIpChecking(true);
    try {
      const data = await adminSecurityAPI.getIpAccess();
      setIpAccess(data);
    } catch (error) {
      // Fail open on request/transport errors so a flaky network can't lock
      // legitimate admins out of their panel. The backend gate still enforces
      // every admin API, so this only controls the page chrome.
      setIpAccess({ allowed: true, enforced: false, currentIp: null });
    } finally {
      setIpChecking(false);
    }
  };

  useEffect(() => {
    // Only run the gate once the admin session is verified and present.
    if (!loading && admin) {
      checkIpAccess();
    } else if (!loading && !admin) {
      setIpAccess(null);
      setIpChecking(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, admin]);

  // Admin-auth state is still resolving.
  if (loading) {
    return <Loader fullScreen />;
  }

  // Not an admin session — send to the appropriate admin login screen.
  if (!admin) {
    const isStaffLogin = location.pathname === '/admin/staff-login';
    return <Navigate to={isStaffLogin ? '/admin/staff-login' : '/admin/login'} state={{ from: location }} replace />;
  }

  // Initial IP-gate check has not returned a result yet.
  if (ipAccess === null && ipChecking) {
    return <Loader fullScreen />;
  }

  // Blocked IP — show the warning instead of any admin page.
  if (ipAccess && ipAccess.allowed === false) {
    return (
      <AdminIpBlocked
        currentIp={ipAccess.currentIp}
        retrying={ipChecking}
        onRetry={checkIpAccess}
        onLogout={adminLogout}
      />
    );
  }

  // requireSuper branch kept for backward compatibility with callers that pass it.
  if (requireSuper && admin.admin_role !== 'super_admin') {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return children;
};

export default AdminProtectedRoute;