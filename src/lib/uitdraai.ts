import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'
import type { Meting } from './metingen'
import type { Levering } from './leveringen'
import type { Doorschuif } from './frituurvet'
import type { Weekakkoord } from './week'
import type { Lijst } from './taken'

/* De uitdraai voor een controle. Zie docs/Modules/haccp/haccpmodule.md.

   Bewust een afdrukbare pagina en geen bestand van de server: hoe minder
   onderdelen er stuk kunnen op het moment dat er iemand voor je neus staat, hoe
   beter. Afdrukken of "bewaar als PDF" zit in elke browser.

   Tweede regel: een deel dat niet geladen kan worden zegt dat, groot en
   zichtbaar. Een uitdraai met een stil gat erin is erger dan geen uitdraai. */

/** Supabase geeft standaard duizend regels terug. Bij een periode van maanden is
 *  dat te weinig, en stilzwijgend afkappen mag hier niet. Dus doorlezen tot het
 *  op is. */
async function allesOphalen<T>(
  bouw: (van: number, tot: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<T[]> {
  const stap = 1000
  const alles: T[] = []
  for (let start = 0; ; start += stap) {
    const { data, error } = await bouw(start, start + stap - 1)
    if (error) throw new Error(error.message)
    const rij = (data ?? []) as T[]
    alles.push(...rij)
    if (rij.length < stap) return alles
    // Een noodrem: zoveel regels hoort een snackbar nooit te halen.
    if (alles.length >= 100_000) return alles
  }
}

export type TaakDag = { datum: string; perLijst: Record<string, number> }

export type Onderdeel<T> = { gelukt: true; waarde: T } | { gelukt: false; fout: string }

export type Uitdraai = {
  van: string
  tot: string
  gemaaktOp: string
  metingen: Onderdeel<Meting[]>
  taken: Onderdeel<TaakDag[]>
  leveringen: Onderdeel<Levering[]>
  doorschuiven: Onderdeel<Doorschuif[]>
  weken: Onderdeel<Weekakkoord[]>
}

async function veilig<T>(werk: () => Promise<T>): Promise<Onderdeel<T>> {
  try {
    return { gelukt: true, waarde: await werk() }
  } catch (e) {
    return { gelukt: false, fout: e instanceof Error ? e.message : 'onbekende fout' }
  }
}

export function useUitdraai(van: string, tot: string, aan: boolean) {
  return useQuery({
    queryKey: ['uitdraai', van, tot],
    enabled: aan,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Uitdraai> => {
      const [metingen, taken, leveringen, doorschuiven, weken] = await Promise.all([
        veilig(() =>
          allesOphalen<Meting>((a, b) =>
            supabase
              .from('haccp_temps')
              .select('id,apparaat_id,apparaat_naam,temperatuur,afwijking,datum,tijd,door_naam,actie,opmerking,meetmoment')
              .gte('datum', van).lte('datum', tot)
              .order('datum', { ascending: true }).order('tijd', { ascending: true })
              .range(a, b),
          ),
        ),
        veilig(async () => {
          const [gedaan, lijstjes] = await Promise.all([
            allesOphalen<{ taak_id: number; datum: string }>((a, b) =>
              supabase.from('haccp_taak_gedaan').select('taak_id,datum')
                .gte('datum', van).lte('datum', tot)
                .order('datum', { ascending: true })
                .range(a, b),
            ),
            allesOphalen<{ id: number; lijst: Lijst | null }>((a, b) =>
              supabase.from('haccp_taken').select('id,lijst').range(a, b),
            ),
          ])
          const bij = new Map(lijstjes.map((t) => [t.id, t.lijst ?? 'overig']))
          const perDag = new Map<string, Record<string, number>>()
          gedaan.forEach((g) => {
            const dag = (perDag.get(g.datum) ?? {}) as Record<string, number>
            const lijst = String(bij.get(g.taak_id) ?? 'overig')
            dag[lijst] = (dag[lijst] ?? 0) + 1
            perDag.set(g.datum, dag)
          })
          return [...perDag.entries()]
            .map(([datum, perLijst]) => ({ datum, perLijst }))
            .sort((x, y) => x.datum.localeCompare(y.datum))
        }),
        veilig(() =>
          allesOphalen<Levering>((a, b) =>
            supabase
              .from('haccp_leveringen')
              .select('id,datum,leverancier,temperatuur,ok,opmerking,door_naam,employee_naam,created_at')
              .gte('datum', van).lte('datum', tot)
              .order('datum', { ascending: true })
              .range(a, b),
          ),
        ),
        veilig(() =>
          allesOphalen<Doorschuif>((a, b) =>
            supabase
              .from('haccp_frituurvet')
              .select('id,gedaan_op,datum,door_naam')
              .gte('datum', van).lte('datum', tot)
              .order('gedaan_op', { ascending: true })
              .range(a, b),
          ),
        ),
        veilig(() =>
          allesOphalen<Weekakkoord>((a, b) =>
            supabase
              .from('haccp_weekakkoord')
              .select('id,jaar,iso_week,akkoord_op,door,opmerking')
              .gte('akkoord_op', van).lte('akkoord_op', tot + 'T23:59:59')
              .order('akkoord_op', { ascending: true })
              .range(a, b),
          ),
        ),
      ])

      return {
        van,
        tot,
        gemaaktOp: new Date().toISOString(),
        metingen,
        taken,
        leveringen,
        doorschuiven,
        weken,
      }
    },
  })
}

/** jjjj-mm-dd van zoveel dagen terug. */
export function dagenTerug(dagen: number) {
  const d = new Date()
  d.setDate(d.getDate() - dagen + 1)
  return d.toLocaleDateString('sv-SE')
}

export function vandaagStr() {
  return new Date().toLocaleDateString('sv-SE')
}
