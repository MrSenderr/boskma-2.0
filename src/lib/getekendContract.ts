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
  /* Verwacht het loonbureau dit terug? Alleen als zij het contract hebben
     opgesteld. Een getekend contract dat nog niet verstuurd is hoort hoe dan
     ook zichtbaar te zijn — maar het is pas verzuim als zij erop wachten. */
  verwacht: boolean
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
  const verwacht = Boolean(p.contract_door_loonbureau)
  const basis = { persoonId: p.id, naam, documentId: nieuwste?.id ?? null, fout: null, verwacht }

  if (!nieuwste) {
    return { ...basis, stand: loonbureauMaaktContract(p) ? 'uploaden' : 'ontbreekt' }
  }

  /* Ligt er een getekend contract dat nog niet is verstuurd, dan hoort dat te
     blijken — ook als jij het contract zelf opstelde. Tot 25 oktober 2026 werd
     dat stil als 'in orde' geteld, en dan zie je nergens meer dat het er nog
     ligt. Hoe zwaar het weegt zegt `verwacht`. */
  if (!eigen.some((d) => d.naar_loonbureau_op)) {
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

/* Een getekend contract aftekenen dat je zelf hebt verstuurd.
 *
 * Komt voor: je mailt het stuk vanuit je eigen postvak, of geeft het mee, en
 * daarna blijft de app zeggen dat het nog moet. Zonder deze knop blijft dat
 * seintje staan tot je het alsnog door de app laat versturen — en dan krijgt
 * het loonbureau hetzelfde contract twee keer.
 *
 * Twee dingen worden met opzet vastgelegd. De dátum die jij opgeeft, niet het
 * moment van aftekenen: anders staat er in de gegevens dat het vandaag ging
 * terwijl het vorige week was. En een notitie dat de app het niet heeft
 * verstuurd — wat de app niet gedaan heeft hoort er niet uit te zien alsof hij
 * het wel deed. */
/* Wat er mis kan zijn met de opgegeven datum. Geeft null als hij deugt.
 *
 * Apart, omdat dit het stuk is dat stilletjes onzin kan doorlaten: een lege
 * datum wordt anders 'Invalid Date' en belandt als null in de tabel, en een
 * datum in de toekomst zou betekenen dat je iets hebt verstuurd dat nog moet
 * gebeuren. */
export function controleerVerstuurdatum(
  op: string,
  vandaag = new Date().toLocaleDateString('sv-SE'),
): string | null {
  const dag = (op ?? '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dag)) return 'Vul een datum in.'
  if (dag > vandaag) return 'Die datum ligt in de toekomst.'
  return null
}

export function useGetekendAfgetekend() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (opdracht: { documentId: number; op: string; adres: string }) => {
      const dag = opdracht.op.slice(0, 10)
      const bezwaar = controleerVerstuurdatum(dag)
      if (bezwaar) throw new Error(bezwaar)

      const { data: bestaand, error: leesfout } = await supabase
        .from('dossier_documenten')
        .select('notitie,naar_loonbureau_op')
        .eq('id', opdracht.documentId)
        .single()
      if (leesfout) throw new Error(leesfout.message)
      if ((bestaand as { naar_loonbureau_op: string | null }).naar_loonbureau_op) {
        throw new Error('Dit contract staat al als verstuurd genoteerd.')
      }

      const oud = (bestaand as { notitie: string | null }).notitie?.trim()
      const notitie = [oud, 'Buiten de app om naar het loonbureau gestuurd; hier afgetekend.']
        .filter(Boolean)
        .join('\n')

      const { error } = await supabase
        .from('dossier_documenten')
        .update({
          // Middag, zodat de dag klopt in elke tijdzone.
          naar_loonbureau_op: `${dag}T12:00:00`,
          naar_loonbureau_adres: opdracht.adres,
          naar_loonbureau_fout: null,
          notitie,
        })
        .eq('id', opdracht.documentId)
      if (error) throw new Error(error.message)
    },
    onSettled: () => {
      client.invalidateQueries({ queryKey: ['contract-standen'] })
      client.invalidateQueries({ queryKey: ['dossier-documenten'] })
    },
  })
}
