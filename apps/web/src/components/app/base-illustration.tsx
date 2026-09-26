import { useId } from 'react'
import styles from './workspace-illustration.module.css'

/** A database ready to hold its first tables, without suggesting existing records. */
export function BaseIllustration() {
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
        <g transform="rotate(9 274 122)" filter={`url(#${id}-shadow)`}>
          <rect
            x="224"
            y="67"
            width="112"
            height="125"
            rx="10"
            fill="var(--card)"
            stroke="var(--border)"
          />
          <rect
            x="237"
            y="81"
            width="22"
            height="22"
            rx="6"
            fill="var(--primary)"
            fillOpacity="0.12"
          />
          <path
            d="M243 87h10v10h-10zM243 91h10M247 91v6"
            stroke="var(--primary)"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
          <rect
            x="268"
            y="85"
            width="43"
            height="5"
            rx="2.5"
            fill="var(--foreground)"
            fillOpacity="0.25"
          />
          <rect
            x="268"
            y="95"
            width="27"
            height="4"
            rx="2"
            fill="var(--muted-foreground)"
            fillOpacity="0.2"
          />
          <rect x="237" y="116" width="86" height="14" rx="3" fill="var(--muted)" />
          <path d="M237 141h86M237 159h86M260 116v62M294 116v62" stroke="var(--border)" />
          <rect
            x="267"
            y="149"
            width="18"
            height="4"
            rx="2"
            fill="var(--primary)"
            fillOpacity="0.25"
          />
        </g>

        <g transform="rotate(-7 164 148)" filter={`url(#${id}-shadow)`}>
          <path
            d="M93 86v112c0 13.3 31.8 24 71 24s71-10.7 71-24V86"
            fill="var(--card)"
            stroke="var(--border)"
          />
          <path
            d="M93 123c0 13.3 31.8 24 71 24s71-10.7 71-24v37c0 13.3-31.8 24-71 24s-71-10.7-71-24v-37Z"
            fill="var(--primary)"
            fillOpacity="0.06"
          />
          <path
            d="M93 123c0 13.3 31.8 24 71 24s71-10.7 71-24M93 160c0 13.3 31.8 24 71 24s71-10.7 71-24"
            stroke="var(--border)"
          />
          <ellipse cx="164" cy="86" rx="71" ry="24" fill="var(--card)" stroke="var(--border)" />
          <ellipse cx="164" cy="86" rx="71" ry="24" fill="var(--primary)" fillOpacity="0.09" />
          <ellipse cx="164" cy="86" rx="45" ry="12" stroke="var(--primary)" strokeOpacity="0.16" />
          <path
            d="M106 83c6-8 28-14 52-14"
            stroke="var(--card)"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <g fill="var(--primary)" fillOpacity="0.5">
            <circle cx="111" cy="116" r="2.5" />
            <circle cx="111" cy="153" r="2.5" />
            <circle cx="111" cy="190" r="2.5" />
          </g>
          <g
            stroke="var(--muted-foreground)"
            strokeOpacity="0.22"
            strokeWidth="3"
            strokeLinecap="round"
          >
            <path d="m123 119 14 3M123 156l14 3M123 193l14 3" />
          </g>
        </g>
      </g>

      <g className={styles.front}>
        <g transform="rotate(6 276 199)" filter={`url(#${id}-shadow)`}>
          <rect
            x="207"
            y="160"
            width="142"
            height="80"
            rx="11"
            fill="var(--card)"
            stroke="var(--border)"
          />
          <rect
            x="207"
            y="160"
            width="142"
            height="80"
            rx="11"
            fill="var(--primary)"
            fillOpacity="0.04"
          />
          <rect
            x="220"
            y="174"
            width="23"
            height="23"
            rx="6"
            fill="var(--primary)"
            fillOpacity="0.14"
          />
          <path
            d="M225 180h13v11h-13zM225 184h13M230 184v7"
            stroke="var(--primary)"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
          <rect
            x="254"
            y="179"
            width="61"
            height="5"
            rx="2.5"
            fill="var(--foreground)"
            fillOpacity="0.28"
          />
          <rect
            x="254"
            y="189"
            width="37"
            height="4"
            rx="2"
            fill="var(--muted-foreground)"
            fillOpacity="0.2"
          />
          <path d="M220 207h114" stroke="var(--border)" />
          <rect
            x="220"
            y="219"
            width="27"
            height="4"
            rx="2"
            fill="var(--muted-foreground)"
            fillOpacity="0.22"
          />
          <rect
            x="255"
            y="219"
            width="33"
            height="4"
            rx="2"
            fill="var(--muted-foreground)"
            fillOpacity="0.15"
          />
        </g>
        <circle cx="333" cy="229" r="22" fill="var(--card)" stroke="var(--border)" />
        <circle cx="333" cy="229" r="17" fill="var(--primary)" fillOpacity="0.12" />
        <path
          d="M326 229h14m-7-7v14"
          stroke="var(--primary)"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </g>

      <g className={styles.detail} stroke="var(--primary)" strokeLinecap="round" strokeWidth="1.5">
        <path d="M61 97v6m-3-3h6M349 110v8m-4-4h8" strokeOpacity="0.4" />
        <circle cx="83" cy="221" r="3" strokeOpacity="0.3" />
        <circle cx="275" cy="35" r="2" fill="var(--primary)" fillOpacity="0.3" stroke="none" />
      </g>
    </svg>
  )
}
