'use client'

import { Brand } from '@/components/brand'
import { ArrowUpRight, KeyRound, Link2, Pause, Play, Table2 } from 'lucide-react'
import { useState } from 'react'
import styles from './login.module.css'

export function LoginBrand({ tone = 'dark' }: { readonly tone?: 'dark' | 'light' }) {
  return <Brand size={36} tone={tone} className={styles.brand} />
}

/** An illustrative schema, never a preview of the visitor's private data. */
export function LoginVisual() {
  const [paused, setPaused] = useState(false)

  return (
    <aside className={styles.visual} data-paused={paused} aria-label="Découvrir basedb">
      <div className={styles.grid} aria-hidden="true" />
      <div className={styles.glow} aria-hidden="true" />
      <LoginBrand tone="light" />

      <div className={styles.visualContent}>
        <div className={styles.editorial}>
          <p className={styles.eyebrow}>
            <span /> UN PEU D’ORDRE. BEAUCOUP DE POSSIBILITÉS.
          </p>
          <h2>
            Vos données,
            <br />
            <span>à leur place.</span>
          </h2>
          <p className={styles.description}>
            Reliez vos idées. Structurez vos projets.
            <br />
            Construisez la suite, sur des bases solides.
          </p>
        </div>

        <div className={styles.diagram} aria-hidden="true">
          <svg className={styles.connections} viewBox="0 0 560 310" fill="none" aria-hidden="true">
            <path className={styles.connection} d="M164 110H114Q98 110 98 126V203" />
            <path className={styles.connection} d="M374 131H451Q467 131 467 147V192" />
            <path className={styles.flow} d="M164 110H114Q98 110 98 126V203" />
            <path className={styles.flow} d="M374 131H451Q467 131 467 147V192" />
            <circle cx="164" cy="110" r="4" />
            <circle cx="98" cy="203" r="4" />
            <circle cx="374" cy="131" r="4" />
            <circle cx="467" cy="192" r="4" />
          </svg>

          <div className={`${styles.schemaCard} ${styles.projects}`}>
            <div className={styles.cardTitle}>
              <span className={styles.tableIcon}>
                <Table2 size={15} />
              </span>
              projets
              <span className={styles.cardMenu}>···</span>
            </div>
            <div className={styles.schemaRow}>
              <KeyRound size={12} />
              <span>id</span>
              <code>uuid</code>
            </div>
            <div className={styles.schemaRow}>
              <span className={styles.fieldType}>Aa</span>
              <span>nom</span>
              <code>texte</code>
            </div>
            <div className={`${styles.schemaRow} ${styles.linkedRow}`}>
              <Link2 size={12} />
              <span>équipe</span>
              <ArrowUpRight size={12} />
            </div>
          </div>

          <div className={`${styles.schemaCard} ${styles.team}`}>
            <div className={styles.cardTitle}>
              <span className={styles.tableIcon}>
                <Table2 size={15} />
              </span>
              équipe
              <span className={styles.cardMenu}>···</span>
            </div>
            <div className={styles.schemaRow}>
              <KeyRound size={12} />
              <span>id</span>
              <code>uuid</code>
            </div>
            <div className={styles.schemaRow}>
              <span className={styles.fieldType}>Aa</span>
              <span>nom</span>
              <code>texte</code>
            </div>
          </div>

          <div className={`${styles.schemaCard} ${styles.tasks}`}>
            <div className={styles.cardTitle}>
              <span className={styles.tableIcon}>
                <Table2 size={15} />
              </span>
              tâches
              <span className={styles.cardMenu}>···</span>
            </div>
            <div className={styles.schemaRow}>
              <KeyRound size={12} />
              <span>id</span>
              <code>uuid</code>
            </div>
            <div className={`${styles.schemaRow} ${styles.linkedRow}`}>
              <Link2 size={12} />
              <span>projet</span>
              <ArrowUpRight size={12} />
            </div>
          </div>
          <span className={styles.diagramCaption}>DES LIENS QUI FONT SENS</span>
        </div>
      </div>

      <footer className={styles.visualFooter}>
        <div className={styles.features}>
          <span>PostgreSQL natif</span>
          <span>Open source</span>
          <span>API & MCP</span>
        </div>
        <button
          type="button"
          className={styles.motionToggle}
          onClick={() => setPaused((value) => !value)}
          aria-label={paused ? 'Reprendre les animations' : 'Mettre les animations en pause'}
          title={paused ? 'Reprendre les animations' : 'Mettre les animations en pause'}
        >
          {paused ? <Play size={13} aria-hidden="true" /> : <Pause size={13} aria-hidden="true" />}
        </button>
      </footer>
    </aside>
  )
}
