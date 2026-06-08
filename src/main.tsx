import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initSettings } from './utils/settings'

// Show brief loading while settings load from Dexie
const rootEl = document.getElementById('root')!;
rootEl.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#05060a"><div style="width:24px;height:24px;border:2px solid rgba(99,102,241,0.2);border-top-color:#6366f1;border-radius:50%;animation:spin 0.8s linear infinite"></div></div><style>@keyframes spin{to{transform:rotate(360deg)}}</style>';

initSettings().then(() => {
  rootEl.innerHTML = '';
  createRoot(rootEl).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
