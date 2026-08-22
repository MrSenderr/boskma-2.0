import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { herstelThema } from './lib/thema'
import './index.css'

herstelThema()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
