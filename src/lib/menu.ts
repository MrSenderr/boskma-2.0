import {
  Banknote,
  CalendarClock,
  CalendarDays,
  FolderOpen,
  MessageCircleQuestion,
  MonitorPlay,
  ReceiptEuro,
  Settings,
  ShoppingCart,
  UserCircle,
  Users,
} from 'lucide-react'
import type { Modus } from './modus'

/* Het menu, met de onderdelen van een module eronder.

   Die onderdelen stonden eerst als tabbladen boven het scherm. Ze staan nu
   allemaal op een plek, zodat je nergens hoeft te zoeken waar iets zit. Alleen
   de module waar je in bent staat open; anders wordt het een lijst van
   tweeëntwintig regels waar je op een telefoon doorheen moet scrollen. */
export const MENU: {
  pad: string
  label: string
  icoon: typeof Users
  exact: boolean
  voor: Modus | 'beide'
  kinderen?: { pad: string; label: string }[]
}[] = [
  // Vandaag bestaat voor allebei de gezichten, met een andere inhoud.
  { pad: '/', label: 'Vandaag', icoon: CalendarDays, exact: true, voor: 'beide' },
  { pad: '/kim', label: 'Kim', icoon: MessageCircleQuestion, exact: false, voor: 'beheer' },
  {
    pad: '/facturen', label: 'Facturen', icoon: ReceiptEuro, exact: false, voor: 'beheer',
    kinderen: [
      { pad: '/facturen/inkomend', label: 'Inkomend' },
      { pad: '/facturen/uitgaand', label: 'Uitgaand' },
      { pad: '/facturen/klanten', label: 'Klanten' },
      { pad: '/facturen/prijslijst', label: 'Prijslijst' },
      { pad: '/facturen/leveranciers', label: 'Leveranciers' },
    ],
  },
  { pad: '/kas', label: 'Kas tellen', icoon: Banknote, exact: false, voor: 'beheer' },
  {
    pad: '/inkoop', label: 'Inkoop', icoon: ShoppingCart, exact: false, voor: 'beheer',
    kinderen: [
      { pad: '/inkoop/documenten', label: 'Facturen' },
      { pad: '/inkoop/prijzen', label: 'Prijsmutaties' },
      { pad: '/inkoop/stuksprijzen', label: 'Stuksprijzen' },
      { pad: '/inkoop/producten', label: 'Producten' },
      { pad: '/inkoop/uploaden', label: 'Toevoegen' },
      { pad: '/inkoop/instellingen', label: 'Instellingen' },
    ],
  },
  { pad: '/personeel', label: 'Personeel', icoon: Users, exact: false, voor: 'beheer' },
  {
    pad: '/rooster', label: 'Rooster', icoon: CalendarClock, exact: false, voor: 'beheer',
    kinderen: [
      { pad: '/rooster/dag', label: 'Dag' },
      { pad: '/rooster/medewerkers', label: 'Per medewerker' },
      { pad: '/rooster/importeren', label: 'Importeren' },
    ],
  },
  {
    pad: '/schermen', label: 'Schermen', icoon: MonitorPlay, exact: false, voor: 'beheer',
    kinderen: [
      { pad: '/schermen/lijst', label: 'Schermen' },
      { pad: '/schermen/afbeeldingen', label: 'Afbeeldingen' },
    ],
  },
  { pad: '/instellingen', label: 'Instellingen', icoon: Settings, exact: false, voor: 'beheer' },
  // Het medewerkersgezicht. Straks het enige dat je personeel te zien krijgt.
  { pad: '/mijn-gegevens', label: 'Mijn gegevens', icoon: UserCircle, exact: false, voor: 'medewerker' },
  { pad: '/mijn-dossier', label: 'Mijn dossier', icoon: FolderOpen, exact: false, voor: 'medewerker' },
]

/* De naam van het scherm waar je bent: het onderdeel als dat er is, anders de
   module. Hij staat zowel in de balk bovenin als als kop op de pagina, en die
   twee horen hetzelfde te zeggen. */
export function titelVoor(pad: string): string {
  for (const m of MENU) {
    const kind = m.kinderen?.find((k) => pad.startsWith(k.pad))
    if (kind) return kind.label
  }
  const module = MENU.find((m) => (m.exact ? m.pad === pad : pad.startsWith(m.pad)))
  return module?.label ?? 'Boskma'
}
