/* Wat er uit een beantwoord voorstel volgt, en wat het loonbureau daarmee moet.
 *
 * Dit is de schakel tussen "wat is afgesproken" en "wie moet wat doen". Een ja
 * op een verlenging betekent: contract opstellen. Een nee betekent: geen
 * contract, maar wél een einde dienstverband, en dat moet het loonbureau net zo
 * goed weten — anders loopt de loonstrook door.
 *
 * Twee antwoorden kunnen in één voorstel zitten, en dan telt de verlenging
 * zwaarder: wie niet verlengt heeft geen vaste uren nodig. Daarom wordt eerst
 * naar de verlenging gekeken en pas daarna naar de uren.
 *
 * Het blad dat hieruit komt is geen contract. Het loonbureau maakt het
 * contract; dit vertelt ze waarop. Daarom staat er ook in wanneer de
 * medewerker akkoord gaf en op welke tekst: zij stellen op wat er is
 * aangeboden, niet wat er uit het hoofd is doorgegeven.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import { urenTekst, uur, type Contract } from './contracten'
import { naamVan, type Persoon } from './personeel'
import { type Voorstel } from './contractvoorstellen'

export type Uitkomst = {
  /** Waar dit blad over gaat, in een paar woorden. */
  titel: string
  /** Moet het loonbureau een contract opstellen? */
  contractNodig: boolean
  /** Wat er is afgesproken, in zinnen die het loonbureau kan overnemen. */
  regels: string[]
}

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

const euro = (n: number): string => `€ ${n.toFixed(2).replace('.', ',')}`

/** Wat er van het voorstel is afgesproken, en wat het loonbureau moet doen. */
export function uitkomstVan(v: Voorstel, vorig: Contract | null): Uitkomst | null {
  const eindeHuidig = vorig?.eindigt ?? null

  /* Niet verlengen, of een verlenging die is afgewezen: het dienstverband
     loopt af op de einddatum van het contract dat er nu is. */
  if (v.aard === 'stoppen' || v.keuze_verlenging === 'niet_akkoord') {
    return {
      titel: 'Einde dienstverband',
      contractNodig: false,
      regels: [
        v.aard === 'stoppen'
          ? 'Het contract wordt niet verlengd.'
          : 'Een verlenging is aangeboden en niet geaccepteerd.',
        eindeHuidig
          ? `Laatste dag van het dienstverband: ${datum(eindeHuidig)}.`
          : 'De laatste dag van het dienstverband staat niet in de app; graag navragen.',
      ],
    }
  }

  const verlengt = v.keuze_verlenging === 'akkoord'
  const urenAan = v.keuze_vaste_uren === 'aangenomen'
  const urenAf = v.keuze_vaste_uren === 'geweigerd'

  // Vaste uren geweigerd en geen verlenging erbij: niets te maken, wel te weten.
  if (urenAf && !verlengt) {
    return {
      titel: 'Blijft oproepkracht',
      contractNodig: false,
      regels: [
        'Het aanbod voor vaste uren is geweigerd. De medewerker blijft oproepkracht.',
        'Over twaalf maanden volgt er een nieuw aanbod.',
      ],
    }
  }

  if (!verlengt && !urenAan) return null

  const regels: string[] = []
  if (verlengt) {
    regels.push(
      v.duur === 'onbepaalde'
        ? `Contract voor onbepaalde tijd, ingaand ${datum(v.begint)}.`
        : `Contract voor bepaalde tijd, van ${datum(v.begint)} tot en met ${datum(v.eindigt)}.`,
    )
  } else {
    regels.push(`Wijziging van de uren, ingaand ${datum(v.begint)}.`)
  }

  if (urenAan) {
    const n = getal(v.uren_vast)
    regels.push(n === null ? 'Vaste uren per week.' : `${uur(n)} vaste uren per week.`)
  } else if (urenAf) {
    regels.push('Het aanbod voor vaste uren is geweigerd; geen vaste uren.')
  } else if (v.soort === 'nuluren') {
    regels.push('Geen vaste uren; oproepkracht.')
  } else if (v.soort) {
    // urenTekst levert een fragment ('4 tot 12 uur per week'); hier hoort een zin.
    const t = urenTekst({
      soort: v.soort,
      uren_vast: v.uren_vast,
      uren_min: v.uren_min,
      uren_max: v.uren_max,
    } as Contract)
    regels.push(`${t.charAt(0).toUpperCase()}${t.slice(1)}.`)
  }

  const loon = getal(v.uurloon)
  if (loon !== null) regels.push(`Uurloon ${euro(loon)} bruto.`)
  if (v.functie) regels.push(`Functie: ${v.functie}.`)

  return {
    titel: verlengt && urenAan ? 'Verlenging met vaste uren' : verlengt ? 'Verlenging' : 'Vaste uren',
    contractNodig: true,
    regels,
  }
}

