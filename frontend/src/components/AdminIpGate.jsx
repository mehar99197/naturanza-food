import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { adminSecurityAPI } from '../services/api';
import { Loader } from './Loader';
import AdminIpBlocked from './AdminIpBlocked';

// Outermost gate for the entire /admin/* URL tree. The moment ANY admin URL is
// opened (including /admin/login), this fetches a public IP-access check and, if
// the requester's IP is not on the admin allowlist, renders an "Unauthorized"
// warning instead of the admin page — so the login form never even appears for
// blocked networks. When allowed, it renders the matched child route via
// <Outlet />. The check runs once on mount; React Router keeps this parent
// element mounted across all /admin/* navigations, so there is a single fetch
// per entry into the admin section (not one per admin sub-route).
const AdminIpGate = () => {
  // ipAccess === null => the first check has not resolved yet.
  const [ipAccess, setIpAccess] = useState(null);
  const [checking, setChecking] = useState(true);

  const check = async () => {
    setChecking(true);
    try {
      const data = await adminSecurityAPI.getIpAccess();
      setIpAccess(data);
    } catch (error) {
      // Fail open on transport errors — the backend gate enforces every admin
      // API on its end, so this only controls page chrome.
      setIpAccess({ allowed: true, enforced: false, currentIp: null });
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // First check not resolved yet → full-screen loader (no login page shown yet).
  if (ipAccess === null && checking) {
    return <Loader fullScreen />;
  }

  // Blocked → "Unauthorized" warning. The matched child route (login, dashboard,
  // etc.) is NOT rendered because we return the warning instead of <Outlet />.
  if (ipAccess && ipAccess.allowed === false) {
    return (
      <AdminIpBlocked
        currentIp={ipAccess.currentIp}
        retrying={checking}
        onRetry={check}
      />
    );
  }

  return <Outlet />;
};

export default AdminIpGate;