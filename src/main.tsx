import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { GoogleOAuthProvider as Provider } from '@react-oauth/google'
import './index.css'
import App from './App.tsx'
import { registerSW } from 'virtual:pwa-register'

// Register service worker for PWA with error handling
try {
  registerSW({ 
    immediate: true,
    onRegisterError(error) {
      console.error('SW registration error', error)
    }
  })
} catch (e) {
  console.warn('PWA registration failed, continuing in standard mode', e)
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider clientId={GOOGLE_CLIENT_ID} {...({ useFedCM: true } as any)}>
      <App />
    </Provider>
  </StrictMode>,
)
