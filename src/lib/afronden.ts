/* Het voorstel wordt een contract.
 *
 * Dit is de laatste schakel: zolang een getekend contract alleen in het
 * dossier staat, blijft de app rekenen met het contract dat eronder lag. De
 * keten telt verkeerd, de aanzegtermijn wijst naar de oude einddatum, en het
 * seintje over het aanbod vaste uren blijft hangen. Pas als het afgesprokene in
 * public.contracten staat klopt het verhaal weer.
 *
 * Eén onderscheid bepaalt wat hier gebeurt.
 *
 * **Een verlenging is een nieuw contract.** Er komt een rij bij, en die telt
 * mee in de ketenregeling (art. 7:668a BW): drie tijdelijke contracten en dan
 * is het volgende vanzelf vast.
 *
 * **Een aangenomen aanbod vaste uren is géén nieuw contract.** Het lopende
 * contract verandert van vorm; de keten blijft even lang. Zou hier een rij
 * bijkomen, dan zou de app denken dat er een contract meer is geweest en bij de
 * volgende verlenging zeggen dat die vanzelf vast wordt — terwijl dat niet zo
 * is. Daarom wordt het lopende contract bijgewerkt, met een aantekening erbij
 * zodat te zien blijft wat er wanneer veranderde.
 *
 * Een afgewezen verlenging en een voorstel om te stoppen leveren niets op: het
 * contract loopt af op de datum die er al in staat.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import { uur, type Contract, type Duur, type Soort } from './contracten'
import { type Voorstel } from './contractvoorstellen'

const getal = (w: number | string | null | undefined): number | null =>
  w === null || w === undefined || w === '' ? null : Number.isFinite(Number(w)) ? Number(w) : null

const datum = (d: string | null | undefined): string =>
  d
    ? new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString('nl-NL', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '—'

export type Afronding =
  /** Er komt een contract bij: een verlenging of een nieuw dienstverband. */
  | { wat: 'nieuw'; contract: Partial<Contract> & { soort: Soort; duur: Duur; begint: string } }
  /** Het lopende contract verandert van vorm. */
  | { wat: 'bijwerken'; contractId: string; velden: Partial<Contract> }
  /** Er hoeft niets te gebeuren, met de reden erbij. */
  | { wat: 'niets'; reden: string }

/** Wat er met de contractgeschiedenis moet gebeuren na dit voorstel. */
export function afrondingVan(v: Voorstel, lopend: Contract | null): Afronding {
  if (v.ingetrokken_op) return { wat: 'niets', reden: 'Dit voorstel is ingetrokken.' }

  if (v.aard === 'stoppen' || v.keuze_verlenging === 'niet_akkoord') {
    return {
      wat: 'niets',
      reden: 'Het contract wordt niet verlengd en loopt af op de datum die er al in staat.',
    }
  }

  const verlengt = v.keuze_verlenging === 'akkoord'
  const urenAan = v.keuze_vaste_uren === 'aangenomen'

  if (!verlengt && !urenAan) {
    return { wat: 'niets', reden: 'Er is nog niets aangenomen om vast te leggen.' }
  }

  /* Alleen vaste uren aangenomen: het lopende contract verandert van vorm. Geen
     nieuwe rij — dat zou de keten een schakel langer maken dan hij is. */
  if (!verlengt) {
    if (!lopend) {
      return {
        wat: 'niets',
        reden: 'Er staat geen lopend contract waarin de vaste uren kunnen worden bijgeschreven.',
      }
    }
    const n = getal(v.uren_vast)
    return {
      wat: 'bijwerken',
      contractId: lopend.id,
      velden: {
        soort: 'vaste_uren',
        uren_vast: n,
        uren_min: null,
        uren_max: null,
        opmerking: samen(
          lopend.opmerking,
          `Vaste uren aangenomen per ${datum(v.begint)}: ${n === null ? 'aantal onbekend' : `${uur(n)} uur per week`}.`,
        ),
      },
    }
  }

  // Een verlenging: een nieuwe schakel in de keten.
  const duur: Duur = (v.duur ?? 'bepaalde') as Duur
  /* Zijn de vaste uren geweigerd, dan verlengt hij als oproepkracht — ook al
     stond er in het voorstel 'vaste uren', want dat ging over het aanbod. De
     soort uit het voorstel overnemen zou een contract opleveren met precies de
     uren die hij net heeft afgewezen. */
  const soort: Soort = urenAan
    ? 'vaste_uren'
    : v.keuze_vaste_uren === 'geweigerd'
      ? 'nuluren'
      : ((v.soort ?? 'nuluren') as Soort)

  return {
    wat: 'nieuw',
    contract: {
      werkgever: 'boskma',
      soort,
      duur,
      begint: (v.begint ?? '').slice(0, 10),
      eindigt: duur === 'onbepaalde' ? null : (v.eindigt?.slice(0, 10) ?? null),
      uren_vast: soort === 'vaste_uren' ? getal(v.uren_vast) : null,
      uren_min: soort === 'min_max' || soort === 'bandbreedte' ? getal(v.uren_min) : null,
      uren_max: soort === 'min_max' || soort === 'bandbreedte' ? getal(v.uren_max) : null,
      uurloon: getal(v.uurloon),
      functie: v.functie,
      bron: 'voorstel',
      opmerking:
        v.keuze_vaste_uren === 'geweigerd'
          ? 'Aanbod vaste uren geweigerd; blijft oproepkracht.'
          : null,
    },
  }
}

