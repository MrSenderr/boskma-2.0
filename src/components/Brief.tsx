import type { Blok } from '../lib/brieven'

/* Een brief op het scherm.
 *
 * Wordt gevoed met de blokken zoals ze zijn verstuurd (brief_opbouw), niet met
 * de tekst zoals de app hem vandaag zou schrijven. Verandert de tekst later,
 * dan blijft een verstuurde brief staan zoals hij die dag luidde — en dat is
 * precies wat je wilt kunnen laten zien. */
export function Brief({
  aanhef,
  blokken,
  afsluiting,
}: {
  aanhef?: string
  blokken: Blok[]
  afsluiting?: string[]
}) {
  return (
    <div className="flex flex-col gap-3">
      {aanhef && <p>{aanhef}</p>}
      {blokken.map((b, i) => {
        if (b.soort === 'kop') {
          return (
            <p key={i} className="font-semibold">
              {b.tekst}
            </p>
          )
        }
        if (b.soort === 'lijst') {
          return (
            <ul key={i} className="flex list-disc flex-col gap-1 pl-5">
              {b.regels.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )
        }
        if (b.soort === 'kader') {
          return (
            <p key={i} className="rounded-[4px] border-l-[3px] border-accent bg-surface-2 px-4 py-3">
              {b.tekst}
            </p>
          )
        }
        return (
          <p key={i} className="whitespace-pre-wrap">
            {b.tekst}
          </p>
        )
      })}
      {afsluiting && afsluiting.length > 0 && (
        <p className="whitespace-pre-line">{afsluiting.join('\n')}</p>
      )}
    </div>
  )
}
