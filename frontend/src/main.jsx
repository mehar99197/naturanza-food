import { StrictMode, Fragment } from 'react'
import { createRoot } from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import { GoogleOAuthProvider } from '@react-oauth/google'
import './index.css'
import App from './App.jsx'

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
const allowDevGoogle =
 String(import.meta.env.VITE_GOOGLE_ALLOW_DEV || '').trim().toLowerCase() === 'true'
const isGoogleConfigured = Boolean(
	googleClientId &&
		googleClientId !== 'YOUR_GOOGLE_CLIENT_ID_HERE' &&
		(!import.meta.env.DEV || allowDevGoogle)
)

const RootWrapper = import.meta.env.DEV ? Fragment : StrictMode

createRoot(document.getElementById('root')).render(
	<RootWrapper>
		<HelmetProvider>
			{isGoogleConfigured ? (
				<GoogleOAuthProvider clientId={googleClientId}>
					<App />
				</GoogleOAuthProvider>
			) : (
				<App />
			)}
		</HelmetProvider>
	</RootWrapper>,
)
