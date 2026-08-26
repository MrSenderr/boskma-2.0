import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import { useWieBenIk } from './wie'

/* Wat een medewerker in zijn menu ziet. Zie docs/Modules/rechten.md.

   Dit gaat over overzicht, niet over veiligheid. Staat 'recepten' uit, dan is
   het menu-item weg — maar de knop 'Recept' bij een MEP-taak werkt gewoon, en
   wie het adres intikt komt er ook. Dat is de bedoeling: je ruimt een menu op,
   je sluit niets af. De echte grenzen staan in de database.

   De tabel bewaart wat er WEG moet, niet wat er mag. Daarmee ziet een nieuwe
   medewerker vanzelf alles, en is dit een uitzondering die je bewust maakt in
   plaats van een lijst die je bij iedere nieuwe medewerker moet aanvinken. */

export type Onderdeel =
  | 'temperaturen'
  | 'taken'
  | 'mep'
  | 'werkkaarten'
  | 'recepten'
  | 'werkwijzen'
  | 'levering'
  | 'frituurvet'
  | 'melden'

export const ONDERDELEN: { waarde: Onderdeel; label: string; uitleg: string }[] = [
  { waarde: 'temperaturen', label: 'Temperaturen', uitleg: 'De openings- en sluitingsronde langs de koelingen.' },
  { waarde: 'taken', label: 'Taken', uitleg: 'De werklijsten en de klussen die jij persoonlijk geeft.' },
  { waarde: 'mep', label: 'MEP', uitleg: 'De voorbereidingslijst voor de keuken.' },
  { waarde: 'werkkaarten', label: 'Werkkaarten', uitleg: 'Hoe je een gerecht opbouwt, met de timers.' },
  { waarde: 'recepten', label: 'Recepten', uitleg: 'Ingrediënten en bereiding.' },
  { waarde: 'werkwijzen', label: 'Werkwijzen', uitleg: 'Uitleg met stappen en foto’s.' },
  { waarde: 'levering', label: 'Levering aantekenen', uitleg: 'Knop onder Tussendoor op zijn startscherm.' },
  { waarde: 'frituurvet', label: 'Frituurvet', uitleg: 'Knop onder Tussendoor op zijn startscherm.' },
  { waarde: 'melden', label: 'Iets melden', uitleg: 'Knop onder Tussendoor op zijn startscherm.' },
]

/** Wat er voor mij verborgen is. Beheerders zien altijd alles. */
export function useMijnVerborgen() {
  const { data: wie } = useWieBenIk()
  return useQuery({
    queryKey: ['mijn-verborgen', wie?.medewerker_id, wie?.rol],
    enabled: Boolean(wie),
    queryFn: async (): Promise<Onderdeel[]> => {
      if (wie?.rol === 'beheerder' || !wie?.medewerker_id) return []
      const { data, error } = await supabase
        .from('medewerker_verborgen')
        .select('onderdeel')
        .eq('medewerker_id', wie.medewerker_id)
      if (error) throw new Error(error.message)
      return (data ?? []).map((r) => (r as { onderdeel: Onderdeel }).onderdeel)
    },
  })
}

export function zieIk(verborgen: Onderdeel[] | undefined, onderdeel: Onderdeel) {
  return !(verborgen ?? []).includes(onderdeel)
}

/* ------------------------------------------------------------- beheerkant --- */

export function useVerborgenVan(medewerkerId: string | undefined) {
  return useQuery({
    queryKey: ['verborgen-van', medewerkerId],
    enabled: Boolean(medewerkerId),
    queryFn: async (): Promise<Onderdeel[]> => {
      const { data, error } = await supabase
        .from('medewerker_verborgen')
        .select('onderdeel')
        .eq('medewerker_id', medewerkerId!)
      if (error) throw new Error(error.message)
      return (data ?? []).map((r) => (r as { onderdeel: Onderdeel }).onderdeel)
    },
  })
}

export function useZichtbaarZetten(medewerkerId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({ onderdeel, zichtbaar }: { onderdeel: Onderdeel; zichtbaar: boolean }) => {
      if (zichtbaar) {
        const { error } = await supabase
          .from('medewerker_verborgen')
          .delete()
          .eq('medewerker_id', medewerkerId)
          .eq('onderdeel', onderdeel)
        if (error) throw new Error(error.message)
      } else {
        const { error } = await supabase
          .from('medewerker_verborgen')
          .insert({ medewerker_id: medewerkerId, onderdeel })
        if (error) throw new Error(error.message)
      }
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['verborgen-van'] })
      client.invalidateQueries({ queryKey: ['mijn-verborgen'] })
    },
  })
}
