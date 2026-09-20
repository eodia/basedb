'use client'

import { ApiDocs } from '@/components/api-reference/api-docs'
import { NewTableDialog } from '@/components/app/new-table-dialog'
import { SchemaEditor } from '@/components/app/schema-editor'
import { TableDialogs } from '@/components/app/table-actions'
import { type Section, Sidebar } from '@/components/app/sidebar'
import { Workspace } from '@/components/app/workspace'
import { Login } from '@/components/login'
import { Button } from '@/components/ui/button'
import { TooltipProvider } from '@/components/ui/tooltip'
import { type ApiDocumentation, type Base, type DescribedBase, api } from '@/lib/api/client'
import { messageFor } from '@/lib/messages'
import { hydrateWorkspace, useActiveTab, useWorkspace } from '@/lib/store/workspace'
import { useTheme } from '@/lib/theme'
import { useTitle } from '@/lib/use-title'
import { Clock, Database, Layers, Plus, Shield } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

/**
 * The application — chapter 11.
 *
 * NO MOCKED OR HARD-CODED DATA: bases, tables, columns and rows all come from
 * `/meta/bases` and `/data/…`, hence from the catalog and from the reader's own rights.
 * Two people open this screen and see two different applications, and that is the rule
 * rather than an effect.
 *
 * Where the product has no backend yet — history, the permission editor — the control is
 * drawn in its place and DISABLED, with a word saying which chapter owns it. Filling
 * those with plausible data would make the screen lie about what the product does.
 */

/** What each section is called, in the tab strip as on screen. */
const SECTION_TITLES: Readonly<Record<Section, string | undefined>> = {
  data: undefined,
  structure: 'Structure',
  history: 'Historique',
  permissions: 'Permissions',
  doc: 'Documentation API',
}

// The demonstration base describes itself on purpose: its descriptions are what the
// generated documentation and the agents read, so they show what a well-described base
// looks like — the purpose, the format, the unit — rather than repeating the label.
const SAMPLE_BASE_DESCRIPTION =
  'Base de démonstration : des clients et les factures qui leur sont adressées. ' +
  'Elle sert à explorer les liens entre tables, la documentation générée et l’API.'

const SAMPLE_CLIENTS_DESCRIPTION =
  'Les entreprises et organisations à qui l’on facture. Une ligne par client, quel que ' +
  'soit le nombre de factures qui lui ont été adressées.'

const SAMPLE_INVOICES_DESCRIPTION =
  'Les factures émises, une ligne par facture. Chaque facture est adressée à un seul client ; ' +
  'un client peut en avoir plusieurs.'

const SAMPLE_FIELDS: ReadonlyArray<{
  label: string
  kind: string
  required?: boolean
  description: string
}> = [
  {
    label: 'Numéro',
    kind: 'short_text',
    required: true,
    description:
      'Référence de la facture telle qu’imprimée sur le document, par exemple F-2026-0042. ' +
      'Elle identifie la facture quand un autre enregistrement y renvoie.',
  },
  {
    label: 'Montant',
    kind: 'number',
    description: 'Montant total de la facture, en euros, taxes comprises.',
  },
  {
    label: 'Payée',
    kind: 'boolean',
    description:
      'Cochée dès que le règlement a été reçu en totalité ; décochée tant que la facture reste due.',
  },
  {
    label: "Date d'émission",
    kind: 'date',
    description: 'Jour où la facture a été émise au client, au format AAAA-MM-JJ.',
  },
]

