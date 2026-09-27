import { useId } from 'react'
import styles from './workspace-illustration.module.css'

/** A small query editor, waiting for its first execution. */
export function SqlIllustration() {
  const id = useId()

  return (
    <svg
      viewBox="0 0 320 220"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={`${styles.illustration} ${styles.compact}`}
    >
      <defs>
        <radialGradient id={`${id}-halo`}>
          <stop stopColor="var(--primary)" stopOpacity="0.12" />
          <stop offset="1" stopColor="var(--primary)" stopOpacity="0" />
        </radialGradient>
        <filter id={`${id}-shadow`} x="-30%" y="-40%" width="160%" height="190%">
          <feDropShadow dx="0" dy="8" stdDeviation="7" floodColor="#102b1c" floodOpacity="0.09" />
        </filter>
      </defs>
      <ellipse cx="160" cy="112" rx="148" ry="105" fill={`url(#${id}-halo)`} />
      <circle cx="160" cy="110" r="88" stroke="var(--primary)" strokeOpacity="0.09" />
      <path
        d="M37 97a124 124 0 0 1 226-56M280 142a124 124 0 0 1-212 51"
        stroke="var(--primary)"
        strokeOpacity="0.2"
        strokeDasharray="3 7"
        strokeLinecap="round"
      />

      <g className={styles.back}>
        <g transform="rotate(-6 152 107)" filter={`url(#${id}-shadow)`}>
          <rect
            x="51"
            y="43"
            width="205"
            height="128"
            rx="12"
            fill="var(--code)"
            stroke="var(--code-border)"
          />
          <path d="M51 74h205" stroke="var(--code-border)" />
          <path
            d="m66 54 5 5-5 5m11 0h7"
            stroke="var(--syn-string)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <g fill="var(--code-foreground)" opacity="0.25">
            <circle cx="232" cy="59" r="2" />
            <circle cx="239" cy="59" r="2" />
          </g>
          <g className="font-mono" fontSize="12" fontWeight="500">
            <text x="68" y="101" fill="var(--syn-keyword)">
              SELECT
            </text>
            <text x="122" y="101" fill="var(--code-foreground)">
              *
            </text>
            <text x="68" y="123" fill="var(--syn-keyword)">
              FROM
            </text>
          </g>
          <rect
            x="109"
            y="116"
            width="73"
            height="7"
            rx="3.5"
            fill="var(--syn-string)"
            opacity="0.5"
          />
          <path
            d="M188 114v12"
            stroke="var(--syn-string)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M68 147h27m8 0h44"
            stroke="var(--code-foreground)"
            strokeOpacity="0.15"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </g>
      </g>

      <g className={styles.front}>
        <g transform="rotate(7 229 158)" filter={`url(#${id}-shadow)`}>
          <rect
            x="184"
            y="128"
            width="99"
            height="69"
            rx="9"
            fill="var(--card)"
            stroke="var(--border)"
          />
          <rect
            x="195"
            y="140"
            width="77"
            height="12"
            rx="3"
            fill="var(--primary)"
            fillOpacity="0.12"
          />
          <path d="M195 164h77M195 177h77M220 140v46M246 140v46" stroke="var(--border)" />
        </g>
        <circle cx="264" cy="186" r="20" fill="var(--card)" stroke="var(--border)" />
        <circle cx="264" cy="186" r="15" fill="var(--primary)" fillOpacity="0.12" />
        <path d="m261 180 8 6-8 6v-12Z" fill="var(--primary)" />
      </g>

      <g className={styles.detail} stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round">
        <path d="M33 137v6m-3-3h6M282 81v8m-4-4h8" strokeOpacity="0.4" />
        <circle cx="69" cy="189" r="3" strokeOpacity="0.3" />
        <circle cx="212" cy="25" r="2" fill="var(--primary)" fillOpacity="0.3" stroke="none" />
      </g>
    </svg>
  )
}
