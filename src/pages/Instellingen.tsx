import { useState } from 'react'
import { AlertTriangle, ShieldCheck } from 'lucide-react'
import { Kaart, Knop, Kopje, Laden, Mislukt, Veld } from '../components/ui'
import { useTestmodus, useTestmodusWijzigen } from '../lib/instellingen'

export function Instellingen() {
  const { data: testmodus, isPending, error, refetch } = useTestmodus()
  const wijzig = useTestmodusWijzigen()
  const [uitzettenBevestigen, setUitzettenBevestigen] = useState(false)
  const [adres, setAdres] = useState<string | null>(null)

  if (isPending) return <Laden />
  if (error) return <Mislukt tekst={error.message} opnieuw={() => refetch()} />

  const huidigAdres = adres ?? testmodus.adres

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <Kopje>Testmodus</Kopje>

        <Kaart className={`flex flex-col gap-4 p-5 ${testmodus.aan ? 'border-warn' : ''}`}>
          <div className="flex items-start gap-3">
            {testmodus.aan ? (
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-warn" aria-hidden />
            ) : (
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-bad" aria-hidden />
            )}
            <div>
              <p className="font-display text-lg">
                {testmodus.aan ? 'Testmodus staat aan' : 'Testmodus staat uit'}
              </p>
              <p className="mt-1 text-sm text-muted">
                {testmodus.aan
                  ? `Alle uitgaande mail gaat naar ${testmodus.adres}. Er bereikt niets een medewerker of het loonbureau.`
                  : 'Mail gaat naar de echte ontvangers: medewerkers en het loonbureau.'}
              </p>
            </div>
          </div>

          <Veld
            label="Testadres"
            type="email"
            value={huidigAdres}
            onChange={(e) => setAdres(e.target.value)}
            onBlur={() => {
              if (adres && adres !== testmodus.adres) {
                wijzig.mutate({ aan: testmodus.aan, adres })
              }
            }}
          />

          {testmodus.aan ? (
            uitzettenBevestigen ? (
              <div className="flex flex-col gap-3 rounded-[4px] border-[1.5px] border-bad bg-bad-soft p-4">
                <p className="text-sm font-semibold text-bad">
                  Weet je het zeker? Vanaf dat moment gaat mail echt naar medewerkers
                  en naar het loonbureau.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Knop
                    soort="gevaar"
                    bezig={wijzig.isPending}
                    onClick={() => {
                      wijzig.mutate({ aan: false, adres: huidigAdres })
                      setUitzettenBevestigen(false)
                    }}
                  >
                    Ja, testmodus uit
                  </Knop>
                  <Knop soort="rustig" onClick={() => setUitzettenBevestigen(false)}>
                    Nee, laat aan
                  </Knop>
                </div>
              </div>
            ) : (
              <Knop soort="rustig" className="w-fit" onClick={() => setUitzettenBevestigen(true)}>
                Testmodus uitzetten
              </Knop>
            )
          ) : (
            <Knop
              soort="primair"
              className="w-fit"
              bezig={wijzig.isPending}
              onClick={() => wijzig.mutate({ aan: true, adres: huidigAdres })}
            >
              Testmodus weer aanzetten
            </Knop>
          )}
        </Kaart>

        <p className="max-w-prose text-sm text-muted">
          Deze schakelaar geldt voor alles: de invullink naar een medewerker en straks
          het mutatieformulier naar het loonbureau. Kan de app de instelling niet
          lezen, dan doet hij alsof testmodus aan staat — liever een mail te weinig
          naar buiten dan een te veel.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <Kopje>Toegang</Kopje>
        <Kaart className="p-5">
          <p className="text-sm text-muted">
            Wie de app mag gebruiken staat vast in de database. Iemand toevoegen doen
            we samen — daar hoort ook een account bij.
          </p>
        </Kaart>
      </section>
    </div>
  )
}
