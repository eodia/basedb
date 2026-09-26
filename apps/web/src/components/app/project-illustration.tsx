import { useId } from 'react'
import styles from './workspace-illustration.module.css'

/** An open project folder and its future bases; purely decorative. */
export function ProjectIllustration() {
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
        <g transform="rotate(-5 199 155)" filter={`url(#${id}-shadow)`}>
          <path
            d="M85 104V84a12 12 0 0 1 12-12h54a12 12 0 0 1 8 3l19 17h118a12 12 0 0 1 12 12v109H85V104Z"
            fill="var(--card)"
            stroke="var(--border)"
          />
          <path
            d="M85 104V84a12 12 0 0 1 12-12h54a12 12 0 0 1 8 3l19 17h118a12 12 0 0 1 12 12v109H85V104Z"
            fill="var(--primary)"
            fillOpacity="0.1"
          />
          <path
            d="M103 86h38"
            stroke="var(--primary)"
            strokeOpacity="0.35"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </g>
      </g>

      <g className={styles.detail}>
        <g transform="rotate(-12 166 128)" filter={`url(#${id}-shadow)`}>
          <rect
            x="109"
            y="71"
            width="112"
            height="128"
            rx="10"
            fill="var(--card)"
            stroke="var(--border)"
          />
          <rect
            x="122"
            y="85"
            width="25"
            height="25"
            rx="7"
            fill="var(--primary)"
            fillOpacity="0.12"
          />
          <path
            d="M129 92h11v10h-11zM129 96h11M133 96v6"
            stroke="var(--primary)"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
          <rect
            x="155"
            y="91"
            width="43"
            height="5"
            rx="2.5"
            fill="var(--foreground)"
            fillOpacity="0.25"
          />
          <rect
            x="155"
            y="101"
            width="29"
            height="4"
            rx="2"
            fill="var(--muted-foreground)"
            fillOpacity="0.2"
          />
          <path
            d="M122 123h86M122 142h86M122 161h86M147 123v55M179 123v55"
            stroke="var(--border)"
          />
          <rect
            x="155"
            y="131"
            width="17"
            height="4"
            rx="2"
            fill="var(--primary)"
            fillOpacity="0.25"
          />
        </g>

        <g transform="rotate(9 249 121)" filter={`url(#${id}-shadow)`}>
          <rect
            x="194"
            y="63"
            width="110"
            height="130"
            rx="10"
            fill="var(--card)"
            stroke="var(--border)"
          />
          <rect
            x="207"
            y="77"
            width="25"
            height="25"
            rx="7"
            fill="var(--primary)"
            fillOpacity="0.12"
          />
          <path
            d="M213 84h13v12h-13zM217 84v12M222 84v12"
            stroke="var(--primary)"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
          <rect
            x="241"
            y="83"
            width="44"
            height="5"
            rx="2.5"
            fill="var(--foreground)"
            fillOpacity="0.25"
          />
          <rect
            x="241"
            y="93"
            width="30"
            height="4"
            rx="2"
            fill="var(--muted-foreground)"
            fillOpacity="0.2"
          />
          <rect x="207" y="115" width="23" height="44" rx="4" fill="var(--muted)" />
          <rect
            x="235"
            y="115"
            width="23"
            height="30"
            rx="4"
            fill="var(--primary)"
            fillOpacity="0.12"
          />
          <rect x="263" y="115" width="23" height="53" rx="4" fill="var(--muted)" />
        </g>
      </g>

      <g className={styles.front}>
        <g transform="rotate(-5 202 190)" filter={`url(#${id}-shadow)`}>
          <path
            d="M88 136h215a12 12 0 0 1 12 14l-11 66a13 13 0 0 1-13 11H104a13 13 0 0 1-13-11l-11-66a12 12 0 0 1 8-14Z"
            fill="var(--card)"
            stroke="var(--border)"
          />
          <path
            d="M88 136h215a12 12 0 0 1 12 14l-11 66a13 13 0 0 1-13 11H104a13 13 0 0 1-13-11l-11-66a12 12 0 0 1 8-14Z"
            fill="var(--primary)"
            fillOpacity="0.06"
          />
          <path
            d="M99 147h196"
            stroke="var(--primary)"
            strokeOpacity="0.13"
            strokeLinecap="round"
          />
          <rect
            x="107"
            y="169"
            width="28"
            height="28"
            rx="8"
            fill="var(--primary)"
            fillOpacity="0.12"
          />
          <path
            d="M114 178h5l2 2h7v10h-14v-12Z"
            stroke="var(--primary)"
            strokeWidth="1.4"
            strokeLinejoin="round"
            transform="translate(0 -3)"
          />
          <rect
            x="147"
            y="176"
            width="71"
            height="5"
            rx="2.5"
            fill="var(--foreground)"
            fillOpacity="0.28"
          />
          <rect
            x="147"
            y="188"
            width="46"
            height="4"
            rx="2"
            fill="var(--muted-foreground)"
            fillOpacity="0.2"
          />
        </g>
        <circle cx="311" cy="218" r="24" fill="var(--card)" stroke="var(--border)" />
        <circle cx="311" cy="218" r="19" fill="var(--primary)" fillOpacity="0.12" />
        <path
          d="M303 218h16m-8-8v16"
          stroke="var(--primary)"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </g>

      <g className={styles.detail} stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round">
        <path d="M57 110v6m-3-3h6M344 82v8m-4-4h8" strokeOpacity="0.4" />
        <circle cx="77" cy="209" r="3" strokeOpacity="0.3" />
        <circle cx="275" cy="35" r="2" fill="var(--primary)" fillOpacity="0.3" stroke="none" />
      </g>
    </svg>
  )
}
