import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from './lib/auth'
import { Schil } from './components/Schil'
import { Inloggen } from './pages/Inloggen'
import { Vandaag } from './pages/Vandaag'
import { Personeel } from './pages/Personeel'
import { Kim } from './pages/Kim'
import { Kas } from './pages/Kas'
import { Inkoop } from './pages/Inkoop'
import { InkoopDocumenten } from './pages/InkoopDocumenten'
import { InkoopFactuur } from './pages/InkoopFactuur'
import { InkoopPrijsmutaties } from './pages/InkoopPrijsmutaties'
import { InkoopPrijsverloop } from './pages/InkoopPrijsverloop'
import { InkoopStuksprijzen } from './pages/InkoopStuksprijzen'
import { InkoopUploaden } from './pages/InkoopUploaden'
import { InkoopSamenstellingen } from './pages/InkoopSamenstellingen'
import { InkoopSamenstelling } from './pages/InkoopSamenstelling'
import { Facturen } from './pages/Facturen'
import { FacturenInkomend } from './pages/FacturenInkomend'
import { FacturenUitgaand } from './pages/FacturenUitgaand'
import { FacturenLeveranciers } from './pages/FacturenLeveranciers'
import { FacturenKlanten } from './pages/FacturenKlanten'
import { FacturenPrijslijst } from './pages/FacturenPrijslijst'
import { Verkoopfactuur } from './pages/Verkoopfactuur'
import { Rooster } from './pages/Rooster'
import { RoosterDag } from './pages/RoosterDag'
import { RoosterMedewerkers } from './pages/RoosterMedewerkers'
import { RoosterImporteren } from './pages/RoosterImporteren'
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
        <Route path="kim" element={<Kim />} />
        <Route path="facturen" element={<Facturen />}>
          <Route index element={<Navigate to="inkomend" replace />} />
          <Route path="inkomend" element={<FacturenInkomend />} />
          <Route path="uitgaand" element={<FacturenUitgaand />} />
          <Route path="uitgaand/:id" element={<Verkoopfactuur />} />
          <Route path="klanten" element={<FacturenKlanten />} />
          <Route path="prijslijst" element={<FacturenPrijslijst />} />
          <Route path="leveranciers" element={<FacturenLeveranciers />} />
        </Route>
        <Route path="kas" element={<Kas />} />
        {/* Inkoop: de facturen van de groothandel. Het scherm komt uit de losse
            inkoop-app en wordt hier stuk voor stuk opnieuw opgebouwd. */}
        <Route path="inkoop" element={<Inkoop />}>
          <Route index element={<Navigate to="documenten" replace />} />
          <Route path="documenten" element={<InkoopDocumenten />} />
          <Route path="documenten/:levId/:nummer" element={<InkoopFactuur />} />
          <Route path="prijzen" element={<InkoopPrijsmutaties />} />
          <Route path="prijzen/:levId/:artikelnr" element={<InkoopPrijsverloop />} />
          <Route path="stuksprijzen" element={<InkoopStuksprijzen />} />
          <Route path="producten" element={<InkoopSamenstellingen />} />
          <Route path="producten/:id" element={<InkoopSamenstelling />} />
          <Route path="uploaden" element={<InkoopUploaden />} />
        </Route>
        <Route path="personeel" element={<Personeel />} />
        <Route path="personeel/:id" element={<Persoon />} />
        <Route path="rooster" element={<Rooster />}>
          <Route index element={<Navigate to="dag" replace />} />
          <Route path="dag" element={<RoosterDag />} />
          {/* Oude adres; blijft werken voor wie hem had opgeslagen. */}
          <Route path="week" element={<Navigate to="/rooster/dag" replace />} />
          <Route path="medewerkers" element={<RoosterMedewerkers />} />
          <Route path="importeren" element={<RoosterImporteren />} />
        </Route>
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
