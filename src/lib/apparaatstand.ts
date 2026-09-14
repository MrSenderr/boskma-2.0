import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'
import { isAfwijking, isSignaal, type Meting } from './metingen'
import { useApparaten, type Apparaat } from './apparaten'
import { dagenGeleden } from './opmaak'

/* Hoe je apparatuur ervoor staat.
 *
 * Sinds september 2026 is dit geen HACCP-scherm meer maar een onderhoudsreeks:
 * niet "is er vandaag afgevinkt", maar "hoe gedraagt dit apparaat zich". Een
 * koeling die langzaam warmer wordt zie je daarmee aankomen voordat hij het
 * begeeft.
 *
 * Daarom staat "hoe lang geleden gemeten" er net zo prominent bij als de
 * temperatuur zelf. Een reeks met gaten zegt weinig, en dat hoor je te zien. */

const VELDEN =
  'id,apparaat_id,apparaat_naam,temperatuur,afwijking,datum,tijd,door_naam,actie,opmerking,meetmoment'

/** Hoeveel dagen zonder meting we nog gewoon vinden. */
const STIL_NA_DAGEN = 3

export type Stand = {
  apparaat: Apparaat
  laatste: Meting | null
  dagenGeleden: number | null
  /** fout = buiten de grenzen, letop = binnen de grens maar tegen je eigen
   *  signaalgrens aan of al dagen niet gemeten, goed = niets aan de hand. */
  soort: 'goed' | 'letop' | 'fout' | 'neutraal'
  toelichting: string
}

function laatsteVan(metingen: Meting[], apparaat: Apparaat): Meting | null {
  // Op naam terugvallen: oudere metingen uit de vorige app hebben geen
  // apparaat_id, maar wel de naam zoals die toen was.
  const mijne = metingen.filter(
    (m) => m.apparaat_id === apparaat.id || (m.apparaat_id === null && m.apparaat_naam === apparaat.naam),
  )
  return mijne[0] ?? null
}

function beoordeel(apparaat: Apparaat, laatste: Meting | null): Pick<Stand, 'soort' | 'toelichting'> {
  if (!laatste) return { soort: 'neutraal', toelichting: 'Nog nooit gemeten' }

  const dagen = dagenGeleden(laatste.datum)
  if (isAfwijking(apparaat, laatste.temperatuur)) {
    return { soort: 'fout', toelichting: 'Buiten de grenzen' }
  }
  if (dagen > STIL_NA_DAGEN) {
    return { soort: 'letop', toelichting: `${dagen} dagen niet gemeten` }
  }
  if (isSignaal(apparaat, laatste.temperatuur)) {
    return { soort: 'letop', toelichting: 'Tegen je signaalgrens aan' }
  }
  return { soort: 'goed', toelichting: 'In orde' }
}

export function useApparaatstand() {
  const apparaten = useApparaten()

  const metingen = useQuery({
    queryKey: ['laatste-metingen'],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Meting[]> => {
      // Nieuwste eerst; per apparaat pakken we de bovenste. Twee maanden is
      // ruim genoeg om "al weken niet gemeten" te kunnen zien zonder de hele
      // geschiedenis op te halen.
      const grens = new Date()
      grens.setDate(grens.getDate() - 60)
      const { data, error } = await supabase
        .from('haccp_temps')
        .select(VELDEN)
        .gte('datum', grens.toLocaleDateString('sv-SE'))
        .order('datum', { ascending: false })
        .order('tijd', { ascending: false })
      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as Meting[]
    },
  })

  const lijst: Stand[] = (apparaten.data ?? [])
    .filter((a) => a.actief)
    .map((apparaat) => {
      const laatste = laatsteVan(metingen.data ?? [], apparaat)
      return {
        apparaat,
        laatste,
        dagenGeleden: laatste ? dagenGeleden(laatste.datum) : null,
        ...beoordeel(apparaat, laatste),
      }
    })

  return {
    lijst,
    isPending: apparaten.isPending || metingen.isPending,
    error: apparaten.error ?? metingen.error,
    refetch: () => {
      apparaten.refetch()
      metingen.refetch()
    },
  }
}

/** Wat er op dit moment aandacht vraagt. Bepaalt of het blok überhaupt opvalt. */
export function vraagtAandacht(lijst: Stand[]) {
  return lijst.filter((s) => s.soort === 'fout' || s.soort === 'letop')
}
