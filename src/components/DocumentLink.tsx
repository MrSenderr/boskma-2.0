import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { fotoUrl } from '../lib/meldingen'

/* Een document openen uit de beveiligde opslag.

   Bewust een echte link en geen knop die window.open aanroept: het adres moet
   eerst opgehaald worden, en daarna ziet de browser het openen niet meer als
   jouw tik. In een app op het beginscherm wordt dat geblokkeerd en gebeurt er
   niets. Een link met een adres erin werkt altijd. */

export function DocumentLink({
  pad,
  children,
  className = '',
}: {
  pad: string
  children: React.ReactNode
  className?: string
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [fout, setFout] = useState(false)

  useEffect(() => {
    let nog = true
    setUrl(null)
    setFout(false)
    fotoUrl(pad)
      .then((u) => nog && setUrl(u))
      .catch(() => nog && setFout(true))
    return () => {
      nog = false
    }
  }, [pad])

  const stijl = `inline-flex min-h-11 items-center justify-center gap-2 rounded-[4px] border border-line-strong px-4 py-2.5 text-sm font-semibold ${className}`

  if (fout) {
    return (
      <span className={`${stijl} border-bad text-bad`} title="Dit bestand is niet te openen">
        Niet gevonden
      </span>
    )
  }

  if (!url) {
    return (
      <span className={`${stijl} text-muted`}>
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Openen
      </span>
    )
  }

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" data-touch className={`${stijl} hover:bg-surface-2`}>
      {children}
    </a>
  )
}
