/* Wie er op een dag kan, en wie niet.
 *
 * Drie bronnen uit eitje: wat iemand zelf heeft opgegeven, zijn verlof, en
 * ziekmeldingen. Ze zeggen alle drie iets anders en wegen niet even zwaar.
 *
 * **Ziek gaat voor verlof, verlof gaat voor een eigen opgave.** Iemand die
 * ziek is én die week verlof had opgenomen hoort één keer in de lijst te
 * staan, met de reden die ertoe doet. Drie keer dezelfde naam onder elkaar is
 * geen informatie maar ruis, en bij ruis ga je kijken over de lijst heen.
 *
 * **Een lege einddatum betekent: loopt nog.** Eitje geeft een ziekmelding
 * zonder einddatum terug zolang hij loopt. Zou hier `tussen van en tot`
 * gevraagd worden, dan viel zo iemand vanaf dag twee buiten de lijst en stond
 * hij weer gewoon inzetbaar in het rooster.
 *
 * **"Ik kan wel" is ook informatie.** Een oproepkracht die voor zaterdag heeft
 * opgegeven dat hij kan, is wie je het eerst belt als er iemand uitvalt. Dat
 * staat apart, want het is iets anders dan niets weten.
 *
 * **En er is een derde antwoord.** Eitje kent naast "kan" en "kan niet" ook
 * "deels": Nathal die op maandag school heeft, Justin die moet helpen
 * opruimen. Die mag je wél inroosteren, maar niet voor een hele dienst. Dat
 * antwoord viel hier eerst tussen wal en schip — niet weg, niet beschikbaar,
 * dus nergens — en dan rooster je iemand in alsof er niets aan de hand is.
 *
 * Daarom is de regel omgedraaid: alleen "available" telt als onbeperkt kunnen.
 * Alles wat eitje er verder bij verzint komt onder "deels" te staan, met de
 * term er letterlijk bij. Een status die we niet kennen hoort op het scherm,
 * niet in de prullenbak.
 *
 * De tijden zelf geeft de API niet — alleen de dag, de status en de opmerking
 * die iemand erbij typte. Voor "tot hoe laat" moet je dus in eitje kijken.
 */

import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'

export type Opgave = {
  bron_id: string
  datum: string
  status: string | null
  opmerking: string | null
  naam: string | null
  medewerker_id: string | null
}

export type Afwezig = {
  bron_id: string
  soort: 'verlof' | 'ziek'
  van: string
  /** Leeg betekent: loopt nog. */
  tot: string | null
  status: string | null
  reden: string | null
  naam: string | null
  medewerker_id: string | null
}

export type Reden = 'ziek' | 'verlof' | 'opgegeven'

export type Weg = {
  naam: string
  reden: Reden
  /** Wat erbij stond: de opmerking, de reden van het verlof. */
  toelichting: string | null
  /** Bij verlof dat nog niet is goedgekeurd. */
  onzeker: boolean
  medewerker_id: string | null
}

export type Beschikbaar = {
  naam: string
  toelichting: string | null
  medewerker_id: string | null
}

export type DagStand = {
  weg: Weg[]
  /** Kan wel, maar niet de hele dienst. De tijden staan in eitje. */
  deels: Beschikbaar[]
  kan: Beschikbaar[]
}

/** De sleutel waarop iemand wordt herkend: zijn medewerker als die bekend is,
 *  anders zijn naam. Zo valt iemand die in eitje staat maar hier nog niet
 *  gekoppeld is toch samen met zichzelf. */
export function wieSleutel(r: { medewerker_id: string | null; naam: string | null }): string {
  return r.medewerker_id ?? `naam:${((r.naam ?? '').trim() || 'Onbekend').toLowerCase()}`
}

/** Valt deze dag binnen de periode? Een lege einddatum loopt door. */
export function loopt(a: Pick<Afwezig, 'van' | 'tot'>, dag: string): boolean {
  if (!a.van || dag < a.van) return false
  return a.tot === null || dag <= a.tot
}

const naamVan = (r: { naam: string | null }) => (r.naam ?? '').trim() || 'Onbekend'

/* Wie er op één dag weg is en wie er juist kan.
 *
 * De sleutel is de medewerker als die bekend is, en anders de naam. Zo valt
 * iemand die wél in eitje staat maar hier nog niet gekoppeld is toch samen met
 * zichzelf, in plaats van twee keer in de lijst te komen.
 */
