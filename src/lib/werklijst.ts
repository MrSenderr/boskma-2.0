import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import { hoekLabel, type Lijst, type Taak } from './taken'

/* De werklijst zoals een medewerker hem ziet: zijn hoek, en de taken daarin.
   Zie docs/modules/haccp/haccpmodule.md. */

export type Gedaan = {
  taak_id: number
  datum: string
  gedaan_op: string
  door_naam: string | null
}

function vandaagStr() {
  return new Date().toLocaleDateString('sv-SE')
}

function weekTerug() {
  const d = new Date()
  d.setDate(d.getDate() - 6)
  return d.toLocaleDateString('sv-SE')
}

/** Taken van één lijst, met wat er vandaag al is afgevinkt. Wekelijkse taken
 *  gaan mee zodra ze zeven dagen niet gedaan zijn — zo hoeft niemand bij te
 *  houden welke week het is. */
export function useWerklijst(lijst: Lijst) {
  return useQuery({
    queryKey: ['werklijst', lijst, vandaagStr()],
    queryFn: async () => {
      const [takenRes, gedaanRes] = await Promise.all([
        supabase
          .from('haccp_taken')
          .select('id,naam,lijst,hoek,toelichting,ritme,dagen,volgorde,actief,werkwijze_id')
          .eq('lijst', lijst)
          .eq('actief', true)
          .order('volgorde', { ascending: true }),
        supabase
          .from('haccp_taak_gedaan')
          .select('taak_id,datum,gedaan_op,door_naam')
          .gte('datum', weekTerug()),
      ])
      if (takenRes.error) throw new Error(takenRes.error.message)
      if (gedaanRes.error) throw new Error(gedaanRes.error.message)

      const taken = (takenRes.data ?? []) as unknown as Taak[]
      const gedaan = (gedaanRes.data ?? []) as unknown as Gedaan[]
      const vandaag = vandaagStr()

      const relevant = taken.filter((t) => {
        if (t.ritme !== 'wekelijks') return true
        // Deze week al gedaan? Dan hoeft hij niet nog eens.
        return !gedaan.some((g) => g.taak_id === t.id)
      })

      return {
        taken: relevant,
        vandaag: gedaan.filter((g) => g.datum === vandaag),
      }
    },
  })
}

export type HoekStand = {
  hoek: string
  label: string
  taken: Taak[]
  gedaan: number
}

export function perHoek(taken: Taak[], gedaanVandaag: Gedaan[]): HoekStand[] {
  const volgorde: string[] = []
  const kaart = new Map<string, Taak[]>()
  taken.forEach((t) => {
    const h = t.hoek ?? 'overig'
    if (!kaart.has(h)) {
      kaart.set(h, [])
      volgorde.push(h)
    }
    kaart.get(h)!.push(t)
  })
  return volgorde.map((hoek) => {
    const lijst = kaart.get(hoek)!
    return {
      hoek,
      label: hoekLabel(hoek),
      taken: lijst,
      gedaan: lijst.filter((t) => gedaanVandaag.some((g) => g.taak_id === t.id)).length,
    }
  })
}

export function useTaakZetten() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({ taakId, gedaan, door }: { taakId: number; gedaan: boolean; door?: string }) => {
      // De naam gaat mee, want op een tablet is de ingelogde gebruiker het
      // apparaat en niet degene die het deed.
      const { error } = await supabase.rpc('taak_zetten', { taak: taakId, gedaan, door: door ?? null })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['werklijst'] }),
  })
}

/** Stand van alle drie de lijsten, voor het Vandaag-scherm. */
export function useLijstStanden() {
  return useQuery({
    queryKey: ['lijst-standen', vandaagStr()],
    queryFn: async () => {
      const [takenRes, gedaanRes] = await Promise.all([
        supabase
          .from('haccp_taken')
          .select('id,lijst,ritme')
          .eq('actief', true)
          .not('lijst', 'is', null),
        supabase.from('haccp_taak_gedaan').select('taak_id,datum').gte('datum', weekTerug()),
      ])
      if (takenRes.error) throw new Error(takenRes.error.message)
      if (gedaanRes.error) throw new Error(gedaanRes.error.message)

      const taken = (takenRes.data ?? []) as unknown as { id: number; lijst: Lijst; ritme: string }[]
      const gedaan = (gedaanRes.data ?? []) as unknown as { taak_id: number; datum: string }[]
      const vandaag = vandaagStr()

      const stand: Record<string, { totaal: number; gedaan: number }> = {}
      taken.forEach((t) => {
        if (t.ritme === 'wekelijks' && gedaan.some((g) => g.taak_id === t.id)) return
        const s = (stand[t.lijst] ??= { totaal: 0, gedaan: 0 })
        s.totaal++
        if (gedaan.some((g) => g.taak_id === t.id && g.datum === vandaag)) s.gedaan++
      })
      return stand
    },
  })
}
