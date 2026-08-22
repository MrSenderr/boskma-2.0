import { Kaart } from '../components/ui'

export function Binnenkort({ module, uitleg }: { module: string; uitleg: string }) {
  return (
    <Kaart className="p-8">
      <p className="font-display text-xl">{module}</p>
      <p className="mt-2 max-w-prose text-sm text-muted">{uitleg}</p>
    </Kaart>
  )
}
