import { Link } from 'react-router-dom'
import { ListOrdered } from 'lucide-react'

/* Naar de uitleg bij een taak. Klein en onopvallend: je hebt hem meestal niet
   nodig, maar als je hem nodig hebt wil je niet zoeken.
   Zie docs/Modules/werkwijzen.md. */

export function UitlegKnop({ werkwijzeId, wat }: { werkwijzeId: number | null; wat: string }) {
  if (!werkwijzeId) return null
  return (
    <Link
      to={`/werkwijzen/${werkwijzeId}`}
      data-touch
      aria-label={`Uitleg bij ${wat}`}
      title={`Uitleg bij ${wat}`}
      onClick={(e) => e.stopPropagation()}
      className="flex size-9 shrink-0 items-center justify-center rounded-[4px] text-muted hover:bg-surface-2 hover:text-accent"
    >
      <ListOrdered className="size-4" aria-hidden />
    </Link>
  )
}
