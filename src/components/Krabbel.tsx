import { useEffect, useRef, useState } from 'react'
import { Eraser } from 'lucide-react'

/* Een vak om met de vinger of de muis een handtekening in te zetten.
 *
 * Het is met opzet niet verplicht. Op een telefoon gaat het vanzelf; met een
 * muis wordt het een hanenpoot, en wie geen vaste hand heeft komt er niet
 * doorheen. De naam voluit typen is wat telt; dit is wat het eruit laat zien
 * als een handtekening.
 *
 * Twee dingen die anders misgaan:
 *
 * - **Pointer events, niet touch en mouse apart.** Eén set gebeurtenissen voor
 *   vinger, muis en pen, en met setPointerCapture blijft de lijn doorlopen als
 *   je buiten het vak uitschiet.
 * - **touch-action: none.** Zonder dat scrollt de pagina mee terwijl je tekent
 *   en krijg je op een telefoon een streepje van niks.
 *
 * Het canvas wordt op de echte pixeldichtheid gezet; anders is de lijn op een
 * telefoon een wazige balk.
 */

const BREEDTE = 600
const HOOGTE = 200

export function Krabbel({
  waarde,
  onVeranderd,
  label,
}: {
  waarde: string | null
  onVeranderd: (data: string | null) => void
  label: string
}) {
  const doek = useRef<HTMLCanvasElement>(null)
  const tekent = useRef(false)
  const [leeg, setLeeg] = useState(!waarde)

  useEffect(() => {
    const c = doek.current
    if (!c) return
    const dichtheid = Math.min(window.devicePixelRatio || 1, 3)
    c.width = BREEDTE * dichtheid
    c.height = HOOGTE * dichtheid
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.scale(dichtheid, dichtheid)
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#1b1b1b'
  }, [])

  function punt(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = doek.current!
    const vak = c.getBoundingClientRect()
    return {
      x: ((e.clientX - vak.left) / vak.width) * BREEDTE,
      y: ((e.clientY - vak.top) / vak.height) * HOOGTE,
    }
  }

  function begin(e: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = doek.current?.getContext('2d')
    if (!ctx) return
    e.currentTarget.setPointerCapture(e.pointerId)
    tekent.current = true
    const p = punt(e)
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
    // Een tik zonder beweging moet ook een puntje geven.
    ctx.lineTo(p.x + 0.1, p.y)
    ctx.stroke()
    setLeeg(false)
  }

  function door(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!tekent.current) return
    const ctx = doek.current?.getContext('2d')
    if (!ctx) return
    const p = punt(e)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
  }

  function klaar() {
    if (!tekent.current) return
    tekent.current = false
    const c = doek.current
    if (c) onVeranderd(c.toDataURL('image/png'))
  }

  function wissen() {
    const c = doek.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx) return
    ctx.clearRect(0, 0, c.width, c.height)
    setLeeg(true)
    onVeranderd(null)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold text-muted">{label}</span>
      <div className="relative">
        <canvas
          ref={doek}
          onPointerDown={begin}
          onPointerMove={door}
          onPointerUp={klaar}
          onPointerCancel={klaar}
          className="h-[160px] w-full touch-none rounded-[4px] border-[1.5px] border-line-strong bg-bg"
          style={{ touchAction: 'none' }}
          aria-label={label}
        />
        {leeg && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted">
            Teken hier met je vinger of je muis
          </span>
        )}
      </div>
      {!leeg && (
        <button
          type="button"
          className="flex w-fit items-center gap-1.5 text-sm text-muted underline hover:text-text"
          onClick={wissen}
        >
          <Eraser className="size-4" aria-hidden />
          opnieuw
        </button>
      )}
    </div>
  )
}
