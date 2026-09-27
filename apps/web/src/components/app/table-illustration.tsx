import { useId } from 'react'
import styles from './workspace-illustration.module.css'

/** An empty grid with its first row ready to be filled. */
export function TableIllustration() {
  const id = useId()

  return (
    <svg
      viewBox="0 0 420 280"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={styles.illustration}
    >
      <defs>
        <radialGradient id={`${id}-halo`}>
          <stop stopColor="var(--primary)" stopOpacity="0.12" />
          <stop offset="1" stopColor="var(--primary)" stopOpacity="0" />
        </radialGradient>
        <filter id={`${id}-shadow`} x="-30%" y="-40%" width="160%" height="190%">
          <feDropShadow dx="0" dy="10" stdDeviation="9" floodColor="#102b1c" floodOpacity="0.09" />
        </filter>
      </defs>
      <ellipse cx="212" cy="148" rx="178" ry="130" fill={`url(#${id}-halo)`} />
      <circle cx="211" cy="145" r="112" stroke="var(--primary)" strokeOpacity="0.09" />
      <path
        d="M66 134a146 146 0 0 1 273-59M352 188a146 146 0 0 1-256 43"
        stroke="var(--primary)"
        strokeOpacity="0.2"
        strokeDasharray="3 7"
        strokeLinecap="round"
      />

      <g className={styles.back}>
        <g transform="rotate(-7 206 138)" filter={`url(#${id}-shadow)`}>
          <rect
            x="87"
            y="57"
            width="243"
            height="167"
            rx="13"
            fill="var(--card)"
            stroke="var(--border)"
          />
          <rect
            x="101"
            y="72"
            width="24"
            height="24"
            rx="7"
            fill="var(--primary)"
            fillOpacity="0.12"
          />
          <path
            d="M107 78h12v12h-12zM107 82h12M111 82v8"
            stroke="var(--primary)"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
          <rect
            x="135"
            y="78"
            width="72"
            height="5"
            rx="2.5"
            fill="var(--foreground)"
            fillOpacity="0.3"
          />
          <rect
            x="135"
            y="88"
            width="42"
            height="4"
            rx="2"
            fill="var(--muted-foreground)"
            fillOpacity="0.2"
          />
          <circle cx="300" cy="83" r="2" fill="var(--muted-foreground)" fillOpacity="0.4" />
          <circle cx="307" cy="83" r="2" fill="var(--muted-foreground)" fillOpacity="0.4" />
          <rect x="101" y="109" width="215" height="22" rx="4" fill="var(--muted)" />
          <path
            d="M101 151h215M101 174h215M101 197h215M144 109v102M231 109v102"
            stroke="var(--border)"
          />
          <g fill="var(--muted-foreground)" fillOpacity="0.3">
            <rect x="112" y="118" width="19" height="4" rx="2" />
            <rect x="156" y="118" width="43" height="4" rx="2" />
            <rect x="243" y="118" width="37" height="4" rx="2" />
          </g>
        </g>
      </g>

      <g className={styles.front}>
        <g transform="rotate(5 237 189)" filter={`url(#${id}-shadow)`}>
          <rect
            x="112"
            y="165"
            width="249"
            height="48"
            rx="10"
            fill="var(--card)"
            stroke="var(--primary)"
            strokeOpacity="0.35"
          />
          <rect
            x="112"
            y="165"
            width="249"
            height="48"
            rx="10"
            fill="var(--primary)"
            fillOpacity="0.06"
          />
          <rect
            x="124"
            y="177"
            width="24"
            height="24"
            rx="7"
            fill="var(--primary)"
            fillOpacity="0.12"
          />
          <path
            d="M131 189h10m-5-5v10"
            stroke="var(--primary)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <rect
            x="162"
            y="180"
            width="107"
            height="18"
            rx="4"
            stroke="var(--primary)"
            strokeOpacity="0.35"
            strokeDasharray="3 4"
          />
          <path d="M172 185v8" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M284 180v18" stroke="var(--border)" />
          <rect
            x="298"
            y="187"
            width="35"
            height="4"
            rx="2"
            fill="var(--primary)"
            fillOpacity="0.2"
          />
        </g>
        <circle cx="326" cy="223" r="23" fill="var(--card)" stroke="var(--border)" />
        <circle cx="326" cy="223" r="18" fill="var(--primary)" fillOpacity="0.12" />
        <path
          d="m319 226 1-5 9-9 4 4-9 9-5 1ZM327 214l4 4M318 232h15"
          stroke="var(--primary)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <g className={styles.detail} stroke="var(--primary)" strokeLinecap="round" strokeWidth="1.5">
        <path d="M64 100v6m-3-3h6M350 107v8m-4-4h8" strokeOpacity="0.4" />
        <circle cx="80" cy="214" r="3" strokeOpacity="0.3" />
        <circle cx="275" cy="35" r="2" fill="var(--primary)" fillOpacity="0.3" stroke="none" />
      </g>
    </svg>
  )
}