function samen(oud: string | null, nieuw: string): string {
  return [oud?.trim(), nieuw].filter(Boolean).join('\n')
}

/* Het afgesprokene vastleggen en het voorstel eraan koppelen.
 *
 * Eerst het contract, dan de koppeling. Mislukt de koppeling, dan staat het
 * contract er wel en wijst het voorstel er nog niet naar; dat is te herstellen.
 * Andersom zou het voorstel naar een contract wijzen dat niet bestaat. */
export function useVoorstelAfronden(medewerkerId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (opdracht: {
      voorstel: Voorstel
      lopend: Contract | null
      /** Het getekende document, als dat er is. */
      documentId?: number | null
    }) => {
      const afronding = afrondingVan(opdracht.voorstel, opdracht.lopend)
      if (afronding.wat === 'niets') return afronding

      let contractId: string | null = null

      if (afronding.wat === 'nieuw') {
        const { data, error } = await supabase
          .from('contracten')
          .insert({
            ...afronding.contract,
            medewerker_id: medewerkerId,
            document_id: opdracht.documentId ?? null,
          })
          .select('id')
          .single()
        if (error) throw new Error(error.message)
        contractId = (data as { id: string }).id
      } else {
        const { error } = await supabase
          .from('contracten')
          .update({ ...afronding.velden, bijgewerkt_op: new Date().toISOString() })
          .eq('id', afronding.contractId)
        if (error) throw new Error(error.message)
        contractId = afronding.contractId
      }

      const { error: fout } = await supabase
        .from('contractvoorstellen')
        .update({ contract_id: contractId, bijgewerkt_op: new Date().toISOString() })
        .eq('id', opdracht.voorstel.id)
      if (fout) {
        throw new Error(
          `Het contract is vastgelegd, maar het voorstel kon er niet aan gekoppeld worden: ${fout.message}`,
        )
      }

      return afronding
    },
    onSettled: () => {
      client.invalidateQueries({ queryKey: ['contracten', medewerkerId] })
      client.invalidateQueries({ queryKey: ['contractvoorstellen', medewerkerId] })
      client.invalidateQueries({ queryKey: ['contractwaker'] })
    },
  })
}

/* Welk voorstel hoort bij een contract dat nu getekend wordt?
 *
 * Het nieuwste beantwoorde voorstel dat nog geen contract heeft. Meer dan één
 * tegelijk openstaan komt zelden voor, en als het gebeurt is het nieuwste het
 * voorstel waar dit contract uit volgde. */
export function voorstelVoorContract(voorstellen: Voorstel[]): Voorstel | null {
  return (
    voorstellen
      .filter(
        (v) =>
          !v.ingetrokken_op &&
          !v.contract_id &&
          (v.keuze_verlenging === 'akkoord' || v.keuze_vaste_uren === 'aangenomen'),
      )
      .sort((a, b) => b.opgesteld_op.localeCompare(a.opgesteld_op))[0] ?? null
  )
}
