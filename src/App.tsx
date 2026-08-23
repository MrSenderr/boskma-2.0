import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from './lib/auth'
import { Schil } from './components/Schil'
import { Inloggen } from './pages/Inloggen'
import { Vandaag } from './pages/Vandaag'
import { Personeel } from './pages/Personeel'
import { Persoon } from './pages/Persoon'
import { Instellingen } from './pages/Instellingen'
import { Haccp } from './pages/Haccp'
import { Apparaten } from './pages/Apparaten'
import { Taken } from './pages/Taken'
import { Logboek } from './pages/Logboek'
import { Ronde } from './pages/Ronde'
import { huidigeModus } from './lib/modus'
import { Laden } from './components/ui'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
})

function Poort() {
  const { session, bezig } = useAuth()
  if (bezig) return <Laden tekst="Even kijken of je al bent ingelogd…" />
  if (!session) return <Inloggen />

  return (
    <Routes>
      <Route element={<Schil />}>
        {/* In medewerkersmodus is de ronde het startscherm, niet het beheeroverzicht. */}
        <Route index element={huidigeModus() === 'medewerker' ? <Navigate to="/ronde" replace /> : <Vandaag />} />
        <Route path="ronde" element={<Ronde />} />
        <Route path="personeel" element={<Personeel />} />
        <Route path="personeel/:id" element={<Persoon />} />
        <Route path="haccp" element={<Haccp />}>
          <Route index element={<Navigate to="apparaten" replace />} />
          <Route path="apparaten" element={<Apparaten />} />
          <Route path="taken" element={<Taken />} />
          <Route path="logboek" element={<Logboek />} />
        </Route>
        <Route path="instellingen" element={<Instellingen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Poort />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