export default function App() {
  const [me, setMe] = useState<{ email: string; displayName: string } | null>(null)
  const [checking, setChecking] = useState(true)
  const [online, setOnline] = useState<boolean | null>(null)

  const [bases, setBases] = useState<readonly Base[]>([])
  const [base, setBase] = useState<DescribedBase | null>(null)
  const [section, setSection] = useState<Section>('data')

  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [naming, setNaming] = useState(false)
  const [sidebar, setSidebar] = useState(true)

  const [doc, setDoc] = useState<ApiDocumentation | null>(null)

  const openTable = useWorkspace((s) => s.openTable)
  const dropBase = useWorkspace((s) => s.dropBase)
  const tabs = useWorkspace((s) => s.tabs)
  const activeTab = useActiveTab()

  // Declared before the early returns below, because a hook may not be conditional —
  // and because the title of a screen that is still checking the session is simply the
  // product's, which is what the empty segments produce.
  useTitle([section === 'data' ? activeTab?.label : SECTION_TITLES[section], base?.label])

  // The theme and the open tabs are restored AFTER mount: both live in `localStorage`,
  // which does not exist where Next.js renders this tree first, and seeding them at
  // module scope would make the first client render disagree with the server's.
  useEffect(() => {
    hydrateWorkspace()
    return useTheme.getState().initialize()
  }, [])

  /** Resumes a session from the cookie alone: the access token lived in memory. */
  const resume = useCallback(async () => {
    try {
      await api.health()
    } catch {
      setOnline(false)
      setChecking(false)
      return
    }
    setOnline(true)
    setMe(await api.resume())
    setChecking(false)
  }, [])

  useEffect(() => {
    void resume()
  }, [resume])

  const openBase = useCallback(
    async (name: string) => {
      setError(null)
      setSection('data')
      try {
        const described = await api.describeBase(name)
        setBase(described)
        setDoc(await api.documentation(name))
        // A tab is opened only when this base has none: reopening a base one already has
        // tabs on must restore what was open, not add a duplicate of its first table.
        const already = useWorkspace.getState().tabs.some((t) => t.base === described.name)
        const first = described.tables[0]
        if (!already && first !== undefined) openTable(first, first.label)
      } catch (e) {
        setError(messageFor(e))
      }
    },
    [openTable],
  )

  const loadBases = useCallback(async () => {
    if (me === null) return
    try {
      const found = await api.bases()
      setBases(found)
      // The first base opens by itself: arriving on a chooser when there is one thing to
      // choose is a click asked for nothing.
      if (found.length > 0 && base === null) await openBase(found[0].name)
    } catch (e) {
      setError(messageFor(e))
    }
  }, [me, base, openBase])

  useEffect(() => {
    void loadBases()
  }, [loadBases])

  /**
   * Rereads the generated documentation without waiting for it.
   *
   * It is built from the same catalog as the description of the base, so it goes stale
   * with it — and a description is the very thing it exists to show, which makes a stale
   * page the first place someone would notice an edit that "did not take".
   */
  const refreshDoc = useCallback((name: string) => {
    void api.documentation(name).then(setDoc, () => undefined)
  }, [])

  /** Rereads the open base — a rename, a description, a restore, a table added. */
  const refreshBase = useCallback(async () => {
    setBases(await api.bases().catch(() => bases))
    if (base === null) return
    try {
      setBase(await api.describeBase(base.name))
      refreshDoc(base.name)
    } catch {
      // The base is no longer visible: fall back to whatever else there is.
      setBase(null)
    }
  }, [base, bases, refreshDoc])

  /**
   * A new table IN THE OPEN BASE — which is what the button says, and what it had
   * stopped doing: it shared its handler with `createSample`, so asking for a table
   * created a whole demonstration base beside the one being read.
   */
  const createTable = useCallback(
    async (label: string, description?: string) => {
      if (base === null) return
      setCreating(true)
      setError(null)
      try {
        const created = await api.createTableIn(base.name, label, description)
        // The description is read back rather than patched: the catalog decides the
        // table's name, its system columns and the order it appears in.
        const refreshed = await api.describeBase(base.name)
        setBase(refreshed)
        refreshDoc(base.name)
        const opened = refreshed.tables.find((t) => t.name === created.name)
        if (opened !== undefined) openTable(opened, opened.label)
      } catch (e) {
        setError(messageFor(e))
      } finally {
        setCreating(false)
      }
    },
    [base, openTable, refreshDoc],
  )

  const createSample = useCallback(async () => {
    setCreating(true)
    setError(null)
    try {
      const created = await api.createBase(
        `Démo ${new Date().toISOString().slice(11, 19)}`,
        SAMPLE_BASE_DESCRIPTION,
      )
      const clients = await api.createTable(
        created.name,
        'Clients',
        [
          {
            label: 'Raison sociale',
            kind: 'short_text',
            required: true,
            description:
              'Nom légal du client, tel qu’il figure sur ses factures. C’est aussi ce qui le ' +
              'désigne quand une facture renvoie vers lui.',
          },
          {
            label: 'Ville',
            kind: 'short_text',
            description: 'Ville du siège ou de l’établissement facturé, en texte libre.',
          },
        ],
        SAMPLE_CLIENTS_DESCRIPTION,
      )
      const invoices = await api.createTable(
        created.name,
        'Factures',
        SAMPLE_FIELDS,
        SAMPLE_INVOICES_DESCRIPTION,
      )
      await api.createLink(
        { base: created.name, name: invoices.name },
        'Client',
        clients.name,
        'Client à qui la facture est adressée. Une facture vise un seul client ; ' +
          'un client peut recevoir plusieurs factures.',
      )

      // Both tables get a display column: without one on `factures`, the inverse links
      // shown on a client would read as truncated UUIDs — correct, and useless.
      for (const [table, column] of [
        [clients, 'raison_sociale'],
        [invoices, 'numero'],
      ] as const) {
        const display = table.fields.find((f) => f.name === column)
        if (display?.id !== undefined) {
          await api.setDisplayColumn({ base: created.name, name: table.name }, display.id)
        }
      }
      for (const name of ['Dupont SARL', 'ACME', 'École du Nord']) {
        await api.createRecord({ base: created.name, name: clients.name }, { raison_sociale: name })
      }

      setBases(await api.bases())
      await openBase(created.name)
    } catch (e) {
      setError(messageFor(e))
    } finally {
      setCreating(false)
    }
  }, [openBase])

  // Nothing is shown before we know whether a session is open: a flash of the login
  // screen for someone already connected reads as having been signed out.
  if (checking) return <div className="min-h-screen bg-background" />

  if (online === false) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm">
          <h1 className="mb-2 text-base font-semibold">L’API ne répond pas</h1>
          <p className="text-muted-foreground">
            Démarrez-la, puis rechargez — rien n’est affiché de mémoire.
          </p>
        </div>
      </main>
    )
  }

  if (me === null) return <Login onSignedIn={() => void resume()} />

  const hasTabs = tabs.some((t) => t.base === base?.name)

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-screen overflow-hidden bg-background">
        {sidebar && (
          <Sidebar
            bases={bases}
            base={base}
            user={me}
            section={section}
            busy={creating}
            onOpenBase={(name) => void openBase(name)}
            onNewBase={() => void createSample()}
            onNewTable={() => setNaming(true)}
            onSection={setSection}
            onBasesChanged={() => void refreshBase()}
            onBaseDeleted={(name) => {
              dropBase(name)
              setBase(null)
              void loadBases()
            }}
            onSignedOut={() => {
              setMe(null)
              setBase(null)
              useWorkspace.getState().closeAll()
            }}
          />
        )}

        {base === null ? (
          <Empty
            hasBase={false}
            onCreate={() => void createSample()}
            busy={creating}
            onToggle={() => setSidebar((s) => !s)}
          />
        ) : section === 'data' ? (
          base.tables.length === 0 && !hasTabs ? (
            <Empty
              hasBase
              onCreate={() => setNaming(true)}
              busy={creating}
              onToggle={() => setSidebar((s) => !s)}
            />
          ) : (
            <Workspace
              base={base}
              tables={base.tables}
              onToggleSidebar={() => setSidebar((s) => !s)}
              onOpenDoc={() => setSection('doc')}
            />
          )
        ) : (
          <SectionPanel
            section={section}
            base={base}
            doc={doc}
            onBack={() => setSection('data')}
            onToggle={() => setSidebar((s) => !s)}
            onChanged={refreshBase}
          />
        )}

        {base !== null && (
          <NewTableDialog
            open={naming}
            base={base}
            busy={creating}
            onClose={() => setNaming(false)}
            onSubmit={async (label, description) => {
              await createTable(label, description)
              setNaming(false)
            }}
          />
        )}

        {error !== null && (
          <div className="pointer-events-none fixed inset-x-0 bottom-4 flex justify-center">
            <div className="pointer-events-auto flex max-w-lg items-start gap-3 rounded-lg border border-destructive/30 bg-background px-3 py-2 text-sm text-destructive shadow-lg">
              <span className="flex-1">{error}</span>
              <button
                type="button"
                onClick={() => setError(null)}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Fermer"
              >
                ×
              </button>
            </div>
          </div>
        )}
      </div>

      <TableDialogs base={base} onBaseChanged={refreshBase} />
    </TooltipProvider>
  )
}

