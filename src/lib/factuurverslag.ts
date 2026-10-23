/* Het verslag bij een inkoopfactuur.
 *
 * Veldboer levert wekelijks vijfenveertig tot honderd regels. Wat daarin
 * opvalt zie je met het blote oog niet: een prijs die omhoog ging, iets nieuws,
 * iets dat er juist niet op staat.
 *
 * De cijfers komen rechtstreeks uit de facturen en worden hier alleen gesorteerd
 * en benoemd — er wordt niets geschat en niets geschreven dat niet uit de
 * gegevens volgt. Bij inkoopprijzen is een verkeerd getal erger dan geen getal.
 *
 * Het onderscheid dat dit verslag zijn waarde geeft: een artikel dat vorige
 * week op actie stond en nu niet meer is geen prijsstijging. Bij de factuur van
 * 23 oktober 2026 waren drie van de zes "stijgingen" precies dat.
 */

import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'

const inkoop = supabase.schema('inkoop')

export type Artikel = {
  artikelnr: string
  artikelnaam: string | null
  aantal: number
  prijs: number
  bedrag: number | null
  actie: boolean
  vorige_prijs: number | null
  vorige_datum: string | null
  vorige_actie: boolean | null
  is_nieuw: boolean
}

export type EerdereRegel = {
  document_id: number
  factuurdatum: string
  artikelnr: string
  artikelnaam: string | null
}

export type Soort = 'duurder' | 'goedkoper' | 'actie_afgelopen' | 'nu_op_actie' | 'nieuw' | 'gemist'

export type Bevinding = {
  soort: Soort
  artikelnr: string
  naam: string
  prijs: number | null
  vorigePrijs: number | null
  /** Verschil in procenten, afgerond op één cijfer. */
  procent: number | null
  /** Wat het verschil deze factuur kost of oplevert: verschil maal aantal. */
  effect: number | null
  /** Bij 'gemist': op hoeveel van de vorige facturen het artikel wél stond. */
  keerEerder?: number
  /** Bij 'gemist': hoeveel facturen er in het venster zaten. */
  vanFacturen?: number
  laatstOp?: string | null
}

export type Verslag = {
  bevindingen: Bevinding[]
  /** Aantal artikelen op deze factuur. */
  artikelen: number
}

/* Hoe ver terug we kijken voor "dit bestel je normaal elke week".
   Acht weken: lang genoeg om een ritme te zien, kort genoeg om niet te klagen
   over iets dat je in de zomer één keer hebt gehaald. */
export const GEMIST_VENSTER_DAGEN = 56
/* Op zo'n groot deel van de vorige facturen moet het hebben gestaan.
   Niet een vast aantal: met drie van de negen facturen bestel je iets niet
   wekelijks maar af en toe, en dan is het geen vergeten bestelling. Bij de
   factuur van 23 oktober 2026 leverde een vast aantal van drie negenentwintig
   meldingen op — ruis waar je na twee weken overheen leest. Met vier vijfde
   blijft er één over, en dat is er ook echt een: gerookte ontbijtspek stond op
   alle negen vorige facturen. */
export const GEMIST_DEEL = 0.8
/** Onder dit aantal eerdere facturen valt er geen ritme uit te lezen. */
export const GEMIST_MINIMAAL_FACTUREN = 4

/* De volgorde waarin het op het scherm komt: eerst wat geld kost, dan wat geld
   oplevert, dan wat je moet weten. */
const VOLGORDE: Soort[] = ['duurder', 'gemist', 'actie_afgelopen', 'nu_op_actie', 'goedkoper', 'nieuw']

export const SOORTNAAM: Record<Soort, string> = {
  duurder: 'Duurder geworden',
  goedkoper: 'Goedkoper geworden',
  actie_afgelopen: 'Actie afgelopen',
  nu_op_actie: 'Nu op actie',
  nieuw: 'Nieuw op de factuur',
  gemist: 'Staat er niet op',
}

export const SOORTUITLEG: Record<Soort, string> = {
  duurder: 'De prijs ging omhoog zonder dat er een actie afliep.',
  goedkoper: 'De prijs ging omlaag.',
  actie_afgelopen:
    'Stond vorige keer op actie en nu niet meer. Dat leest als een prijsstijging, maar je betaalt gewoon weer de normale prijs.',
  nu_op_actie: 'Staat deze keer op actie. Het moment om door te bestellen.',
  nieuw: 'Dit artikel stond niet eerder op een factuur van deze leverancier.',
  gemist: 'Dit bestel je normaal bijna elke week, en deze keer niet.',
}

const rond = (n: number, cijfers = 2) => Math.round(n * 10 ** cijfers) / 10 ** cijfers

