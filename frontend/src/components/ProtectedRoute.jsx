import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader } from './Loader';

const ProtectedRoute = ({ children }) => {
 const { user, loading } = useAuth();
 const location = useLocation();

 if (loading) {
 return <Loader />;
 }

 if (!user) {
 // Redirect to login page but save the location they were trying to access
 return <Navigate to="/login" state={{ from: location }} replace />;
 }

 return children;
};

export default ProtectedRoute;
