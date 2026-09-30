import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { herstelThema } from './lib/thema'
import './index.css'

herstelThema()

/* De service worker vangt de pushberichten van Kim op. Hij onderschept geen
   verzoeken, dus als registreren niet lukt werkt de app gewoon door — je krijgt
   dan alleen geen meldingen. */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((e) => {
      console.warn('Service worker niet geregistreerd:', e)
    })
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
