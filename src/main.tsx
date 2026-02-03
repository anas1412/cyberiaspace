import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