/** Wat er aan deze factuur opvalt. */
export function maakVerslag(opdracht: {
  artikelen: Artikel[]
  /** Artikelen van eerdere facturen van dezelfde leverancier, binnen het venster. */
  eerder: EerdereRegel[]
}): Verslag {
  const { artikelen, eerder } = opdracht
  const bevindingen: Bevinding[] = []

  for (const a of artikelen) {
    const naam = a.artikelnaam ?? a.artikelnr

    if (a.is_nieuw) {
      bevindingen.push({
        soort: 'nieuw',
        artikelnr: a.artikelnr,
        naam,
        prijs: a.prijs,
        vorigePrijs: null,
        procent: null,
        effect: null,
      })
      continue
    }

    if (a.vorige_prijs === null || a.prijs === a.vorige_prijs) continue

    const omhoog = a.prijs > a.vorige_prijs
    /* Een actie die afliep is geen prijsstijging, en een nieuwe actie geen
       prijsdaling. Dat apart benoemen scheelt je elke week een schrikmoment
       en een telefoontje naar de vertegenwoordiger. */
    const soort: Soort =
      omhoog && a.vorige_actie && !a.actie
        ? 'actie_afgelopen'
        : !omhoog && a.actie && !a.vorige_actie
          ? 'nu_op_actie'
          : omhoog
            ? 'duurder'
            : 'goedkoper'

    bevindingen.push({
      soort,
      artikelnr: a.artikelnr,
      naam,
      prijs: a.prijs,
      vorigePrijs: a.vorige_prijs,
      procent: rond(((a.prijs - a.vorige_prijs) / a.vorige_prijs) * 100, 1),
      effect: rond((a.prijs - a.vorige_prijs) * a.aantal),
    })
  }

  /* Wat je normaal bestelt en nu niet. Per artikel tellen we op hoeveel van de
     vorige facturen het stond; staat het er op genoeg, dan is het ritme en geen
     toeval. */
  const opDezeFactuur = new Set(artikelen.map((a) => a.artikelnr))
  const facturenInVenster = new Set(eerder.map((r) => r.document_id)).size
  const drempel = Math.ceil(facturenInVenster * GEMIST_DEEL)
  const perArtikel = new Map<string, { naam: string; facturen: Set<number>; laatst: string }>()
  for (const r of eerder) {
    if (opDezeFactuur.has(r.artikelnr)) continue
    const al = perArtikel.get(r.artikelnr) ?? {
      naam: r.artikelnaam ?? r.artikelnr,
      facturen: new Set<number>(),
      laatst: r.factuurdatum,
    }
    al.facturen.add(r.document_id)
    if (r.factuurdatum > al.laatst) al.laatst = r.factuurdatum
    perArtikel.set(r.artikelnr, al)
  }
  for (const [artikelnr, g] of facturenInVenster >= GEMIST_MINIMAAL_FACTUREN ? perArtikel : []) {
    if (g.facturen.size < drempel) continue
    bevindingen.push({
      soort: 'gemist',
      artikelnr,
      naam: g.naam,
      prijs: null,
      vorigePrijs: null,
      procent: null,
      effect: null,
      keerEerder: g.facturen.size,
      vanFacturen: facturenInVenster,
      laatstOp: g.laatst,
    })
  }

  bevindingen.sort(
    (a, b) =>
      VOLGORDE.indexOf(a.soort) - VOLGORDE.indexOf(b.soort) ||
      Math.abs(b.effect ?? 0) - Math.abs(a.effect ?? 0) ||
      (b.keerEerder ?? 0) - (a.keerEerder ?? 0) ||
      a.naam.localeCompare(b.naam),
  )

  return { bevindingen, artikelen: artikelen.length }
}

/** De bevindingen gegroepeerd, in de volgorde waarin ze op het scherm horen. */
export function perSoort(verslag: Verslag): { soort: Soort; bevindingen: Bevinding[] }[] {
  return VOLGORDE.map((soort) => ({
    soort,
    bevindingen: verslag.bevindingen.filter((b) => b.soort === soort),
  })).filter((g) => g.bevindingen.length > 0)
}

/** Wat deze factuur duurder uitvalt door prijsstijgingen alleen. */
export function prijseffect(verslag: Verslag): number {
  return rond(
    verslag.bevindingen
      .filter((b) => b.soort === 'duurder' || b.soort === 'goedkoper')
      .reduce((som, b) => som + (b.effect ?? 0), 0),
  )
}

/* ---------------------------------------------------------- ophalen --- */

const getal = (w: unknown): number => Number(w ?? 0)

export function useFactuurverslag(documentId: number | null | undefined, leverancierId?: number, datum?: string | null) {
  return useQuery({
    queryKey: ['factuurverslag', documentId],
    enabled: Boolean(documentId && leverancierId && datum),
    queryFn: async (): Promise<Verslag> => {
      const { data: rijen, error } = await inkoop
        .from('factuur_artikel')
        .select('artikelnr,artikelnaam,aantal,prijs,bedrag,actie,vorige_prijs,vorige_datum,vorige_actie,is_nieuw')
        .eq('document_id', documentId as number)
      if (error) throw new Error(error.message)

      // Acht weken terug, zodat "dit bestel je normaal wekelijks" ergens op slaat.
      const grens = new Date(`${datum}T12:00:00`)
      grens.setDate(grens.getDate() - GEMIST_VENSTER_DAGEN)

      const { data: eerder, error: fout } = await inkoop
        .from('factuur_artikelen_kort')
        .select('document_id,factuurdatum,artikelnr,artikelnaam')
        .eq('leverancier_id', leverancierId as number)
        .lt('factuurdatum', datum as string)
        .gte('factuurdatum', grens.toLocaleDateString('sv-SE'))
      if (fout) throw new Error(fout.message)

      return maakVerslag({
        artikelen: (rijen ?? []).map((r) => ({
          artikelnr: String(r.artikelnr),
          artikelnaam: r.artikelnaam as string | null,
          aantal: getal(r.aantal),
          prijs: getal(r.prijs),
          bedrag: r.bedrag === null ? null : getal(r.bedrag),
          actie: Boolean(r.actie),
          vorige_prijs: r.vorige_prijs === null ? null : getal(r.vorige_prijs),
          vorige_datum: r.vorige_datum as string | null,
          vorige_actie: r.vorige_actie as boolean | null,
          is_nieuw: Boolean(r.is_nieuw),
        })),
        eerder: (eerder ?? []).map((r) => ({
          document_id: Number(r.document_id),
          factuurdatum: String(r.factuurdatum),
          artikelnr: String(r.artikelnr),
          artikelnaam: r.artikelnaam as string | null,
        })),
      })
    },
  })
}
