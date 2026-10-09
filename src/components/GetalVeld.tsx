import { useEffect, useRef, useState } from 'react'

/* Een veld waar je een bedrag of een aantal in typt.

   Geen <input type="number"> met een omzetting bij elke toetsaanslag: zodra je
   "6," hebt getypt is dat even geen geldig getal, en dan sprong het veld terug
   naar nul. Centen invoeren werd daarmee onmogelijk.

   Hier houdt het veld vast wat je hebt getypt. Pas als er een getal van te
   maken is gaat dat naar boven. Een komma mag, want zo schrijven wij het. */

export function leesGetal(tekst: string): number | null {
  const schoon = tekst.replace(',', '.').replace(/[^\d.]/g, '')
  if (schoon === '' || schoon === '.') return null
  const n = Number(schoon)
  return Number.isFinite(n) ? n : null
}

/** 6.02 wordt "6,02" en 75 blijft "75" — geen 75,00 in een invoerveld.
 *
 *  Nul laten we leeg. Een prijs van nul euro of een aantal van nul is geen
 *  antwoord maar een nog niet ingevuld veld, en dan hoor je de hint te zien in
 *  plaats van een nul die je eerst moet weghalen. */
export function schrijfGetal(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n) || n === 0) return ''
  return String(n).replace('.', ',')
}

const invoer =
  'w-full rounded-[4px] border-[1.5px] border-line-strong bg-bg px-3 py-2.5 text-base tabular-nums outline-none focus:border-accent'

export function GetalVeld({
  label,
  waarde,
  onWijzig,
  placeholder,
}: {
  label: string
  waarde: number | null | undefined
  onWijzig: (n: number | null) => void
  placeholder?: string
}) {
  const [tekst, setTekst] = useState(() => schrijfGetal(waarde))
  const getypt = useRef(false)

  // Verandert de waarde van buitenaf — een andere regel, of teruggezet na het
  // opslaan — dan het veld bijwerken. Niet terwijl je zelf aan het typen bent.
  useEffect(() => {
    if (getypt.current) {
      getypt.current = false
      return
    }
    setTekst(schrijfGetal(waarde))
  }, [waarde])

  return (
    <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold text-muted">
      {label}
      <input
        type="text"
        inputMode="decimal"
        className={invoer}
        value={tekst}
        placeholder={placeholder}
        onChange={(e) => {
          // Alleen cijfers, komma en punt; de rest negeren we meteen zodat er
          // nooit iets in staat waar geen getal van te maken is.
          const ruw = e.target.value.replace(/[^\d.,]/g, '')
          getypt.current = true
          setTekst(ruw)
          onWijzig(leesGetal(ruw))
        }}
        // Alles geselecteerd bij het aantikken: dan typ je over de 0 heen in
        // plaats van hem eerst weg te moeten halen.
        onFocus={(e) => e.target.select()}
        onBlur={() => setTekst(schrijfGetal(leesGetal(tekst)))}
      />
    </label>
  )
}
