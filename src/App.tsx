import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { supabase } from './lib/supabase'
import { isSessiefout } from './lib/fouten'
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
import { Levering } from './pages/Levering'
import { Melden } from './pages/Melden'
import { Kas } from './pages/Kas'
import { KasTellen } from './pages/KasTellen'
import { KasKluis } from './pages/KasKluis'
import { KasNaslag } from './pages/KasNaslag'
import { KasInstellen } from './pages/KasInstellen'
import { Frituurvet } from './pages/Frituurvet'
import { Leveringen } from './pages/Leveringen'
import { Week } from './pages/Week'
import { Uitdraai } from './pages/Uitdraai'
import { Werkkaarten } from './pages/Werkkaarten'
import { WerkkaartCategorie } from './pages/WerkkaartCategorie'
import { Werkkaart } from './pages/Werkkaart'
import { WerkkaartBeheer } from './pages/WerkkaartBeheer'
import { Werkwijzen } from './pages/Werkwijzen'
import { Werkwijze } from './pages/Werkwijze'
import { Recepten } from './pages/Recepten'
import { Recept } from './pages/Recept'
import { Mep } from './pages/Mep'
import { MepVandaag } from './pages/MepVandaag'
import { MepKlaarzetten } from './pages/MepKlaarzetten'
import { MepLijst } from './pages/MepLijst'
import { Schermen } from './pages/Schermen'
import { SchermenLijst } from './pages/SchermenLijst'
import { SchermAfbeeldingen } from './pages/SchermAfbeeldingen'
import { useWieBenIk } from './lib/wie'
import { VandaagMedewerker } from './pages/VandaagMedewerker'
import { Laden } from './components/ui'
import { useModus } from './lib/modus'
import { Timers } from './lib/timers'
import { WieWerkt } from './lib/wieWerkt'
import { TabletStart, TabletStartUitPad } from './pages/TabletStart'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Een kapotte sessie wordt niet beter van opnieuw proberen: die geeft elke
      // keer dezelfde fout. Al het andere mag één herkansing.
      retry: (poging, fout) =>
        poging < 1 && !isSessiefout(fout instanceof Error ? fout.message : String(fout)),
    },
  },
})

/* Een sessie die niet meer klopt kan de app niet zelf herstellen: verversen lukt
   niet met een kapot token. Dan is uitloggen het enige zinnige, en dat hoort de
   app te doen zonder dat iemand een knop moet zoeken — zeker op een tablet in de
   keuken.

   Eén keer per keer dat de app draait, anders kom je in een kringetje van
   uitloggen en opnieuw proberen. */
let alUitgelogd = false
queryClient.getQueryCache().subscribe((gebeurtenis) => {
  if (gebeurtenis.type !== 'updated' || gebeurtenis.action.type !== 'error') return
  const bericht = (gebeurtenis.action.error as Error | undefined)?.message ?? ''
  if (alUitgelogd || !isSessiefout(bericht)) return

  alUitgelogd = true
  void supabase.auth.signOut().finally(() => window.location.assign('/'))
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
      {/* De tabletmodus hangt aan het adres, niet aan het account: één ding
          om te controleren, en te proberen op elke telefoon. */}
      <Route path="tablet" element={<TabletStart soort="algemeen" />} />
      <Route path="keuken" element={<TabletStart soort="keuken" />} />
      <Route path="zaak" element={<TabletStart soort="zaak" />} />
      <Route path="tablet/:soort" element={<TabletStartUitPad />} />

      <Route element={<Schil />}>
        <Route index element={<Startscherm />} />
        <Route path="temperaturen" element={<Ronde />} />
        {/* Oude adres; blijft werken voor wie hem had opgeslagen. */}
        <Route path="ronde" element={<Navigate to="/temperaturen" replace />} />
        <Route path="taken" element={<MijnTaken />} />
        <Route path="werkkaarten" element={<Werkkaarten />} />
        <Route path="werkkaarten/beheer" element={<WerkkaartBeheer />} />
        <Route path="werkkaarten/kaart/:id" element={<Werkkaart />} />
        <Route path="werkkaarten/:categorie" element={<WerkkaartCategorie />} />
        <Route path="werkwijzen" element={<Werkwijzen />} />
        <Route path="werkwijzen/:id" element={<Werkwijze />} />
        <Route path="recepten" element={<Recepten />} />
        <Route path="recepten/:id" element={<Recept />} />
        <Route path="mep" element={<Mep />}>
          <Route index element={<Navigate to="vandaag" replace />} />
          <Route path="vandaag" element={<MepVandaag />} />
          <Route path="klaarzetten" element={<MepKlaarzetten />} />
          <Route path="lijst" element={<MepLijst />} />
        </Route>
        <Route path="levering" element={<Levering />} />
        <Route path="melden" element={<Melden />} />
        <Route path="kas" element={<Kas />}>
          <Route index element={<Navigate to="tellen" replace />} />
          <Route path="tellen" element={<KasTellen />} />
          <Route path="kluis" element={<KasKluis />} />
          <Route path="naslag" element={<KasNaslag />} />
          <Route path="instellen" element={<KasInstellen />} />
        </Route>
        <Route path="frituurvet" element={<Frituurvet />} />
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
          <Route path="leveringen" element={<Leveringen />} />
          <Route path="week" element={<Week />} />
          <Route path="uitdraai" element={<Uitdraai />} />
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
        <WieWerkt>
          <Timers>
            <BrowserRouter>
              <Poort />
            </BrowserRouter>
          </Timers>
        </WieWerkt>
      </AuthProvider>
    </QueryClientProvider>
  )
}
