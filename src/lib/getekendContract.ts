import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import type { Persoon } from './personeel'

/* Getekende contracten: staat er bij iedereen één in het dossier, en is hij
   naar het loonbureau als dat het contract heeft opgesteld?

   Er is geen takenlijst. Wat er moet gebeuren volgt uit de kaart van de
   medewerker en zijn documenten; zodra het getekende contract er staat en weg
   is, verdwijnt de actie vanzelf. */

export type Stand =
  /** Loonbureau heeft het contract opgesteld; de getekende versie ontbreekt. */
  | 'uploaden'
  /** Getekend contract staat er, maar is nog niet naar het loonbureau. */
  | 'versturen'
  /** Geen getekend contract, en het loonbureau stelt het ook niet op. */
  | 'ontbreekt'
  | 'in_orde'

export type ContractStand = {
  persoonId: string
  naam: string
  stand: Stand
  /** Het getekende contract waar het om gaat, als het er is. */
  documentId: number | null
  /** De laatste foutmelding bij versturen. */
  fout: string | null
}

export type GetekendDocument = {
  id: number
  medewerker_id: string
  toegevoegd_op: string
  naar_loonbureau_op: string | null
  naar_loonbureau_fout: string | null
}

type Medewerker = Pick<
  Persoon,
  'id' | 'voornaam' | 'achternaam' | 'fase' | 'uit_dienst_op' | 'is_eigenaar' | 'loonbureau_verstuurd_op'
> & { contract_door_loonbureau?: boolean | null }

/** Heeft het loonbureau het contract al in de maak? Pas als het mutatieformulier
    met dat verzoek weg is. */
export function loonbureauMaaktContract(p: Medewerker) {
  return Boolean(p.contract_door_loonbureau && p.loonbureau_verstuurd_op)
}

export function standVan(p: Medewerker, documenten: GetekendDocument[]): ContractStand {
  const eigen = documenten
    .filter((d) => d.medewerker_id === p.id)
    .sort((a, b) => b.toegevoegd_op.localeCompare(a.toegevoegd_op))
  const nieuwste = eigen[0] ?? null
  const naam = [p.voornaam, p.achternaam].filter(Boolean).join(' ') || 'Naamloos'
  const basis = { persoonId: p.id, naam, documentId: nieuwste?.id ?? null, fout: null }

  if (!nieuwste) {
    return { ...basis, stand: loonbureauMaaktContract(p) ? 'uploaden' : 'ontbreekt' }
  }
  // Alleen als het loonbureau het contract maakte, hoort het getekend terug.
  // Een contract dat je zelf opstelde blijft in het dossier.
  if (p.contract_door_loonbureau && !eigen.some((d) => d.naar_loonbureau_op)) {
    return { ...basis, stand: 'versturen', fout: nieuwste.naar_loonbureau_fout }
  }
  return { ...basis, stand: 'in_orde' }
}

function telt(p: Medewerker) {
  return p.fase === 'medewerker' && !p.uit_dienst_op && !p.is_eigenaar
}

const VOLGORDE: Record<Stand, number> = { versturen: 0, uploaden: 1, ontbreekt: 2, in_orde: 3 }

export function contractStanden(personen: Medewerker[], documenten: GetekendDocument[]) {
  return personen
    .filter(telt)
    .map((p) => standVan(p, documenten))
    .sort((a, b) => VOLGORDE[a.stand] - VOLGORDE[b.stand] || a.naam.localeCompare(b.naam, 'nl'))
}

/* ------------------------------------------------------------------ query --- */

export function useContractStanden() {
  return useQuery({
    queryKey: ['contract-standen'],
    queryFn: async (): Promise<ContractStand[]> => {
      const [mensen, docs] = await Promise.all([
        supabase
          .from('sollicitaties')
          .select('id,voornaam,achternaam,fase,uit_dienst_op,is_eigenaar,loonbureau_verstuurd_op,contract_door_loonbureau')
          .eq('fase', 'medewerker')
          .eq('is_apparaat', false)
          // Een oefenkaart is geen personeel; zie is_test op sollicitaties.
          .eq('is_test', false)
          .is('uit_dienst_op', null),
        supabase
          .from('dossier_documenten')
          .select('id,medewerker_id,toegevoegd_op,naar_loonbureau_op,naar_loonbureau_fout')
          .eq('soort', 'contract_getekend')
          .is('vervallen_op', null),
      ])
      if (mensen.error) throw new Error(mensen.error.message)
      if (docs.error) throw new Error(docs.error.message)
      return contractStanden(
        (mensen.data ?? []) as unknown as Medewerker[],
        (docs.data ?? []) as unknown as GetekendDocument[],
      )
    },
  })
}

export type Verstuurd = {
  testmodus: boolean
  /** Ging over de oefenkaart; het loonbureau heeft niets gekregen. */
  oefening?: boolean
  verstuurd_naar: string
  al_verstuurd?: boolean
}

/** Eén getekend contract naar het loonbureau. */
export function useGetekendVersturen() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (documentId: number): Promise<Verstuurd> => {
      const { data, error } = await supabase.functions.invoke('stuur-getekend-contract', {
        body: { document_id: documentId },
      })
      const r = data as ({ ok: boolean; error?: string } & Verstuurd) | null
      if (r && !r.ok) throw new Error(r.error ?? 'Versturen lukte niet.')
      if (error) throw new Error(error.message)
      return r as Verstuurd
    },
    onSettled: () => {
      client.invalidateQueries({ queryKey: ['contract-standen'] })
      client.invalidateQueries({ queryKey: ['dossier-documenten'] })
    },
  })
}

export function uitkomstTekst(r: Verstuurd) {
  if (r.al_verstuurd) return 'Dit contract was al naar het loonbureau gestuurd.'
  if (r.oefening)
    return `Oefenkaart: naar ${r.verstuurd_naar} gestuurd, niet naar het loonbureau.`
  if (r.testmodus)
    return `Testmodus: naar ${r.verstuurd_naar} gestuurd, niet naar het loonbureau. Het blijft openstaan.`
  return `Getekend contract naar het loonbureau gestuurd (${r.verstuurd_naar}).`
}
