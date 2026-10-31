import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/manrope/index.css'
import '@fontsource/unbounded/cyrillic-600.css'
import '@fontsource/unbounded/latin-600.css'
import '@fontsource/unbounded/cyrillic-700.css'
import './styles/global.css'
import App from './App.tsx'
import { wireProgress } from './lib/progress'
import { wireAchievements } from './lib/achievements'

wireProgress()
wireAchievements()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
