// De bouwstenen waar de rest van de app uit bestaat.
// Regel: staat er een kleur of maat rechtstreeks in een scherm, dan ontbreekt
// hier een component. Zo blijft alles vanzelf hetzelfde.

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

/* ---------------------------------------------------------------- Knop --- */

type KnopSoort = 'primair' | 'rustig' | 'gevaar'

type KnopProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  soort?: KnopSoort
  bezig?: boolean
  breed?: boolean
}

const knopStijl: Record<KnopSoort, string> = {
  primair: 'bg-brand text-on-brand hover:opacity-90',
  rustig: 'bg-transparent text-text border border-line-strong hover:bg-surface-2',
  gevaar: 'bg-transparent text-bad border border-bad hover:bg-bad-soft',
}

export function Knop({ soort = 'primair', bezig, breed, children, className = '', ...rest }: KnopProps) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || bezig}
      className={`inline-flex items-center justify-center gap-2 rounded-[4px] px-4 py-2.5 text-sm font-semibold transition-opacity disabled:opacity-50 ${knopStijl[soort]} ${breed ? 'w-full' : ''} ${className}`}
    >
      {bezig && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  )
}

/* --------------------------------------------------------------- Kaart --- */

export function Kaart({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-card border border-line bg-surface ${className}`}>{children}</div>
  )
}

/* ----------------------------------------------------------------- Pil --- */

type PilSoort = 'goed' | 'letop' | 'fout' | 'neutraal'

const pilStijl: Record<PilSoort, string> = {
  goed: 'bg-good-soft text-good',
  letop: 'bg-warn-soft text-warn',
  fout: 'bg-bad-soft text-bad',
  neutraal: 'bg-surface-2 text-muted',
}

/** Altijd een woord bij de kleur — nooit alleen een kleur. */
export function Pil({ soort = 'neutraal', children }: { soort?: PilSoort; children: ReactNode }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-bold ${pilStijl[soort]}`}
    >
      {children}
    </span>
  )
}

/* ------------------------------------------------------------ Tekstveld --- */

type VeldProps = InputHTMLAttributes<HTMLInputElement> & { label: string; fout?: string }

export function Veld({ label, fout, id, className = '', ...rest }: VeldProps) {
  const veldId = id ?? `veld-${label.toLowerCase().replace(/\W+/g, '-')}`
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={veldId} className="text-sm font-semibold text-muted">
        {label}
      </label>
      <input
        {...rest}
        id={veldId}
        aria-invalid={fout ? true : undefined}
        className={`w-full rounded-[4px] border-[1.5px] bg-bg px-3 py-2.5 text-base tabular-nums outline-none transition-colors focus:border-accent ${fout ? 'border-bad' : 'border-line-strong'} ${className}`}
      />
      {fout && <span className="text-sm text-bad">{fout}</span>}
    </div>
  )
}

/* ------------------------------------------------------------ Toestanden --- */

export function Laden({ tekst = 'Bezig met laden…' }: { tekst?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 p-12 text-muted">
      <Loader2 className="size-5 animate-spin" aria-hidden />
      <span>{tekst}</span>
    </div>
  )
}

export function Leeg({
  titel,
  uitleg,
  actie,
}: {
  titel: string
  uitleg?: string
  actie?: ReactNode
}) {
  return (
    <Kaart className="flex flex-col items-center gap-3 p-12 text-center">
      <p className="font-display text-lg">{titel}</p>
      {uitleg && <p className="max-w-sm text-sm text-muted">{uitleg}</p>}
      {actie}
    </Kaart>
  )
}

export function Mislukt({ tekst, opnieuw }: { tekst: string; opnieuw?: () => void }) {
  return (
    <Kaart className="flex flex-col items-center gap-3 border-bad p-12 text-center">
      <p className="font-display text-lg text-bad">Dit ging mis</p>
      <p className="max-w-sm text-sm text-muted">{tekst}</p>
      {opnieuw && (
        <Knop soort="rustig" onClick={opnieuw}>
          Opnieuw proberen
        </Knop>
      )}
    </Kaart>
  )
}

/* ---------------------------------------------------------------- Label --- */

/** Het wijd gezette kapitaal uit het logo ("SINDS 1959"), voor kopjes. */
export function Kopje({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">{children}</p>
  )
}
