import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';

const AdminProtectedRoute = ({ children }) => {
 const { admin, loading } = useAdminAuth();
 const location = useLocation();

 // Removed loading check for instant navigation
 if (!admin && !loading) {
 // Redirect to admin login page if not authenticated
 return <Navigate to="/admin/login" state={{ from: location }} replace />;
 }

 return children;
};

export default AdminProtectedRoute;