/** No base, or no readable table: the one screen that offers a way forward. */
function Empty({
  hasBase,
  onCreate,
  busy,
  onToggle,
}: {
  readonly hasBase: boolean
  readonly onCreate: () => void
  readonly busy: boolean
  readonly onToggle: () => void
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="flex h-12 shrink-0 items-center border-b px-3">
        <Button variant="ghost" size="icon-sm" onClick={onToggle} aria-label="Replier le panneau">
          <Layers className="size-4" />
        </Button>
      </header>
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="max-w-md text-center">
          <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-muted">
            <Database className="size-6 text-muted-foreground" />
          </span>
          <h1 className="text-lg font-semibold">
            {hasBase ? 'Aucune table lisible' : 'Aucune base visible'}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {hasBase
              ? 'Cette base existe, mais ne contient encore aucune table que vous puissiez lire. Créez-en une : elle est lisible en SQL dès la seconde suivante.'
              : 'Créez-en une : un schéma PostgreSQL, deux tables et une vraie clé étrangère entre elles sont créés pour de vrai. Elles sont lisibles en SQL dès la seconde suivante.'}
          </p>
          <Button className="mt-5" onClick={onCreate} disabled={busy}>
            <Plus className="size-4" />
            {busy ? 'Création…' : hasBase ? 'Créer une table' : 'Créer une base et une table'}
          </Button>
        </div>
      </div>
    </div>
  )
}

