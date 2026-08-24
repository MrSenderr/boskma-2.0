/* De onder- en bovenkant van een burgerbroodje. Zie
   docs/Modules/werkkaarten.md.

   Getekend en niet gefotografeerd: schaalt mee met elk scherm, laadt direct, en
   werkt ook als het netwerk hapert. Het broodje is geen stap in de stapel — dat
   gaat apart de oven in — maar de omlijsting eromheen. */

const KORST = '#C98F4E'
const KORST_DONKER = '#A96F32'
const ZAADJE = '#F3E2C0'
/* Het kruim aan de snijkant; zonder dat lijkt het een blok en geen broodje. */
const KRUIM = '#F0DDB4'

export function BroodjeBoven({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 52"
      preserveAspectRatio="none"
      className={`h-14 w-full ${className}`}
      role="img"
      aria-label="Bovenkant van het broodje"
    >
      <defs>
        <linearGradient id="broodje-boven" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E0A863" />
          <stop offset="70%" stopColor={KORST} />
          <stop offset="100%" stopColor={KORST_DONKER} />
        </linearGradient>
      </defs>
      {/* De bol: rond vanboven, recht op de onderrand waar het beleg begint. */}
      <path d="M2 46 C2 12 46 2 100 2 C154 2 198 12 198 46 Z" fill="url(#broodje-boven)" />
      {/* De snijkant. */}
      <rect x="2" y="45" width="196" height="6" rx="2" fill={KRUIM} />
      {/* Sesamzaadjes, met de hand verdeeld zodat het geen patroon wordt. */}
      <g fill={ZAADJE} opacity="0.85">
        <ellipse cx="58" cy="30" rx="4" ry="2.4" transform="rotate(-18 58 30)" />
        <ellipse cx="88" cy="20" rx="4" ry="2.4" transform="rotate(12 88 20)" />
        <ellipse cx="120" cy="27" rx="4" ry="2.4" transform="rotate(-8 120 27)" />
        <ellipse cx="146" cy="38" rx="4" ry="2.4" transform="rotate(22 146 38)" />
        <ellipse cx="40" cy="42" rx="4" ry="2.4" transform="rotate(8 40 42)" />
        <ellipse cx="100" cy="38" rx="4" ry="2.4" transform="rotate(-25 100 38)" />
        <ellipse cx="168" cy="30" rx="4" ry="2.4" transform="rotate(-14 168 30)" />
        <ellipse cx="72" cy="44" rx="4" ry="2.4" transform="rotate(30 72 44)" />
      </g>
    </svg>
  )
}

export function BroodjeOnder({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 34"
      preserveAspectRatio="none"
      className={`h-9 w-full ${className}`}
      role="img"
      aria-label="Onderkant van het broodje"
    >
      <defs>
        <linearGradient id="broodje-onder" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#D79A57" />
          <stop offset="100%" stopColor={KORST_DONKER} />
        </linearGradient>
      </defs>
      {/* De snijkant boven, en daaronder de korst die naar de bodem toeloopt. */}
      <path d="M2 7 H198 V18 C198 28 154 33 100 33 C46 33 2 28 2 18 Z" fill="url(#broodje-onder)" />
      <rect x="2" y="1" width="196" height="7" rx="2" fill={KRUIM} />
    </svg>
  )
}