/* Mag dit voorstel naar het loonbureau?
 *
 * Alles waar een antwoord op moet komen, moet binnen zijn. Bij een voorstel om
 * te stoppen is er niets te kiezen; daar is de ontvangstbevestiging het
 * antwoord. En het gaat één keer: naar_loonbureau_op is ook de rem. */
export function klaarVoorLoonbureau(v: Voorstel): boolean {
  if (!v.verstuurd_op || v.ingetrokken_op || v.naar_loonbureau_op) return false
  if (v.aard === 'stoppen') return Boolean(v.ontvangst_bevestigd_op)
  const wachtVerlenging =
    (v.aard === 'verlengen' || v.aard === 'verlengen_en_vaste_uren') && !v.keuze_verlenging
  /* Een afgewezen verlenging maakt de vraag over de uren overbodig: er komt
     geen contract waar die uren in horen. Dan hoeft daar niet op gewacht te
     worden. */
  const vervallen = v.keuze_verlenging === 'niet_akkoord'
  const wachtUren =
    (v.aard === 'vaste_uren' || v.aard === 'verlengen_en_vaste_uren') &&
    !v.keuze_vaste_uren &&
    !vervallen
  return !wachtVerlenging && !wachtUren
}

/* --------------------------------------------------------------- het blad --- */

