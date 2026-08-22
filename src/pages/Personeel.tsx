import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { Kaart, Kopje, Laden, Leeg, Mislukt, Pil } from '../components/ui'

// Bewust géén onboarding_data in de select: daar staan BSN en IBAN in en die
// horen alleen in het scherm waar ze echt nodig zijn.
const VELDEN = 'id,voornaam,achternaam,status,aangemeld_op,onboarding_verstuurd_op,onboarding_ingevuld_op'

export type Sollicitatie = {
  id: string
  voornaam: string | null
  achternaam: string | null
  status: string | null
  aangemeld_op: string | null
  onboarding_verstuurd_op: string | null
  onboarding_ingevuld_op: string | null
}

/** De weg die iemand aflegt, van sollicitatie tot in dienst. */
const KETEN = [
  { sleutel: 'nieuw', label: 'Nieuw' },
  { sleutel: 'eerste_contact', label: 'Contact' },
  { sleutel: 'gesprek', label: 'Gesprek' },
  { sleutel: 'aangenomen', label: 'Aangenomen' },
] as const

export function useSollicitaties() {
  return useQuery({
    queryKey: ['sollicitaties'],
    queryFn: async (): Promise<Sollicitatie[]> => {
      const { data, error } = await supabase
        .from('sollicitaties')
        .select(VELDEN)
        .order('aangemeld_op', { ascending: false })
      if (error) throw new Error(error.message)
      return (data ?? []) as Sollicitatie[]
    },
  })
}

function naam(s: Sollicitatie) {
  return [s.voornaam, s.achternaam].filter(Boolean).join(' ') || 'Naamloos'
}

function sinds(datum: string | null) {
  if (!datum) return '—'
  const dagen = Math.floor((Date.now() - new Date(datum).getTime()) / 86_400_000)
  if (dagen <= 0) return 'vandaag'
  if (dagen === 1) return '1 dag'
  return `${dagen} dagen`
}

/** Wat er nu van jou wordt verwacht — het enige dat je echt hoeft te lezen. */
export function watErNuMoet(s: Sollicitatie): { tekst: string; soort: 'goed' | 'letop' | 'fout' | 'neutraal' } {
  if (s.status === 'afgewezen') return { tekst: 'Afgerond', soort: 'neutraal' }
  if (s.status === 'aangenomen') {
    if (s.onboarding_ingevuld_op) return { tekst: 'Klaar voor het loonbureau', soort: 'goed' }
    if (s.onboarding_verstuurd_op) return { tekst: 'Wacht op ingevulde gegevens', soort: 'letop' }
    return { tekst: 'Gegevenslink versturen', soort: 'fout' }
  }
  if (s.status === 'gesprek') return { tekst: 'Gesprek inplannen of afronden', soort: 'letop' }
  if (s.status === 'eerste_contact') return { tekst: 'Wacht op antwoord', soort: 'neutraal' }
  return { tekst: 'Nog niet gereageerd', soort: 'fout' }
}

export function Personeel() {
  const { data, isPending, error, refetch } = useSollicitaties()

  if (isPending) return <Laden tekst="Personeel laden…" />
  if (error) return <Mislukt tekst={error.message} opnieuw={() => refetch()} />
  if (!data.length) {
    return <Leeg titel="Nog geen sollicitaties" uitleg="Zodra iemand het formulier op werkenbij.snackerietzonnetje.nl invult, verschijnt die hier." />
  }

  const lopend = data.filter((s) => s.status !== 'afgewezen')

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <Kopje>De rij</Kopje>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {KETEN.map(({ sleutel, label }) => {
            const aantal = data.filter((s) => (s.status ?? 'nieuw') === sleutel).length
            return (
              <Kaart key={sleutel} className="min-w-28 flex-1 px-3 py-2.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
                <p className="font-display text-2xl tabular-nums">{aantal}</p>
              </Kaart>
            )
          })}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <Kopje>Wat er nu moet</Kopje>
        <Kaart className="overflow-x-auto">
          <table className="w-full min-w-[34rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted">Wie</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted">Wat er nu moet</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted">Sinds</th>
              </tr>
            </thead>
            <tbody>
              {lopend.map((s) => {
                const actie = watErNuMoet(s)
                return (
                  <tr key={s.id} className="border-b border-line last:border-b-0">
                    <td className="px-4 py-3 font-semibold">{naam(s)}</td>
                    <td className="px-4 py-3">
                      <Pil soort={actie.soort}>{actie.tekst}</Pil>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-muted">{sinds(s.aangemeld_op)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Kaart>
      </section>
    </div>
  )
}