/** The sections whose backend is not written, and the ones that are. */
function SectionPanel({
  section,
  base,
  doc,
  onBack,
  onToggle,
  onChanged,
}: {
  readonly section: Section
  readonly base: DescribedBase
  readonly doc: ApiDocumentation | null
  readonly onBack: () => void
  readonly onToggle: () => void
  readonly onChanged: () => Promise<void>
}) {
  const pending: Partial<Record<Section, { icon: typeof Layers; title: string; body: string }>> = {
    history: {
      icon: Clock,
      title: 'Historique',
      body:
        'Qui a changé quoi, et quand. Le chapitre 07 le spécifie en entier — capture, ' +
        'journal de suppression, rétention — et rien n’en est encore écrit.',
    },
    permissions: {
      icon: Shield,
      title: 'Permissions',
      body:
        'Le moteur de décision existe et gouverne déjà chaque requête de cet écran : rôles, ' +
        'portées, champs masqués. Ce qui manque est l’éditeur qui laisse les régler sans SQL ' +
        '(chapitre 11 §7).',
    },
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b px-3">
        <Button variant="ghost" size="icon-sm" onClick={onToggle} aria-label="Replier le panneau">
          <Layers className="size-4" />
        </Button>
        <span className="text-sm text-muted-foreground">{base.label}</span>
        <span className="text-sm text-muted-foreground">/</span>
        <span className="text-sm font-medium">
          {section === 'doc'
            ? 'Documentation API'
            : section === 'structure'
              ? 'Structure'
              : (pending[section]?.title ?? '')}
        </span>
        <div className="flex-1" />
        <Button variant="ghost" size="sm" onClick={onBack}>
          Retour aux données
        </Button>
      </header>

      {/* The documentation lays out its own columns and scrolls each of them: it gets the whole
          area, where every other section sits in one padded column that scrolls as a piece. */}
      <div
        className={
          section === 'doc'
            ? 'flex min-h-0 flex-1 flex-col'
            : 'min-h-0 flex-1 overflow-y-auto scroll-discret px-6 py-6'
        }
      >
        {section === 'structure' ? (
          <SchemaEditor base={base} onChanged={onChanged} />
        ) : section === 'doc' ? (
          <ApiDocs base={base} doc={doc} />
        ) : (
          <div className="mx-auto max-w-lg pt-16 text-center">
            {(() => {
              const entry = pending[section]
              if (entry === undefined) return null
              const Icon = entry.icon
              return (
                <>
                  <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-muted">
                    <Icon className="size-6 text-muted-foreground" />
                  </span>
                  <h1 className="text-lg font-semibold">{entry.title}</h1>
                  <p className="mt-2 text-sm text-muted-foreground">{entry.body}</p>
                </>
              )
            })()}
          </div>
        )}
      </div>
    </div>
  )
}
