import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from './lib/auth'
import { Schil } from './components/Schil'
import { Inloggen } from './pages/Inloggen'
import { Vandaag } from './pages/Vandaag'
import { Personeel } from './pages/Personeel'
import { Persoon } from './pages/Persoon'
import { Binnenkort } from './pages/Binnenkort'
import { Instellingen } from './pages/Instellingen'
import { Haccp } from './pages/Haccp'
import { Apparaten } from './pages/Apparaten'
import { Ronde } from './pages/Ronde'
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
        <Route index element={<Vandaag />} />
        <Route path="ronde" element={<Ronde />} />
        <Route path="personeel" element={<Personeel />} />
        <Route path="personeel/:id" element={<Persoon />} />
        <Route path="haccp" element={<Haccp />}>
          <Route index element={<Navigate to="apparaten" replace />} />
          <Route path="apparaten" element={<Apparaten />} />
          <Route
            path="taken"
            element={
              <Binnenkort
                module="Taken"
                uitleg="De drie werklijsten — openen, voorbereiden, sluiten — met hun hoeken. Komt hierna."
              />
            }
          />
          <Route
            path="logboek"
            element={
              <Binnenkort
                module="Logboek"
                uitleg="Alle registraties terugkijken en uitdraaien voor een controle. Komt later."
              />
            }
          />
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
