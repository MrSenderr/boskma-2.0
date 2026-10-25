import { useEffect, useRef, useState } from 'react'
import { Check, FileSignature } from 'lucide-react'
import { Kaart, Knop, Kopje, Pil, Veld } from './ui'
import { Krabbel } from './Krabbel'
import { DocumentLink } from './DocumentLink'
import { korteDatum } from '../lib/personeel'
import { useDocument } from '../lib/dossier'
import {
  codeKort,
  ondertekeningGeopend,
  useIkTeken,
  useMijnOndertekeningen,
  type Ondertekening,
} from '../lib/ondertekenen'

/* Het contract tekenen, aan de kant van de medewerker.
 *
 * Eerst lezen, dan tekenen — in die volgorde op het scherm, en de knop om te
 * tekenen staat onder het stuk en niet ernaast.
 *
 * Naam voluit typen is verplicht, de krabbel niet. Op een telefoon gaat een
 * krabbel vanzelf; met een muis wordt het een hanenpoot, en een verplicht vakje
 * dat niet wil is een medewerker die niet tekent.
 *
 * Eén keer. Een handtekening die je kunt overschrijven is er geen; gaat er iets
 * mis, dan trekt Sander hem in en begint hij opnieuw. Dat houdt de database ook
 * tegen, niet alleen dit scherm.
 */

function Tekenen({ o }: { o: Ondertekening }) {
  const teken = useIkTeken()
  const [naam, setNaam] = useState('')
  const [krabbel, setKrabbel] = useState<string | null>(null)
  const [akkoord, setAkkoord] = useState(false)
  const [ouderNaam, setOuderNaam] = useState('')
  const [ouderRelatie, setOuderRelatie] = useState('')
  const [ouderKrabbel, setOuderKrabbel] = useState<string | null>(null)
  const [fout, setFout] = useState<string | null>(null)

  const kan = naam.trim().length >= 2 && akkoord

  return (
    <div className="flex flex-col gap-4 border-t border-line pt-4">
      {fout && (
        <p className="rounded-[4px] border border-bad bg-bad-soft px-3 py-2 text-sm text-bad">
          {fout}
        </p>
      )}

      <Veld
        label="Je naam voluit"
        value={naam}
        onChange={(e) => setNaam(e.target.value)}
        placeholder="Voor- en achternaam"
      />

      <Krabbel waarde={krabbel} onVeranderd={setKrabbel} label="Je handtekening (hoeft niet)" />

      {o.ouder_nodig && (
        <div className="flex flex-col gap-3 rounded-[4px] bg-surface-2 p-3">
          <p className="text-sm">
            Je bent nog geen 18. Een ouder of verzorger kan hier meetekenen. Weet je niet of dat
            moet? Vul het in als die erbij is, anders laat je het leeg.
          </p>
          <Veld
            label="Naam ouder of verzorger"
            value={ouderNaam}
            onChange={(e) => setOuderNaam(e.target.value)}
          />
          <Veld
            label="Wat is hij of zij van je?"
            value={ouderRelatie}
            onChange={(e) => setOuderRelatie(e.target.value)}
            placeholder="Moeder, vader, verzorger"
          />
          {ouderNaam.trim().length >= 2 && (
            <Krabbel
              waarde={ouderKrabbel}
              onVeranderd={setOuderKrabbel}
              label="Handtekening ouder of verzorger (hoeft niet)"
            />
          )}
        </div>
      )}

      <label className="flex items-start gap-2.5">
        <input
          type="checkbox"
          checked={akkoord}
          onChange={(e) => setAkkoord(e.target.checked)}
          className="mt-1 size-5 shrink-0 accent-accent"
        />
        <span>
          Ik heb dit contract gelezen, ik ben het ermee eens en ik onderteken het met mijn naam
          hierboven.
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <Knop
          soort="primair"
          bezig={teken.isPending}
          disabled={!kan}
          onClick={() =>
            teken.mutate(
              {
                id: o.id,
                naam,
                krabbel,
                ouderNaam,
                ouderRelatie,
                ouderKrabbel,
              },
              { onError: (e) => setFout(e.message) },
            )
          }
        >
          <Check className="size-4" aria-hidden />
          Tekenen
        </Knop>
        {!kan && (
          <span className="text-sm text-muted">
            Vul je naam in en zet het vinkje; dan kun je tekenen.
          </span>
        )}
      </div>
    </div>
  )
}

function Een({ o }: { o: Ondertekening }) {
  const { data: contract } = useDocument(o.document_id)
  const { data: getekend } = useDocument(o.getekend_document_id)

  return (
    <Kaart className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <FileSignature className="size-4 shrink-0 text-muted" aria-hidden />
        <span className="font-display text-lg">Je contract</span>
        {o.afgerond_op ? (
          <Pil soort="goed">Getekend</Pil>
        ) : o.medewerker_op ? (
          <Pil soort="neutraal">Jij hebt getekend</Pil>
        ) : (
          <Pil soort="letop">Te tekenen</Pil>
        )}
      </div>

      {o.afgerond_op ? (
        <>
          <p>
            Allebei getekend op {korteDatum(o.werkgever_op)}. Het getekende contract staat hieronder
            en bij je documenten.
          </p>
          {getekend && <DocumentLink pad={getekend.pad}>Getekend contract openen</DocumentLink>}
        </>
      ) : o.medewerker_op ? (
        <>
          <p>
            Je hebt getekend op {korteDatum(o.medewerker_op)}. Sander tekent mee; daarna krijg je
            het getekende contract in je dossier.
          </p>
          {contract && <DocumentLink pad={contract.pad}>Contract openen</DocumentLink>}
        </>
      ) : (
        <>
          <p>Lees het contract eerst rustig door. Daarna teken je het hieronder.</p>
          {contract ? (
            <DocumentLink pad={contract.pad}>Contract openen</DocumentLink>
          ) : (
            <p className="text-sm text-muted">Het contract kon niet geopend worden.</p>
          )}
          <Tekenen o={o} />
        </>
      )}

      {/* De controlecode hoort erbij te staan, ook voor wie hem niet gebruikt:
          hij laat zien dat dit stuk later niet stilletjes vervangen kan worden. */}
      <p className="break-all text-sm text-muted">
        Controlecode van dit contract: <span className="font-mono">{codeKort(o.origineel_sha256)}</span>
      </p>
    </Kaart>
  )
}

export function MijnContracten() {
  const { data } = useMijnOndertekeningen()
  const gemeld = useRef<Set<string>>(new Set())

  useEffect(() => {
    ;(data ?? [])
      .filter((o) => !o.geopend_op && !gemeld.current.has(o.id))
      .forEach((o) => {
        gemeld.current.add(o.id)
        void ondertekeningGeopend(o.id)
      })
  }, [data])

  if (!data || data.length === 0) return null

  return (
    <section className="flex flex-col gap-3">
      <Kopje>Tekenen</Kopje>
      {data.map((o) => (
        <Een key={o.id} o={o} />
      ))}
    </section>
  )
}
