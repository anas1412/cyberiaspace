import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { GoogleOAuthProvider as Provider } from '@react-oauth/google'
import './index.css'
import App from './App.tsx'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider clientId={GOOGLE_CLIENT_ID} {...({ useFedCM: true } as any)}>
      <App />
    </Provider>
  </StrictMode>,
)

