import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import {
 AUTH_SESSION_SYNC_EVENT,
 setUserAccessToken,
 userAPI,
} from '@/services/api';

/**
 * OAuth Callback Handler
 * This component handles redirects from social OAuth providers
 * Extracts token and user data from URL params and stores them
 */
const OAuthCallback = () => {
 const navigate = useNavigate();
 const [searchParams] = useSearchParams();

 useEffect(() => {
 const handleCallback = () => {
 // Extract token and user data from URL params
 const token = searchParams.get('token');
 const userDataString = searchParams.get('user');
 const error = searchParams.get('error');
 const provider = searchParams.get('provider') || 'google';
 const providerName = provider === 'google' ? 'Google' : 'Social';
 const nextPath = searchParams.get('next');
 const safeNextPath = nextPath && nextPath.startsWith('/') && !nextPath.startsWith('//') ? nextPath : '/';

 // Handle errors
 if (error) {
 let errorMessage = `${providerName} authentication failed. Please try again.`;
 if (error === 'auth_failed') {
 errorMessage = 'Authentication failed. Please try again.';
 } else if (error === 'no_user') {
 errorMessage = 'Unable to retrieve user information.';
 } else if (error === 'server_error') {
 errorMessage = 'Server error. Please try again later.';
 } else if (error === 'oauth_not_configured') {
 errorMessage = `${providerName} OAuth is not configured. Please contact the administrator.`;
 }
 
 // Redirect to login with error message
 navigate('/login', { 
 state: { error: errorMessage },
 replace: true 
 });
 return;
 }

 // Validate token and user data
 if (!token || !userDataString) {
 navigate('/login', { 
 state: { error: 'Invalid authentication response' },
 replace: true 
 });
 return;
 }

 try {
 // Parse user data
 const userData = JSON.parse(decodeURIComponent(userDataString));

 // Store access token in memory only.
 setUserAccessToken(token);
 localStorage.setItem('userData', JSON.stringify(userData));

 // Validate token and sync auth context.
 userAPI
 .getProfile()
 .then(() => {
 window.dispatchEvent(
 new CustomEvent(AUTH_SESSION_SYNC_EVENT, {
 detail: {
 source: 'user-login',
 timestamp: Date.now(),
 },
 }),
 );
 navigate(safeNextPath, { replace: true });
 })
 .catch(() => {
 navigate('/login', {
 state: { error: 'Session could not be restored. Please sign in again.' },
 replace: true,
 });
 });
 } catch (error) {
 navigate('/login', { 
 state: { error: 'Failed to process authentication data' },
 replace: true 
 });
 }
 };

 handleCallback();
 }, [navigate, searchParams]);

 return (
 <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100">
 <div className="text-center">
 <Loader2 className="w-12 h-12 text-green-600 mx-auto mb-4" />
 <p className="text-lg text-gray-700">Completing authentication...</p>
 <p className="text-sm text-gray-500 mt-2">Please wait while we log you in</p>
 </div>
 </div>
 );
};

export default OAuthCallback;
