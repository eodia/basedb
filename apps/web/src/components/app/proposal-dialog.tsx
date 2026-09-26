'use client'

import { KIND_LABELS } from '@/components/app/field-icon'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { type Proposal, type ProposalTable, type UserData, api } from '@/lib/api/client'
import { messageFor, sentenceFor } from '@/lib/messages'
import { cn } from '@/lib/utils'
import { Bot, Check, ChevronDown, Loader2, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

/**
 * The « Propositions » queue of a base — chapter 09 §7: what agents proposed to change in
 * its structure, for a person to approve or refuse. Nothing an agent proposes is applied
 * without this screen.
 *
 * The screen is BUILT BY THE SYSTEM, not by the proposer (§7.7). The kernel sends a closed
 * template and typed parameters, never a sentence; the sentence is assembled here, and
 * everything a person or an agent typed — a label, a description, a choice — is shown as
 * DATA: set apart, truncated, never interpreted. The physical name, which the naming
 * rules confine to a plain alphabet, is the identity one reads first. And the origin says
 * plainly that the request comes from an agent, through a token — not from a colleague.
 */

const TIME = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' })

const STATUS: Readonly<Record<Proposal['status'], { label: string; tone: string }>> = {
  proposed: { label: 'En attente', tone: 'border-amber-500/40 text-amber-700 dark:text-amber-400' },
  approved: { label: 'En cours', tone: 'border-sky-500/40 text-sky-700 dark:text-sky-400' },
  applied: {
    label: 'Appliquée',
    tone: 'border-emerald-500/40 text-emerald-700 dark:text-emerald-400',
  },
  rejected: { label: 'Refusée', tone: 'text-muted-foreground' },
  expired: { label: 'Expirée', tone: 'text-muted-foreground' },
  superseded: { label: 'Remplacée', tone: 'text-muted-foreground' },
  failed: { label: 'Échec', tone: 'border-destructive/40 text-destructive' },
}

const ROLE: Readonly<Record<string, string>> = {
  created: 'créée',
  modified: 'modifiée',
  referenced: 'référencée',
}

const DATA_MAX = 120

/** A value someone typed: quoted, set apart, cut — and never read as markup or as text. */
function Data({ value, className }: { readonly value: unknown; readonly className?: string }) {
  const text = value === null || value === undefined ? '' : String(value)
  const cut = [...text].length > DATA_MAX ? `${[...text].slice(0, DATA_MAX).join('')}…` : text
  return (
    <span
      title={text}
      className={cn(
        'rounded bg-muted px-1 py-0.5 font-normal text-foreground/90 [overflow-wrap:anywhere]',
        className,
      )}
    >
      « {cut} »
    </span>
  )
}

/** A table: its physical name first — the identity —, its label beside it, as data. */
function TableName({ table }: { readonly table: ProposalTable | undefined }) {
  if (table === undefined) return null
  return (
    <>
      <code className="font-mono text-[0.85em]">{table.physical}</code>{' '}
      <Data value={table.label} className="text-xs" />
    </>
  )
}

const kindOf = (kind: UserData | undefined) =>
  KIND_LABELS[String(kind?.value ?? '')] ?? String(kind?.value ?? '')

/** The sentence of a proposal, assembled here from its closed template. */
function Summary({ proposal }: { readonly proposal: Proposal }) {
  const p = proposal.summary_params
  const created = proposal.affected_objects.find((o) => o.role === 'created')
  if (proposal.summary_template === 'create_table') {
    return (
      <div className="space-y-1.5">
        <p>
          Créer la table <code className="font-mono text-[0.85em]">{created?.physical}</code>{' '}
          <Data value={p.table_label?.value} />
        </p>
        <ul className="space-y-1 pl-4 text-sm">
          {(p.fields ?? []).map((f, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: the list is fixed, its order is its identity
            <li key={i} className="list-disc">
              <Data value={f.label.value} className="text-xs" />{' '}
              <span className="text-muted-foreground">— {kindOf(f.kind)}</span>
            </li>
          ))}
        </ul>
      </div>
    )
  }
  if (proposal.summary_template === 'add_link_field') {
    return (
      <p>
        Ajouter à <TableName table={p.source_table} /> une relation{' '}
        <Data value={p.field_label?.value} /> vers <TableName table={p.target_table} />
        <span className="block text-sm text-muted-foreground">
          {p.on_delete?.value === 'set_null'
            ? 'Supprimer une ligne visée videra ce champ dans les lignes qui la référencent.'
            : 'Une ligne visée par cette relation ne pourra plus être supprimée.'}
        </span>
      </p>
    )
  }
  if (proposal.summary_template === 'add_field') {
    return (
      <div className="space-y-1">
        <p>
          Ajouter à <TableName table={p.table} /> le champ <Data value={p.field_label?.value} />{' '}
          <span className="text-muted-foreground">— {kindOf(p.kind)}</span>
        </p>
        {p.options !== undefined && p.options.length > 0 && (
          <p className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
            Choix :
            {p.options.map((o, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: the list is fixed, its order is its identity
              <Data key={i} value={o.value} className="text-xs" />
            ))}
          </p>
        )}
      </div>
    )
  }
  return <p className="text-muted-foreground">Modification de structure.</p>
}

/** What the proposer wrote about the object's purpose — data, shown as such. */
function Description({ proposal }: { readonly proposal: Proposal }) {
  const p = proposal.summary_params
  const text = p.table_description?.value ?? p.field_description?.value
  if (text === null || text === undefined || text === '') return null
  return (
    <p className="text-sm text-muted-foreground">
      Description proposée : <Data value={text} className="text-xs" />
    </p>
  )
}

function ProposalCard({
  proposal,
  busy,
  onApprove,
  onReject,
}: {
  readonly proposal: Proposal
  readonly busy: boolean
  readonly onApprove: () => void
  readonly onReject: () => void
}) {
  const [sql, setSql] = useState(false)
  const status = STATUS[proposal.status]
  const open = proposal.status === 'proposed'
  return (
    <li className="space-y-2.5 rounded-lg border px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1 text-sm">
          <Summary proposal={proposal} />
          <Description proposal={proposal} />
        </div>
        <Badge variant="outline" className={cn('shrink-0', status.tone)}>
          {status.label}
        </Badge>
      </div>

      {/* The origin, without ambiguity: an agent, through a token, for a person (§7.7, 4). */}
      <p className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
        <Bot className="size-3.5" />
        Proposé par un agent pour {proposal.requested_by.name ?? 'une personne supprimée'}, via le
        jeton{' '}
        {proposal.token.label === null ? (
          'supprimé'
        ) : (
          <Data value={proposal.token.label} className="text-xs" />
        )}{' '}
        (MCP) · {TIME.format(new Date(proposal.requested_at))}
        {open && <> · expire le {TIME.format(new Date(proposal.expires_at))}</>}
      </p>

      <ul className="space-y-1.5">
        {proposal.affected_objects.map((o) => (
          <li key={`${o.role}:${o.physical}`} className="text-xs">
            <span className="font-medium">
              Table <code className="font-mono">{o.physical}</code> {ROLE[o.role] ?? o.role}
            </span>
            <ul className="mt-0.5 space-y-0.5 pl-4 text-muted-foreground">
              {o.effects.map((e) => (
                <li key={e} className="list-disc [overflow-wrap:anywhere]">
                  {e}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => setSql((v) => !v)}
        aria-expanded={sql}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ChevronDown className={cn('size-3.5 transition-transform', sql && 'rotate-180')} />
        SQL prévu
      </button>
      {sql && (
        <pre className="max-h-48 overflow-auto rounded-md border bg-muted px-3 py-2 font-mono text-xs whitespace-pre-wrap [overflow-wrap:anywhere]">
          {proposal.up_sql.join(';\n\n')}
        </pre>
      )}

      {proposal.decided_by !== null && proposal.status !== 'proposed' && (
        <p className="text-xs text-muted-foreground">
          {proposal.status === 'rejected' ? 'Refusée' : 'Approuvée'} par{' '}
          {proposal.decided_by.name ?? 'une personne supprimée'}
          {proposal.decided_at !== null && <> le {TIME.format(new Date(proposal.decided_at))}</>}
        </p>
      )}
      {proposal.status === 'failed' && proposal.error !== null && (
        <p className="text-xs text-destructive">
          {sentenceFor(proposal.error)} ({proposal.error})
        </p>
      )}

      {open && (
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" disabled={busy} onClick={onReject}>
            <X className="size-4" />
            Refuser
          </Button>
          <Button size="sm" disabled={busy} onClick={onApprove}>
            <Check className="size-4" />
            Approuver et appliquer
          </Button>
        </div>
      )}
    </li>
  )
}

export function ProposalDialog({
  open,
  base,
  onClose,
  onApplied,
}: {
  readonly open: boolean
  readonly base: { readonly name: string; readonly label: string }
  readonly onClose: () => void
  /** A proposal was applied, or the queue changed: the navigation recounts. */
  readonly onApplied: () => void
}) {
  const [proposals, setProposals] = useState<readonly Proposal[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [past, setPast] = useState(false)

  const load = useCallback(async () => {
    try {
      setProposals(await api.proposals(base.name))
    } catch (e) {
      setProposals([])
      setError(messageFor(e))
    }
  }, [base.name])

  useEffect(() => {
    if (!open) return
    setProposals(null)
    setError(null)
    setPast(false)
    void load()
  }, [open, load])

  const decide = async (id: string, fn: (id: string) => Promise<unknown>) => {
    setBusy(id)
    setError(null)
    try {
      await fn(id)
    } catch (e) {
      setError(messageFor(e))
    } finally {
      await load()
      onApplied()
      setBusy(null)
    }
  }

  const pending = (proposals ?? []).filter((p) => p.status === 'proposed')
  const decided = (proposals ?? []).filter((p) => p.status !== 'proposed')

  return (
    <Dialog open={open} onOpenChange={(o) => !o && busy === null && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Propositions des agents — {base.label}</DialogTitle>
          <DialogDescription>
            Un agent ne modifie jamais la structure d’une base : il la propose, et une personne
            décide ici. Approuvée, la modification est appliquée au nom de la personne pour qui
            l’agent agit, si elle en a toujours le droit. Sans décision, une proposition expire au
            bout de 24 heures.
          </DialogDescription>
        </DialogHeader>

        <div className="min-w-0 space-y-4">
          {error !== null && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          {proposals === null ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Chargement…
            </p>
          ) : (
            <>
              <section className="space-y-2">
                <h3 className="text-sm font-medium">En attente</h3>
                {pending.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucune proposition en attente.</p>
                ) : (
                  <ul className="space-y-2">
                    {pending.map((p) => (
                      <ProposalCard
                        key={p.id}
                        proposal={p}
                        busy={busy !== null}
                        onApprove={() => void decide(p.id, api.approveProposal)}
                        onReject={() => void decide(p.id, api.rejectProposal)}
                      />
                    ))}
                  </ul>
                )}
              </section>

              {decided.length > 0 && (
                <section className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setPast((v) => !v)}
                    aria-expanded={past}
                    className="flex items-center gap-1 text-sm font-medium"
                  >
                    <ChevronDown
                      className={cn('size-4 transition-transform', past && 'rotate-180')}
                    />
                    Décidées ou closes ({decided.length})
                  </button>
                  {past && (
                    <ul className="space-y-2">
                      {decided.map((p) => (
                        <ProposalCard
                          key={p.id}
                          proposal={p}
                          busy
                          onApprove={() => undefined}
                          onReject={() => undefined}
                        />
                      ))}
                    </ul>
                  )}
                </section>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
