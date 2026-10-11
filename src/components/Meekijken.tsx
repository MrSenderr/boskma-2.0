import { Eye } from 'lucide-react'
import { Kaart } from './ui'
import { useWieBenIk } from '../lib/wie'
import { useModus } from '../lib/modus'

/* Sander die met de schakelaar het medewerkersgezicht bekijkt.

   Hij staat zelf niet op de loonlijst, dus er is voor hem geen dossier, geen
   persoonlijk gegevensblad en geen voorkeur voor vaste dagen. Zonder uitleg
   blijven die schermen op "laden" staan of lijken ze stuk. Dit vertelt wat er
   aan de hand is, in plaats van een molentje dat nooit stopt. */

export function useMeekijken(): boolean {
  const { data: wie } = useWieBenIk()
  const [modus] = useModus()
  return wie?.rol === 'beheerder' && modus === 'medewerker'
}

/** De uitleg op een scherm dat zonder eigen gegevens niets kan tonen. */
export function MeekijkenLeeg({ wat }: { wat: string }) {
  return (
    <Kaart className="flex items-start gap-3 p-5">
      <Eye className="mt-0.5 size-5 shrink-0 text-muted" aria-hidden />
      <div>
        <p className="font-semibold">Je kijkt mee als medewerker</p>
        <p className="mt-1 text-sm text-muted">
          Hier staat {wat} van de medewerker die is ingelogd. Jij staat niet op de loonlijst, dus
          voor jou is er niets om te tonen. De opbouw van het scherm zie je wel.
        </p>
      </div>
    </Kaart>
  )
}