export function standVanDag(
  dag: string,
  opgaven: Opgave[],
  afwezig: Afwezig[],
  /* Wie er die dag al op het rooster staat. Die hoeven niet in de lijst
     "kan wel": je zoekt daar iemand om te bellen, en wie al werkt is geen
     reserve. Weglaten mag; dan staat iedereen die kan er gewoon in. */
  ingeroosterd: Iterable<string> = [],
): DagStand {
  const sleutel = wieSleutel
  const staatErAl = new Set(ingeroosterd)

  const weg = new Map<string, Weg>()

  // Eerst ziek, dan verlof: wie al in de lijst staat wordt niet overschreven,
  // dus de zwaarste reden blijft staan.
  for (const soort of ['ziek', 'verlof'] as const) {
    for (const a of afwezig) {
      if (a.soort !== soort || !loopt(a, dag)) continue
      const s = sleutel(a)
      if (weg.has(s)) continue
      weg.set(s, {
        naam: naamVan(a),
        reden: soort,
        toelichting: a.reden,
        onzeker: soort === 'verlof' && a.status !== null && a.status !== 'accepted',
        medewerker_id: a.medewerker_id,
      })
    }
  }

  const kan: Beschikbaar[] = []
  const deels: Beschikbaar[] = []

  for (const o of opgaven) {
    if (o.datum !== dag) continue
    const s = sleutel(o)

    if (o.status === 'unavailable') {
      if (weg.has(s)) continue
      weg.set(s, {
        naam: naamVan(o),
        reden: 'opgegeven',
        toelichting: o.opmerking,
        onzeker: false,
        medewerker_id: o.medewerker_id,
      })
      continue
    }

    /* Wie zegt dat hij kan maar die dag verlof heeft of ziek is, kan niet. De
       opgave is dan ouder dan de werkelijkheid. */
    if (weg.has(s)) continue

    if (o.status === 'available') {
      if (staatErAl.has(s)) continue
      kan.push({ naam: naamVan(o), toelichting: o.opmerking, medewerker_id: o.medewerker_id })
      continue
    }

    /* Alles wat geen "kan" en geen "kan niet" is. Bij eitje heet dat
       "partly_unavailable" — Nathal die school heeft, Justin die moet helpen
       opruimen. Die mag je wél inroosteren, maar niet voor een hele dienst.
       Deze tak vangt ook een status die eitje er later bij verzint: dan staat
       de term er letterlijk bij in plaats van dat de regel verdwijnt. Iemand
       die hier wegvalt, rooster je in alsof er niets aan de hand is. */
    deels.push({
      naam: naamVan(o),
      toelichting: o.opmerking ?? (o.status === 'partly_unavailable' ? null : o.status),
      medewerker_id: o.medewerker_id,
    })
  }

  const opNaam = (a: { naam: string }, b: { naam: string }) => a.naam.localeCompare(b.naam, 'nl')
  return {
    weg: [...weg.values()].sort(opNaam),
    deels: deels.sort(opNaam),
    kan: kan.sort(opNaam),
  }
}

/* --------------------------------------------------------------- ophalen --- */

export function useWieKanEr(van: string, tot: string) {
  return useQuery({
    queryKey: ['wie-kan-er', van, tot],
    queryFn: async (): Promise<{ opgaven: Opgave[]; afwezig: Afwezig[] }> => {
      const { data: opgaven, error } = await supabase
        .from('beschikbaarheid')
        .select('bron_id,datum,status,opmerking,naam,medewerker_id')
        .gte('datum', van)
        .lte('datum', tot)
      if (error) throw new Error(error.message)

      /* Een periode telt mee als hij het venster raakt: begonnen vóór het
         einde, en geëindigd ná het begin of nog lopend. */
      const { data: afwezig, error: fout } = await supabase
        .from('afwezigheid')
        .select('bron_id,soort,van,tot,status,reden,naam,medewerker_id')
        .lte('van', tot)
        .or(`tot.is.null,tot.gte.${van}`)
      if (fout) throw new Error(fout.message)

      return {
        opgaven: (opgaven ?? []) as Opgave[],
        afwezig: (afwezig ?? []) as Afwezig[],
      }
    },
  })
}

export const REDENTEKST: Record<Reden, string> = {
  ziek: 'ziek',
  verlof: 'verlof',
  opgegeven: 'kan niet',
}
