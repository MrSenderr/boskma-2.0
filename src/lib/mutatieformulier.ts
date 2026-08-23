import type { Persoon } from './personeel'

/* Het mutatieformulier zoals het loonbureau het gewend is. De indeling volgt
   het bestaande voorbeeld: kop, contractgegevens, medewerkergegevens, voet.
   Wordt als HTML naar de server gestuurd en daar omgezet naar PDF. */

function veilig(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function datum(d: string | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
}

function bedrag(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  return `€ ${n.toFixed(2).replace('.', ',')}`
}

function jaNee(b: boolean | null | undefined): string {
  if (b === null || b === undefined) return '—'
  return b ? 'Ja' : 'Nee'
}

/** Het invulformulier slaat M of V op; het loonbureau ziet het liever voluit. */
function geslacht(v: unknown): string {
  const w = String(v ?? '').trim().toLowerCase()
  if (w === 'm' || w === 'man') return 'Man'
  if (w === 'v' || w === 'vrouw') return 'Vrouw'
  return veilig(v)
}

function rij(label: string, waarde: string) {
  return `<tr><td class="label">${label}</td><td class="waarde">${waarde}</td></tr>`
}

export function bouwMutatieformulier(p: Persoon, soort = 'Nieuw dienstverband'): string {
  const o = (p.onboarding_data ?? {}) as Record<string, unknown>
  const naam = [p.voornaam, p.achternaam].filter(Boolean).join(' ')

  const adres = [
    [o.straat, o.huisnummer].filter(Boolean).join(' '),
    [o.postcode, o.woonplaats].filter(Boolean).join(' '),
  ]
    .filter(Boolean)
    .join(', ')

  const geboorte = o.geboorteplaats
    ? `${datum(p.geboortedatum)} (${veilig(o.geboorteplaats)})`
    : datum(p.geboortedatum)

  const contract = [
    rij('Medewerker', veilig(naam)),
    rij('Contracttype', veilig(p.contracttype)),
    rij('Functie', veilig(p.functie)),
    rij('Ingangsdatum', datum(p.ingangsdatum)),
    // Einddatum staat er alleen bij een contract voor bepaalde tijd
    p.contractduur === 'bepaalde' ? rij('Einddatum', datum(p.einddatum)) : '',
    rij('Uurloon (bruto)', bedrag(p.uurloon)),
    rij('Proefperiode', jaNee(p.proefperiode)),
    rij('Contract opstellen door loonbureau', jaNee(p.contract_door_loonbureau)),
  ].join('')

  const medewerker = [
    rij('Geboortedatum', geboorte),
    rij('Geslacht', geslacht(o.geslacht)),
    rij('BSN', veilig(o.bsn)),
    rij('Adres', veilig(adres)),
    rij('IBAN', veilig(o.iban)),
    rij('Loonheffingskorting', typeof o.loonheffingskorting === 'boolean' ? jaNee(o.loonheffingskorting) : veilig(o.loonheffingskorting)),
    rij('In dienst sinds', datum(p.ingangsdatum ?? p.aangenomen_op)),
    rij('E-mail', veilig(p.email)),
    rij('Telefoon', veilig(p.telefoonnummer)),
  ].join('')

  return `<!doctype html>
<html lang="nl"><head><meta charset="utf-8"><title>Mutatieformulier ${veilig(naam)}</title>
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
  .sectie { background: #f1efe6; color: #5c5342; font-size: 7.5pt; font-weight: 700;
            letter-spacing: 0.14em; text-transform: uppercase; padding: 6px 10px; margin: 22px 0 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 7px 10px; border-bottom: 1px solid #e8e6e0; vertical-align: top; }
  td.label { color: #6b7280; width: 40%; }
  td.waarde { font-weight: 600; }
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
      <div class="doc-titel">Mutatieformulier</div>
      <div class="doc-datum">Opgemaakt op ${datum(new Date().toISOString())}</div>
    </div>
  </div>

  <div class="streep"></div>

  <div class="badge">${veilig(soort)}</div>

  <div class="sectie">Contractgegevens</div>
  <table>${contract}</table>

  <div class="sectie">Medewerkergegevens</div>
  <table>${medewerker}</table>

  <div class="voet">
    <span>Boskma Foodservice V.O.F. &nbsp;·&nbsp; Dorpsstraat 82, 1693 AH Wervershoof</span>
    <span>Vertrouwelijk — uitsluitend bestemd voor loonbureau</span>
  </div>
</body></html>`
}

/** De bijlagen die met het mutatieformulier meegaan: de loonheffingsverklaring
 *  en de twee kanten van het identiteitsbewijs, voor zover aangeleverd. */
export type Bijlage = { filename: string; url?: string; pad?: string }

export function bijlagenVan(p: Persoon): Bijlage[] {
  const o = (p.onboarding_data ?? {}) as Record<string, unknown>
  const naam = [p.voornaam, p.achternaam].filter(Boolean).join('_').toLowerCase().replace(/[^a-z0-9_]/g, '')
  const lijst: Bijlage[] = []

  // Het invulformulier bewaart een pad in de opslag ("id-kopie/onboarding-….jpg");
  // oudere gegevens soms een volledig webadres. De server kan allebei ophalen.
  const voegToe = (sleutel: string, bestandsnaam: string) => {
    const waarde = o[sleutel]
    if (typeof waarde !== 'string' || !waarde) return
    lijst.push(
      waarde.startsWith('http')
        ? { filename: bestandsnaam, url: waarde }
        : { filename: bestandsnaam, pad: waarde },
    )
  }

  voegToe('loonheffing_pdf', `loonheffingsverklaring_${naam}.pdf`)
  voegToe('id_kopie_url', `id_voorzijde_${naam}.jpg`)
  voegToe('id_kopie_achterzijde', `id_achterzijde_${naam}.jpg`)

  return lijst
}
