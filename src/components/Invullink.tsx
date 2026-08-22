import { useState } from 'react'
import { Check, Copy, Link2, Mail, MessageCircle } from 'lucide-react'
import { Kaart, Knop, Kopje } from './ui'
import { korteDatum, type Persoon } from '../lib/personeel'
import { maakInvullink, useTestmodus, type LinkResultaat } from '../lib/instellingen'
import { useQueryClient } from '@tanstack/react-query'

export function Invullink({ persoon }: { persoon: Persoon }) {
  const { data: testmodus } = useTestmodus()
  const client = useQueryClient()
  const [bezig, setBezig] = useState<'link' | 'mail' | null>(null)
  const [resultaat, setResultaat] = useState<LinkResultaat | null>(null)
  const [gekopieerd, setGekopieerd] = useState(false)

  async function maak(verstuurMail: boolean) {
    setBezig(verstuurMail ? 'mail' : 'link')
    setGekopieerd(false)
    const r = await maakInvullink(persoon.id, verstuurMail)
    setResultaat(r)
    setBezig(null)
    client.invalidateQueries({ queryKey: ['persoon', persoon.id] })
    client.invalidateQueries({ queryKey: ['personen'] })
  }

  async function kopieer(link: string) {
    try {
      await navigator.clipboard.writeText(link)
      setGekopieerd(true)
      setTimeout(() => setGekopieerd(false), 3000)
    } catch {
      setGekopieerd(false)
    }
  }

  const alVerstuurd = Boolean(persoon.onboarding_verstuurd_op)
  const alIngevuld = Boolean(persoon.onboarding_ingevuld_op)

  return (
    <section className="flex flex-col gap-3">
      <Kopje>Invullink</Kopje>

      <Kaart className="flex flex-col gap-4 p-4">
        <p className="text-sm text-muted">
          {alIngevuld
            ? `Ingevuld op ${korteDatum(persoon.onboarding_ingevuld_op)}. Een nieuwe link maken kan, maar overschrijft de oude.`
            : alVerstuurd
              ? `Link aangemaakt op ${korteDatum(persoon.onboarding_verstuurd_op)}. Nog niet ingevuld.`
              : 'Deze medewerker heeft nog geen link gekregen.'}
        </p>

        <div className="flex flex-wrap gap-2">
          <Knop soort="primair" bezig={bezig === 'link'} onClick={() => maak(false)}>
            <Link2 className="size-4" aria-hidden />
            Link maken om te delen
          </Knop>
          <Knop soort="rustig" bezig={bezig === 'mail'} onClick={() => maak(true)}>
            <Mail className="size-4" aria-hidden />
            Per mail versturen
          </Knop>
        </div>

        <p className="text-sm text-muted">
          Een nieuwe link maakt de vorige ongeldig, zodat er altijd maar één geldige
          link is.
        </p>

        {resultaat && !resultaat.ok && (
          <p className="rounded-[4px] border border-bad bg-bad-soft px-3 py-2 text-sm text-bad">
            Dit ging mis: {resultaat.error ?? 'onbekende fout'}
          </p>
        )}

        {resultaat?.ok && (
          <div className="flex flex-col gap-3 border-t border-line pt-4">
            {resultaat.verstuurd_naar && (
              <p className="text-sm">
                {resultaat.testmodus ? (
                  <span className="font-semibold text-warn">
                    Testmodus: de mail ging naar {resultaat.verstuurd_naar}, niet naar{' '}
                    {persoon.email ?? 'de medewerker'}.
                  </span>
                ) : (
                  <span>Mail verstuurd naar {resultaat.verstuurd_naar}.</span>
                )}
              </p>
            )}

            {resultaat.link && (
              <>
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-semibold text-muted">De link</span>
                  <input
                    readOnly
                    value={resultaat.link}
                    onFocus={(e) => e.currentTarget.select()}
                    className="w-full rounded-[4px] border-[1.5px] border-line-strong bg-bg px-3 py-2.5 text-sm"
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <Knop soort="rustig" onClick={() => kopieer(resultaat.link!)}>
                    {gekopieerd ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
                    {gekopieerd ? 'Gekopieerd' : 'Kopiëren'}
                  </Knop>
                  <a
                    data-touch
                    href={`https://wa.me/?text=${encodeURIComponent(
                      `Hoi! Wil je even je gegevens invullen voor de administratie? ${resultaat.link}`,
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-[4px] border border-line-strong px-4 py-2.5 text-sm font-semibold hover:bg-surface-2"
                  >
                    <MessageCircle className="size-4" aria-hidden />
                    Via WhatsApp
                  </a>
                </div>
              </>
            )}
          </div>
        )}
      </Kaart>

      {testmodus?.aan && (
        <p className="text-sm text-muted">
          Testmodus staat aan, dus mail gaat naar {testmodus.adres}. De link zelf
          werkt gewoon — die kun je zelf doorlopen om te zien wat een medewerker ziet.
        </p>
      )}
    </section>
  )
}
