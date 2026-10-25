/* Tijdelijk: het bestelvoorstel met de echte cijfers uit de view. Daarna weg. */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import { InkoopBestellen } from './pages/InkoopBestellen'
import { BreedteProvider } from './lib/breedte'
import type { Bestelregel } from './lib/bestellen'

const V = 'Veldboer Eenhoorn'
const G = 'Het Grootslag'

const r = (
  dagnr: number,
  leverdagen: number,
  lev: string,
  levId: number,
  artikelnr: string,
  naam: string,
  eenheid: string,
  keer: number,
  gemiddeld: number,
  prijs: number,
): Bestelregel =>
  ({
    dagnr,
    leverdagen,
    laatste_dag: '2026-10-20',
    leverancier_id: levId,
    leveranciernaam: lev,
    artikelnr,
    naam,
    eenheid,
    keer,
    gemiddeld: String(gemiddeld),
    hoe_vaak_pct: String(Math.round((100 * keer) / leverdagen)),
    laatst_besteld: '2026-10-20',
    laatste_prijs: String(prijs),
  }) as Bestelregel

const dinsdag: Bestelregel[] = [
  r(2, 12, V, 1, '10234', 'Uien blokjes vers', 'zak', 12, 3.2, 2.54),
  r(2, 12, V, 1, '10988', 'Bieslook', 'bos', 10, 1.0, 1.95),
  r(2, 12, V, 1, '20114', 'Bamischijf extra pittig vega', 'Doos', 9, 3.2, 12.94),
  r(2, 12, V, 1, '20115', 'Frites 10 mm gastro chilled', 'Doos', 9, 15.8, 15.79),
  r(2, 12, V, 1, '10456', 'Komkommer', 'stuks', 9, 3.7, 1.3),
  r(2, 12, V, 1, '20116', 'Loempia kip ham', 'Doos', 9, 3.9, 16.38),
  r(2, 12, V, 1, '10457', 'Sla Lollo Biondo', 'stuks', 9, 2.0, 1.55),
  r(2, 12, G, 2, '30112', 'Brioche bol XL sesam gesneden', 'Doos', 8, 1.5, 9.11),
  r(2, 12, G, 2, '30113', 'Witte ambacht bol gesneden', 'Doos', 8, 5.0, 6.92),
  r(2, 12, V, 1, '20117', 'Mexicano', 'Doos', 8, 4.0, 15.22),
  // Twee die er soms zijn.
  r(2, 12, V, 1, '10999', 'Rucola 125 gram', 'schaal', 4, 1.3, 1.35),
  r(2, 12, G, 2, '30999', 'Cherrytomaten', 'bakje', 3, 3.5, 2.55),
]

const donderdag: Bestelregel[] = [
  r(4, 11, V, 1, '10234', 'Uien blokjes vers', 'zak', 10, 3.0, 2.54),
  r(4, 11, G, 2, '30113', 'Witte ambacht bol gesneden', 'Doos', 9, 6.0, 6.92),
]

const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } })
client.setQueryData(['inkoop', 'bestelpatroon'], [...dinsdag, ...donderdag])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <BreedteProvider>
          <div className="mx-auto w-full max-w-[80rem] p-6">
            <InkoopBestellen />
          </div>
        </BreedteProvider>
      </MemoryRouter>
    </QueryClientProvider>
  </StrictMode>,
)
