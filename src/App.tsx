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
import { Werklijst } from './pages/Werklijst'
import { MijnGegevens } from './pages/MijnGegevens'
import { MijnDossier } from './pages/MijnDossier'
import { MijnTaken } from './pages/MijnTaken'
import { useWieBenIk } from './lib/wie'
import { VandaagMedewerker } from './pages/VandaagMedewerker'
import { Laden } from './components/ui'
import { useModus } from './lib/modus'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
})

/* Wat je op het startscherm ziet hangt af van wie je bent, niet van een
   schakelaar in de browser: een medewerker hoort het beheeroverzicht niet te
   zien, ook niet heel even. */
function Startscherm() {
  const { data: wie, isPending } = useWieBenIk()
  const [modus] = useModus()
  if (isPending) return <Laden />
  if (wie?.rol !== 'beheerder') return <VandaagMedewerker />
  return modus === 'medewerker' ? <VandaagMedewerker /> : <Vandaag />
}

function Poort() {
  const { session, bezig } = useAuth()
  if (bezig) return <Laden tekst="Even kijken of je al bent ingelogd…" />
  if (!session) return <Inloggen />

  return (
    <Routes>
      <Route element={<Schil />}>
        <Route index element={<Startscherm />} />
        <Route path="temperaturen" element={<Ronde />} />
        {/* Oude adres; blijft werken voor wie hem had opgeslagen. */}
        <Route path="ronde" element={<Navigate to="/temperaturen" replace />} />
        <Route path="taken" element={<MijnTaken />} />
        <Route path="lijst/:lijst" element={<Werklijst />} />
        <Route path="mijn-gegevens" element={<MijnGegevens />} />
        <Route path="mijn-dossier" element={<MijnDossier />} />
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
