import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

/* Timers voor de oven en de frituur. Zie docs/Modules/werkkaarten.md.

   Drie dingen die hier bewust zo staan:

   * Er rekenen met een eindtijd, niet met tellen. Leg je je telefoon weg, dan
     slaat de browser rustig een paar tikken over — een timer die optelt loopt
     dan achter. Dit is de fout die je bij veel keukentimers ziet.
   * Meerdere tegelijk, want er staan twee dingen in de oven.
   * Het geluid maakt de app zelf. Geen bestand dat geladen moet worden, dus het
     piept ook als het internet hapert. */

export type Timer = {
  id: number
  naam: string
  eindeOp: number
  afgelopen: boolean
}

type TimerDoos = {
  timers: Timer[]
  start: (naam: string, minuten: number) => void
  stop: (id: number) => void
}

const Doos = createContext<TimerDoos | null>(null)

/* De geluidsmachine wordt aangemaakt op het moment dat je een timer start.
   Dat is een tik van de gebruiker, en alleen dan mag een browser geluid
   vrijgeven — iOS en Chrome zetten een machine die uit een tijdklok komt
   meteen op stil. Daarom bewaren we hem en gebruiken we hem later opnieuw. */
type MetWebkit = typeof window & { webkitAudioContext?: typeof AudioContext }
let machine: AudioContext | null = null

function ontgrendelGeluid() {
  try {
    const Maker = window.AudioContext ?? (window as MetWebkit).webkitAudioContext
    if (!Maker) return
    if (!machine) machine = new Maker()
    if (machine.state === 'suspended') void machine.resume()
  } catch {
    // Geen geluid is vervelend, maar geen reden om de timer te laten vallen.
  }
}

/** Drie korte piepjes, opgebouwd in de browser zelf. */
function piep() {
  try {
    const ctx = machine
    if (!ctx) return
    if (ctx.state === 'suspended') void ctx.resume()
    const nu = ctx.currentTime
    for (const start of [0, 0.35, 0.7]) {
      const toon = ctx.createOscillator()
      const volume = ctx.createGain()
      toon.type = 'sine'
      toon.frequency.value = 880
      volume.gain.setValueAtTime(0.0001, nu + start)
      volume.gain.exponentialRampToValueAtTime(0.3, nu + start + 0.02)
      volume.gain.exponentialRampToValueAtTime(0.0001, nu + start + 0.25)
      toon.connect(volume).connect(ctx.destination)
      toon.start(nu + start)
      toon.stop(nu + start + 0.3)
    }
    // Niet sluiten: dezelfde machine moet straks de volgende timer laten piepen,
    // en een nieuwe zou opnieuw op stil beginnen.
  } catch {
    // De melding in beeld blijft hoe dan ook staan.
  }
}

export function Timers({ children }: { children: ReactNode }) {
  const [timers, setTimers] = useState<Timer[]>([])
  const volgende = useRef(1)

  const start = useCallback((naam: string, minuten: number) => {
    ontgrendelGeluid()
    setTimers((was) => [
      ...was,
      { id: volgende.current++, naam, eindeOp: Date.now() + minuten * 60_000, afgelopen: false },
    ])
  }, [])

  const stop = useCallback((id: number) => {
    setTimers((was) => was.filter((t) => t.id !== id))
  }, [])

  // Eén klok voor alles. Hij kijkt naar de eindtijd, dus een gemiste tik
  // verandert niets aan wanneer er gepiept wordt.
  useEffect(() => {
    if (timers.length === 0) return
    const klok = setInterval(() => {
      setTimers((was) => {
        let veranderd = false
        const nieuw = was.map((t) => {
          if (!t.afgelopen && Date.now() >= t.eindeOp) {
            veranderd = true
            return { ...t, afgelopen: true }
          }
          return t
        })
        if (veranderd) piep()
        // Ook zonder verandering opnieuw zetten, zodat de balk blijft aftellen.
        return veranderd ? nieuw : [...was]
      })
    }, 1000)
    return () => clearInterval(klok)
  }, [timers.length])

  return <Doos.Provider value={{ timers, start, stop }}>{children}</Doos.Provider>
}

export function useTimers() {
  const doos = useContext(Doos)
  if (!doos) throw new Error('useTimers hoort binnen <Timers> te staan')
  return doos
}

export function resterend(timer: Timer) {
  return Math.max(0, Math.round((timer.eindeOp - Date.now()) / 1000))
}

export function alsKlok(seconden: number) {
  const m = Math.floor(seconden / 60)
  const s = seconden % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
