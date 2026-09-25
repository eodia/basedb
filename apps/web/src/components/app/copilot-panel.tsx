'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { type Field, type Table, api } from '@/lib/api/client'
import { messageFor } from '@/lib/messages'
import { cn } from '@/lib/utils'
import { ArrowRight, CornerDownLeft, Loader2, Shield, Sparkles, Table2, X } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'

/**
 * The copilot — chapter 12 §1.2, and nothing beyond it.
 *
 * It does two things: draft a FILTER in the closed grammar, and draft a STRUCTURE of
 * tables and fields. It does not answer questions about the data, does not summarise a
 * column, does not fill a cell, and there is no text box here that would let it. Those
 * are out of scope by decision (§1.4), not by omission: they would violate INV-IA2 and
 * turn every write into a billed call. Conversation about data belongs to the MCP
 * server, with the user's own agent, keys and budget.
 *
 * Every answer is a DRAFT. It lands in the editor, goes through the ordinary validator,
 * and is saved only by an explicit act — §1.3: "l'IA y remplace une lecture de
 * documentation, pas un jugement métier".
 */

interface Props {
  readonly base: string
  readonly table: Table | null
  readonly fields: readonly Field[]
  readonly onClose: () => void
  /** Puts a drafted expression into the editor. Never runs it. */
  readonly onUseExpression: (filter: string, sort: string | null) => void
  /** The refusal the kernel returned for the last run, fed back on a retry (§5.1). */
  readonly lastError?: string | null
}

type Mode = 'expression' | 'structure'

interface StructureDraft {
  readonly tables: ReadonlyArray<{
    readonly label: string
    readonly fields: ReadonlyArray<{
      readonly label: string
      readonly kind: string
      readonly required: boolean
      readonly target: string | null
    }>
  }>
  readonly explanation: string
}

export function CopilotPanel({ base, table, fields, onClose, onUseExpression, lastError }: Props) {
  const [mode, setMode] = useState<Mode>('expression')
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expression, setExpression] = useState<{
    filter: string
    sort: string | null
    explanation: string
  } | null>(null)
  const [structure, setStructure] = useState<StructureDraft | null>(null)
  const input = useRef<HTMLTextAreaElement>(null)

  const submit = useCallback(async () => {
    const asked = prompt.trim()
    if (asked === '' || busy) return
    setBusy(true)
    setError(null)
    try {
      if (mode === 'expression') {
        if (table === null) {
          setError('Ouvrez d’abord une table.')
          return
        }
        setStructure(null)
        setExpression(await api.draftExpression(base, table.name, asked, lastError ?? undefined))
      } else {
        setExpression(null)
        setStructure(await api.draftStructure(base, asked))
      }
    } catch (e) {
      setError(messageFor(e))
    } finally {
      setBusy(false)
    }
  }, [prompt, busy, mode, table, base, lastError])

  return (
    <aside className="flex w-96 shrink-0 flex-col border-l bg-sidebar">
      <header className="flex h-11 shrink-0 items-center gap-2 border-b px-3">
        <Sparkles className="size-4 text-primary" />
        <span className="flex-1 text-sm font-medium">Copilot</span>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Fermer le copilot">
          <X className="size-4" />
        </Button>
      </header>

      <div className="border-b px-3 py-2">
        <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
          <TabsList className="w-full">
            <TabsTrigger value="expression" className="flex-1">
              Expression
            </TabsTrigger>
            <TabsTrigger value="structure" className="flex-1">
              Structure
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto scroll-discret p-3">
        {/* What leaves the instance, said plainly and before anything is sent. Chapter 12
            §5.4 requires it be told; saying it once the call is made would be telling
            someone what they already gave away. */}
        <div className="flex gap-2 rounded-lg border bg-muted/40 p-2.5 text-xs text-muted-foreground">
          <Shield className="mt-0.5 size-3.5 shrink-0" />
          <p>Seuls votre demande et les noms des champs sont envoyés, jamais les données.</p>
        </div>

        {mode === 'expression' && table === null && (
          <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
            Ouvrez une table pour rédiger un filtre.
          </p>
        )}

        {mode === 'expression' && table !== null && (
          <p className="px-0.5 text-xs text-muted-foreground">
            Sur <span className="font-medium text-foreground">{table.label}</span> — {fields.length}{' '}
            champ{fields.length > 1 ? 's' : ''} lisible
            {fields.length > 1 ? 's' : ''}.
          </p>
        )}

        {error !== null && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive">
            {error}
          </p>
        )}

        {expression !== null && (
          <div className="space-y-2 rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">{expression.explanation}</p>
            {expression.filter === '' ? (
              <p className="text-xs italic text-muted-foreground">
                Aucun filtre ne correspond à cette demande.
              </p>
            ) : (
              <>
                <pre className="overflow-x-auto rounded-md bg-muted/60 p-2 font-mono text-[11px] leading-relaxed">
                  {expression.filter}
                </pre>
                {expression.sort !== null && (
                  <p className="font-mono text-[11px] text-muted-foreground">
                    tri : {expression.sort}
                  </p>
                )}
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => onUseExpression(expression.filter, expression.sort)}
                >
                  <ArrowRight className="size-3.5" />
                  Mettre dans l’éditeur
                </Button>
              </>
            )}
          </div>
        )}

        {structure !== null && (
          <div className="space-y-3">
            <p className="px-0.5 text-xs text-muted-foreground">{structure.explanation}</p>
            {structure.tables.map((drafted) => (
              <div key={drafted.label} className="rounded-lg border p-3">
                <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                  <Table2 className="size-3.5 text-muted-foreground" />
                  {drafted.label}
                </p>
                <ul className="space-y-1">
                  {drafted.fields.map((field) => (
                    <li
                      key={field.label}
                      className="flex items-center gap-2 text-xs text-muted-foreground"
                    >
                      <span className="min-w-0 flex-1 truncate text-foreground">{field.label}</span>
                      <Badge variant="secondary" className="font-mono text-[10px] font-normal">
                        {field.kind}
                      </Badge>
                      {field.target !== null && (
                        <span className="truncate text-[10px]">→ {field.target}</span>
                      )}
                      {field.required && <span className="text-[10px]">obligatoire</span>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <p className="px-0.5 text-[10px] text-muted-foreground">
              Proposition seulement : rien n’est créé.
            </p>
          </div>
        )}
      </div>

      <div className="shrink-0 border-t p-3">
        <Textarea
          ref={input}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends, Maj+Entrée goes to the next line — the convention of every
            // chat box, and the one people's fingers already know.
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void submit()
            }
          }}
          rows={3}
          placeholder={
            mode === 'expression'
              ? 'les factures de plus de 1 000 € non payées cette année'
              : 'ajouter le suivi des relances de paiement'
          }
          className="resize-none text-sm"
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">
            <CornerDownLeft className="mr-1 inline size-3" />
            pour envoyer
          </span>
          <Button
            size="sm"
            onClick={() => void submit()}
            disabled={busy || prompt.trim() === ''}
            className={cn(busy && 'opacity-80')}
          >
            {busy ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Sparkles className="size-3.5" />
            )}
            {busy ? 'Rédaction…' : 'Proposer'}
          </Button>
        </div>
      </div>
    </aside>
  )
}