function veilig(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function rij(label: string, waarde: string) {
  return `<tr><td class="label">${label}</td><td class="waarde">${waarde}</td></tr>`
}

/* Het verzoek aan het loonbureau. Zelfde indeling als het mutatieformulier,
   zodat het bekend aanvoelt, maar zonder BSN, adres en identiteitsbewijs: die
   hebben ze al.
 *
 * Er stond tot 25 oktober 2026 meer op: wanneer het voorstel was verstuurd en
 * gelezen, wat de medewerker antwoordde, waarop het gemiddelde rustte, en de
 * hele brief die hij kreeg. Als onderbouwing bedoeld, maar het loonbureau
 * stelt een contract op en doet daar niets mee — het is een halve bladzijde
 * ruis in hun inbox. Dat spoor staat in de app en in het dossier, waar het
 * thuishoort. Hier staat alleen wat zij nodig hebben om te typen. */
export function bouwContractverzoek(opdracht: {
  persoon: Persoon
  voorstel: Voorstel
  vorig: Contract | null
  uitkomst: Uitkomst
}): string {
  const { persoon, vorig, uitkomst } = opdracht
  const naam = naamVan(persoon)

  const afspraak = uitkomst.regels.map((r) => `<p class="regel">${veilig(r)}</p>`).join('')

  const wie = [
    rij('Medewerker', veilig(naam)),
    rij('Geboortedatum', datum(persoon.geboortedatum)),
    rij('In dienst sinds', datum(persoon.in_dienst_sinds)),
    vorig
      ? rij(
          'Huidig contract',
          `${veilig(datum(vorig.begint))} tot en met ${veilig(datum(vorig.eindigt))}`,
        )
      : '',
  ].join('')

  return `<!doctype html>
<html lang="nl"><head><meta charset="utf-8"><title>Wijziging dienstverband ${veilig(naam)}</title>
<style>
  @page { size: A4; margin: 20mm 18mm; }
  * { box-sizing: border-box; }
  body { font-family: Helvetica, Arial, sans-serif; color: #1c1c1e; font-size: 10.5pt; margin: 0; }
  .kop { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; }
  .bedrijf { color: #003a41; font-size: 15pt; font-weight: 700; line-height: 1.2; }
  .bedrijf-sub { color: #6b7280; font-size: 7.5pt; margin-top: 4px; }
  .doc { text-align: right; }
  .doc-label { color: #9ca3af; font-size: 7pt; letter-spacing: 0.16em; text-transform: uppercase; }
  .doc-titel { font-size: 15pt; font-weight: 700; line-height: 1.2; }
  .doc-datum { color: #6b7280; font-size: 7.5pt; margin-top: 2px; }
  .streep { height: 3px; background: #003a41; margin: 12px 0 18px; }
  .badge { display: inline-block; background: #e6f0f1; color: #003a41; border-radius: 4px;
           padding: 5px 12px; font-size: 9pt; font-weight: 600; }
  .vraag { margin: 18px 0 0; font-size: 11pt; font-weight: 700; }
  .sectie { background: #f1efe6; color: #5c5342; font-size: 7.5pt; font-weight: 700;
            letter-spacing: 0.14em; text-transform: uppercase; padding: 6px 10px; margin: 22px 0 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 7px 10px; border-bottom: 1px solid #e8e6e0; vertical-align: top; }
  td.label { color: #6b7280; width: 40%; }
  td.waarde { font-weight: 600; }
  .regel { margin: 0 0 6px; padding: 0 10px; }
  .blok { border-left: 3px solid #e8e6e0; margin: 10px 0 0; padding: 4px 0; }
  .voet { margin-top: 40px; border-top: 1px solid #e8e6e0; padding-top: 8px;
          display: flex; justify-content: space-between; gap: 20px; color: #9ca3af; font-size: 7pt; }
</style></head>
<body>
  <div class="kop">
    <div>
      <div class="bedrijf">Boskma Foodservice V.O.F.</div>
      <div class="bedrijf-sub">Snackerie 't Zonnetje &nbsp;·&nbsp; Dorpsstraat 82, 1693 AH Wervershoof &nbsp;·&nbsp; KvK 42020563</div>
    </div>
    <div class="doc">
      <div class="doc-label">Document</div>
      <div class="doc-titel">Wijziging dienstverband</div>
      <div class="doc-datum">Opgemaakt op ${datum(new Date().toISOString())}</div>
    </div>
  </div>

  <div class="streep"></div>

  <div class="badge">${veilig(uitkomst.titel)}</div>

  <p class="vraag">${
    uitkomst.contractNodig
      ? 'Verzoek: graag het contract opstellen op onderstaande voorwaarden.'
      : 'Melding: er hoeft geen contract te worden opgesteld.'
  }</p>

  <div class="sectie">Wat is afgesproken</div>
  <div class="blok">${afspraak}</div>

  <div class="sectie">Medewerker</div>
  <table>${wie}</table>

  <div class="voet">
    <span>Boskma Foodservice V.O.F. &nbsp;·&nbsp; Dorpsstraat 82, 1693 AH Wervershoof</span>
    <span>Vertrouwelijk — uitsluitend bestemd voor loonbureau</span>
  </div>
</body></html>`
}

/* ------------------------------------------------------------- versturen --- */

/* Het verzoek gaat over dezelfde weg als het mutatieformulier: de
 * serverfunctie stuur-loonbureau maakt er een PDF van en mailt hem naar het
 * adres uit de instellingen. Eén mailweg naar het loonbureau betekent één plek
 * waar het adres, de testmodus en de cc staan.
 *
 * naar_loonbureau_op wordt pas gezet als de mail eruit is. Omgekeerd zou er
 * "verstuurd" staan bij een verzoek dat niemand heeft gekregen, en dan wacht
 * je op een contract dat nooit komt. */
export function useNaarLoonbureau(medewerkerId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (opdracht: {
      persoon: Persoon
      voorstel: Voorstel
      vorig: Contract | null
    }) => {
      const uitkomst = uitkomstVan(opdracht.voorstel, opdracht.vorig)
      if (!uitkomst) throw new Error('Er is nog niets afgesproken om door te geven.')

      const { data, error } = await supabase.functions.invoke('stuur-loonbureau', {
        body: {
          emp_naam: naamVan(opdracht.persoon),
          // Zodat de server post over een oefenkaart binnenhoudt.
          medewerker_id: opdracht.persoon.id,
          mutatie_html: bouwContractverzoek({ ...opdracht, uitkomst }),
          onderwerp: `Wijziging dienstverband — ${uitkomst.titel}`,
          bestandsnaam: 'wijziging_dienstverband',
          bericht: uitkomst.contractNodig
            ? `Hierbij het verzoek om een contract op te stellen voor ${naamVan(opdracht.persoon)}. De afgesproken voorwaarden en de onderbouwing staan in de bijlage.`
            : `Hierbij een melding over het dienstverband van ${naamVan(opdracht.persoon)}. Er hoeft geen contract te worden opgesteld; de toelichting staat in de bijlage.`,
          lb_contract: uitkomst.contractNodig,
        },
      })
      if (error) throw new Error(error.message)
      if (data && data.ok === false) throw new Error(data.error ?? 'Versturen lukte niet.')

      const { error: fout } = await supabase
        .from('contractvoorstellen')
        .update({
          naar_loonbureau_op: new Date().toISOString(),
          bijgewerkt_op: new Date().toISOString(),
        })
        .eq('id', opdracht.voorstel.id)
      if (fout) throw new Error(`De mail is verstuurd, maar het vastleggen mislukte: ${fout.message}`)

      return data as { testmodus?: boolean; oefening?: boolean; verstuurd_naar?: string }
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['contractvoorstellen', medewerkerId] })
      client.invalidateQueries({ queryKey: ['contractwaker'] })
    },
  })
}
