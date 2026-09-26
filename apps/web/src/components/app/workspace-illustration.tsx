import { useId } from 'react'
import styles from './workspace-illustration.module.css'

/** Decorative table and SQL sketches: no records or schema from the current base. */
export function WorkspaceIllustration() {
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

      <g className={styles.table}>
        <g transform="rotate(-7 182 130)" filter={`url(#${id}-shadow)`}>
          <rect
            x="68"
            y="54"
            width="228"
            height="152"
            rx="12"
            fill="var(--card)"
            stroke="var(--border)"
          />
          <path d="M68 91h228" stroke="var(--border)" />
          <rect
            x="82"
            y="66"
            width="16"
            height="14"
            rx="3"
            fill="var(--primary)"
            fillOpacity="0.12"
          />
          <path
            d="M86 70h8v6h-8zM86 72h8M89 72v4"
            stroke="var(--primary)"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
          <rect
            x="106"
            y="70"
            width="54"
            height="5"
            rx="2.5"
            fill="var(--foreground)"
            fillOpacity="0.3"
          />
          <circle cx="277" cy="73" r="2" fill="var(--muted-foreground)" fillOpacity="0.5" />
          <circle cx="270" cy="73" r="2" fill="var(--muted-foreground)" fillOpacity="0.3" />

          <rect x="79" y="101" width="206" height="19" rx="4" fill="var(--muted)" />
          <g fill="var(--muted-foreground)" fillOpacity="0.35">
            <rect x="110" y="108" width="34" height="4" rx="2" />
            <rect x="183" y="108" width="26" height="4" rx="2" />
            <rect x="249" y="108" width="23" height="4" rx="2" />
          </g>
          <rect
            x="79"
            y="150"
            width="206"
            height="22"
            rx="4"
            fill="var(--primary)"
            fillOpacity="0.08"
          />
          <path
            d="M102 101v95M175 101v95M239 101v95M79 145h206M79 173h206"
            stroke="var(--border)"
            strokeOpacity="0.65"
          />
          <g fill="var(--muted-foreground)" fillOpacity="0.22">
            <rect x="110" y="131" width="46" height="5" rx="2.5" />
            <rect x="110" y="158" width="37" height="5" rx="2.5" />
            <rect x="110" y="184" width="51" height="5" rx="2.5" />
            <rect x="249" y="131" width="20" height="5" rx="2.5" />
            <rect x="249" y="158" width="18" height="5" rx="2.5" />
            <rect x="249" y="184" width="24" height="5" rx="2.5" />
            <rect x="86" y="131" width="6" height="5" rx="2" />
            <rect x="86" y="158" width="6" height="5" rx="2" />
            <rect x="86" y="184" width="6" height="5" rx="2" />
          </g>
          <rect
            x="184"
            y="128"
            width="38"
            height="11"
            rx="5.5"
            fill="var(--primary)"
            fillOpacity="0.16"
          />
          <rect
            x="184"
            y="155"
            width="29"
            height="11"
            rx="5.5"
            fill="var(--primary)"
            fillOpacity="0.3"
          />
          <rect x="184" y="181" width="36" height="11" rx="5.5" fill="var(--muted)" />
        </g>
      </g>

      <g className={styles.query}>
        <g transform="rotate(6 292 194)" filter={`url(#${id}-shadow)`}>
          <rect
            x="210"
            y="144"
            width="164"
            height="106"
            rx="12"
            fill="var(--code)"
            stroke="var(--code-border)"
          />
          <path d="M210 174h164" stroke="var(--code-border)" />
          <path
            d="m225 155 4 4-4 4m9 0h5"
            stroke="var(--syn-string)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <text
            x="246"
            y="162"
            fill="var(--code-foreground)"
            opacity="0.7"
            fontSize="9"
            fontWeight="500"
            className="font-mono"
          >
            SQL
          </text>
          <circle cx="358" cy="159" r="2.5" fill="var(--syn-string)" opacity="0.8" />
          <g className="font-mono" fontSize="10" fontWeight="500">
            <text x="225" y="193" fill="var(--syn-keyword)">
              SELECT
            </text>
            <text x="269" y="193" fill="var(--code-foreground)">
              *
            </text>
            <text x="225" y="210" fill="var(--syn-keyword)">
              FROM
            </text>
          </g>
          <rect
            x="259"
            y="204"
            width="53"
            height="5"
            rx="2.5"
            fill="var(--syn-string)"
            opacity="0.55"
          />
          <rect
            x="225"
            y="222"
            width="19"
            height="4"
            rx="2"
            fill="var(--code-foreground)"
            opacity="0.2"
          />
          <rect
            x="250"
            y="222"
            width="38"
            height="4"
            rx="2"
            fill="var(--code-foreground)"
            opacity="0.12"
          />
          <path d="M295 220v8" stroke="var(--syn-string)" strokeWidth="1.5" strokeLinecap="round" />
        </g>
      </g>

      <g className={styles.detail}>
        <rect
          x="322"
          y="53"
          width="30"
          height="30"
          rx="10"
          transform="rotate(12 337 68)"
          fill="var(--card)"
          stroke="var(--border)"
        />
        <path
          d="m333 64-4 4 4 4m8-8 4 4-4 4"
          stroke="var(--primary)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="77" cy="214" r="15" fill="var(--card)" stroke="var(--border)" />
        <path
          d="M72 214h10m-5-5v10"
          stroke="var(--primary)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M45 91v6m-3-3h6M368 117v6m-3-3h6"
          stroke="var(--primary)"
          strokeOpacity="0.4"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <circle cx="155" cy="243" r="2" fill="var(--primary)" opacity="0.35" />
        <circle cx="296" cy="34" r="2" fill="var(--primary)" opacity="0.35" />
      </g>
    </svg>
  )
}
