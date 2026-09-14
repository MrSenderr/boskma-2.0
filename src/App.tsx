import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from './lib/auth'
import { Schil } from './components/Schil'
import { Inloggen } from './pages/Inloggen'
import { Vandaag } from './pages/Vandaag'
import { Personeel } from './pages/Personeel'
import { Persoon } from './pages/Persoon'
import { Instellingen } from './pages/Instellingen'
import { MijnGegevens } from './pages/MijnGegevens'
import { MijnDossier } from './pages/MijnDossier'
import { Schermen } from './pages/Schermen'
import { SchermenLijst } from './pages/SchermenLijst'
import { SchermAfbeeldingen } from './pages/SchermAfbeeldingen'
import { useWieBenIk } from './lib/wie'
import { VandaagMedewerker } from './pages/VandaagMedewerker'
import { Laden } from './components/ui'
import { useModus } from './lib/modus'
import { isTijdelijkeKlokfout } from './lib/fouten'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      /* Normaal één herkansing. Alleen als de server je inlogbewijs "nog te
         vroeg" vindt langer doorproberen: dat trekt vanzelf bij. */
      retry: (poging, fout) =>
        isTijdelijkeKlokfout(fout instanceof Error ? fout.message : String(fout))
          ? poging < 5
          : poging < 1,
      retryDelay: (poging) => Math.min(1000 * 2 ** poging, 15_000),
    },
  },
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
        <Route path="mijn-gegevens" element={<MijnGegevens />} />
        <Route path="mijn-dossier" element={<MijnDossier />} />
        <Route path="personeel" element={<Personeel />} />
        <Route path="personeel/:id" element={<Persoon />} />
        <Route path="schermen" element={<Schermen />}>
          <Route index element={<Navigate to="lijst" replace />} />
          <Route path="lijst" element={<SchermenLijst />} />
          <Route path="afbeeldingen" element={<SchermAfbeeldingen />} />
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
