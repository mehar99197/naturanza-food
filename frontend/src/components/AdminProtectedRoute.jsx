import { Navigate, useLocation } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';
import { Loader } from '../components/Loader';

const AdminProtectedRoute = ({ children, requireSuper }) => {
 const { admin, loading } = useAdminAuth();
 const location = useLocation();

 if (loading) {
   return <Loader fullScreen />;
 }

 if (!admin) {
   const isStaffLogin = location.pathname === '/admin/staff-login';
   return <Navigate to={isStaffLogin ? '/admin/staff-login' : '/admin/login'} state={{ from: location }} replace />;
 }

 if (requireSuper && admin.admin_role !== 'super_admin') {
   return <Navigate to="/admin/dashboard" replace />;
 }

 return children;
};

export default AdminProtectedRoute;
