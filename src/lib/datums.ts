/* Rekenen met kale datums (JJJJ-MM-DD).
 *
 * Stond eerst in contractwaker.ts, maar de contractgeschiedenis rekent met
 * dezelfde maanden en dagen. Twee kopieën van dezelfde maandentelling is
 * vragen om twee verschillende antwoorden op dezelfde vraag.
 *
 * Alles rekent om twaalf uur 's middags. Doe je dat om middernacht, dan
 * verspringt een datum bij de overgang naar zomertijd — en dan loopt een
 * aanzegtermijn er een dag naast. */

/** Twaalf uur 's middags op deze dag. */
export function alsDag(s: string): Date {
  return new Date(`${s.slice(0, 10)}T12:00:00`)
}

export function iso(d: Date): string {
  const j = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dag = String(d.getDate()).padStart(2, '0')
  return `${j}-${m}-${dag}`
}

/** Zoveel maanden erbij; bestaat de dag niet (31 → februari), dan de laatste. */
export function plusMaanden(s: string, maanden: number): string {
  const d = alsDag(s)
  const dag = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + maanden)
  const laatste = new Date(d.getFullYear(), d.getMonth() + 1, 0, 12).getDate()
  d.setDate(Math.min(dag, laatste))
  return iso(d)
}

export function dagenTussen(van: string, tot: string): number {
  return Math.round((alsDag(tot).getTime() - alsDag(van).getTime()) / 86_400_000)
}

export function vandaagIso(): string {
  return iso(new Date())
}
