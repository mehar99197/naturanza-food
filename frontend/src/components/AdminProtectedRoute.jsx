import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';
import { Loader } from '../components/Loader';

const AdminProtectedRoute = ({ children }) => {
 const { admin, loading } = useAdminAuth();
 const location = useLocation();

 if (loading) {
   return <Loader fullScreen size="md" />;
 }

 if (!admin) {
 return <Navigate to="/admin/login" state={{ from: location }} replace />;
 }

 return children;
};

export default AdminProtectedRoute;
