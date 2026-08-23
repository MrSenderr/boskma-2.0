import { Kopje } from '../components/ui'
import { PersoonlijkeTaken, Werklijsten } from '../components/Taakblokken'
import { useWieBenIk } from '../lib/wie'

/* Alles wat er aan taken voor een medewerker klaarstaat, bij elkaar. Op Vandaag
   staat hetzelfde, maar daar als samenvatting tussen de rest. */

export function MijnTaken() {
  const { data: wie } = useWieBenIk()

  return (
    <div className="flex flex-col gap-6">
      <Kopje>Taken</Kopje>
      <Werklijsten kopje="Vaste lijsten" />
      <PersoonlijkeTaken medewerkerId={wie?.medewerker_id} kopje="Voor jou" toonLeeg />
    </div>
  )
}
