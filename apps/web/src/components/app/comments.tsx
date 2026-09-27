'use client'

import { toneOf } from '@/components/app/collab'
import { initials } from '@/components/app/value-widgets'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Textarea } from '@/components/ui/textarea'
import { type Member, type RecordComment, type TableRef, api } from '@/lib/api/client'
import { editableText, encodeMentions, mentionAt, relativeTime, segmentsOf } from '@/lib/collab'
import { $t, $tp } from '@/lib/i18n'
import { memberName, useMembers } from '@/lib/members'
import { messageFor } from '@/lib/messages'
import { cn } from '@/lib/utils'
import {
  AlertTriangle,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Send,
  Trash2,
} from 'lucide-react'
import { type KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react'

/**
 * The comments of a row — chapter 16 §1, on screen: the thread, oldest first, and a box
 * to write in where `@` offers the people of the tenant. Reading the row is enough to
 * take part.
 */

export function CommentThread({
  table,
  recordId,
  self,
  reloadKey,
}: {
  readonly table: TableRef
  readonly recordId: string
  readonly self: string | null
  /** Moves when the live stream says this row's comments changed. */
  readonly reloadKey: number
}) {
  const [comments, setComments] = useState<readonly RecordComment[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const members = useMembers()
  const end = useRef<HTMLDivElement>(null)

  const { base, name } = table
  const load = useCallback(async () => {
    try {
      setComments(await api.comments({ base, name }, recordId))
      setError(null)
    } catch (e) {
      setError(messageFor(e))
    }
  }, [base, name, recordId])

  useEffect(() => {
    void reloadKey
    void load()
  }, [load, reloadKey])

  const count = comments?.length ?? 0
  useEffect(() => {
    if (count > 0) end.current?.scrollIntoView({ block: 'nearest' })
  }, [count])

  const post = async (body: string) => {
    const { comment, unreachable } = await api.addComment({ base, name }, recordId, body)
    setComments((was) => [...(was ?? []), comment])
    setWarning(
      unreachable.length === 0
        ? null
        : $tp(
            unreachable.length,
            '{names} ne peut pas voir cette ligne : pas de notification.',
            '{names} ne peuvent pas voir cette ligne : pas de notification.',
            { names: unreachable.map((id) => memberName(members, id)).join(', ') },
          ),
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {comments === null && error === null && (
        <div className="flex justify-center py-6">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        </div>
      )}
      {error !== null && <p className="text-sm text-destructive">{error}</p>}
      {comments !== null && comments.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-6 text-center text-sm text-muted-foreground">
          <MessageSquare className="size-5" />
          {$t('Aucun commentaire. Posez une question, tapez @ pour prévenir quelqu’un.')}
        </div>
      )}
      {comments?.map((comment) => (
        <CommentItem
          key={comment.id}
          comment={comment}
          self={self}
          members={members}
          onChanged={(next) =>
            setComments((was) => (was ?? []).map((c) => (c.id === next.id ? next : c)))
          }
          onDeleted={() => setComments((was) => (was ?? []).filter((c) => c.id !== comment.id))}
        />
      ))}
      <div ref={end} />
      {warning !== null && (
        <p className="flex items-start gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/5 px-2.5 py-1.5 text-xs">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
          {warning}
        </p>
      )}
      <Composer members={members} submitLabel={$t('Envoyer')} onSubmit={post} />
    </div>
  )
}

function CommentItem({
  comment,
  self,
  members,
  onChanged,
  onDeleted,
}: {
  readonly comment: RecordComment
  readonly self: string | null
  readonly members: readonly Member[]
  readonly onChanged: (comment: RecordComment) => void
  readonly onDeleted: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const remove = async () => {
    try {
      await api.deleteComment(comment.id)
      onDeleted()
    } catch (e) {
      setError(messageFor(e))
    }
  }

  return (
    <article className="group flex gap-2.5">
      <Avatar className="mt-0.5 size-7 shrink-0">
        <AvatarFallback className={cn('text-[11px] font-medium', toneOf(comment.author.id))}>
          {initials(comment.author.name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-sm font-medium">{comment.author.name}</span>
          <span className="shrink-0 text-xs text-muted-foreground" title={comment.created_at}>
            {relativeTime(comment.created_at)}
            {comment.edited_at !== null && $t(' · modifié')}
          </span>
          {(comment.can_edit || comment.can_delete) && !editing && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="ml-auto size-6 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
                  aria-label={$t('Actions sur le commentaire')}
                >
                  <MoreHorizontal className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {comment.can_edit && (
                  <DropdownMenuItem onSelect={() => setEditing(true)}>
                    <Pencil className="size-4" />
                    {$t('Modifier')}
                  </DropdownMenuItem>
                )}
                {comment.can_delete && (
                  <DropdownMenuItem
                    onSelect={() => setConfirming(true)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="size-4" />
                    {$t('Supprimer')}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        {editing ? (
          <div className="mt-1">
            <Composer
              members={members}
              initial={comment.body}
              submitLabel={$t('Enregistrer')}
              onCancel={() => setEditing(false)}
              onSubmit={async (body) => {
                onChanged(await api.editComment(comment.id, body))
                setEditing(false)
              }}
            />
          </div>
        ) : (
          <p className="mt-0.5 text-sm leading-relaxed break-words whitespace-pre-wrap">
            <CommentBody body={comment.body} self={self} />
          </p>
        )}
        {confirming && (
          <div className="mt-1.5 flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">{$t('Supprimer ce commentaire ?')}</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => setConfirming(false)}
            >
              {$t('Annuler')}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => void remove()}
            >
              {$t('Supprimer')}
            </Button>
          </div>
        )}
        {error !== null && <p className="mt-1 text-xs text-destructive">{error}</p>}
      </div>
    </article>
  )
}

/** A comment's text: words, mentions as pills — oneself's stands out — and links. */
export function CommentBody({
  body,
  self,
}: { readonly body: string; readonly self: string | null }) {
  return (
    <>
      {segmentsOf(body).map((segment, index) => {
        const key = `${index}:${segment.kind}`
        if (segment.kind === 'mention') {
          return (
            <span
              key={key}
              className={cn(
                'rounded px-1 py-px font-medium',
                segment.id === self ? 'bg-primary/20 text-primary' : 'bg-primary/10 text-primary',
              )}
            >
              @{segment.name}
            </span>
          )
        }
        if (segment.kind === 'link') {
          return (
            <a
              key={key}
              href={segment.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2"
            >
              {segment.url}
            </a>
          )
        }
        return <span key={key}>{segment.text}</span>
      })}
    </>
  )
}

/**
 * The box to write a comment in. `@` followed by letters offers the people whose name
 * matches; choosing one writes their name, which is sent as a mention.
 */
function Composer({
  members,
  initial = '',
  submitLabel,
  onSubmit,
  onCancel,
}: {
  readonly members: readonly Member[]
  readonly initial?: string
  readonly submitLabel: string
  readonly onSubmit: (body: string) => Promise<void>
  readonly onCancel?: () => void
}) {
  const start = editableText(initial)
  const [text, setText] = useState(start.text)
  const [chosen, setChosen] = useState<ReadonlyMap<string, string>>(start.chosen)
  const [mention, setMention] = useState<{ start: number; query: string } | null>(null)
  const [highlight, setHighlight] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const box = useRef<HTMLTextAreaElement>(null)

  const needle = mention?.query.trim().toLowerCase() ?? ''
  const suggestions =
    mention === null
      ? []
      : members
          .filter((m) => !m.disabled)
          .filter((m) => `${m.display_name} ${m.email}`.toLowerCase().includes(needle))
          .slice(0, 6)

  const track = () => {
    const el = box.current
    if (el === null) return
    setMention(mentionAt(el.value, el.selectionStart ?? el.value.length))
    setHighlight(0)
  }

  const pick = (member: Member) => {
    const el = box.current
    if (el === null || mention === null) return
    const label = member.display_name || member.email
    const caret = el.selectionStart ?? text.length
    const next = `${text.slice(0, mention.start)}@${label} ${text.slice(caret)}`
    setText(next)
    setChosen((was) => new Map([...was, [label, member.id]]))
    setMention(null)
    const at = mention.start + label.length + 2
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(at, at)
    })
  }

  const submit = async () => {
    const body = encodeMentions(text.trim(), chosen)
    if (body === '' || busy) return
    setBusy(true)
    setError(null)
    try {
      await onSubmit(body)
      if (onCancel === undefined) {
        setText('')
        setChosen(new Map())
      }
    } catch (e) {
      setError(messageFor(e))
    } finally {
      setBusy(false)
    }
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (suggestions.length > 0) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const step = e.key === 'ArrowDown' ? 1 : -1
        setHighlight((h) => (h + step + suggestions.length) % suggestions.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        const member = suggestions[highlight]
        if (member !== undefined) pick(member)
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setMention(null)
        return
      }
    }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      void submit()
    } else if (e.key === 'Escape' && onCancel !== undefined) {
      onCancel()
    }
  }

  return (
    <div className="relative">
      <Textarea
        ref={box}
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          requestAnimationFrame(track)
        }}
        onKeyDown={onKeyDown}
        onClick={track}
        placeholder={$t('Écrire un commentaire… @ pour mentionner')}
        rows={2}
        maxLength={10_000}
        aria-label={$t('Commentaire')}
        className="min-h-16 resize-none pr-2 text-sm"
      />
      {suggestions.length > 0 && (
        <div
          aria-label={$t('Personnes à mentionner')}
          className="absolute bottom-full left-0 z-20 mb-1 w-64 overflow-hidden rounded-md border bg-popover py-1 shadow-lg"
        >
          {suggestions.map((member, index) => (
            <button
              key={member.id}
              type="button"
              aria-current={index === highlight}
              onMouseDown={(e) => {
                // Before the textarea loses its caret.
                e.preventDefault()
                pick(member)
              }}
              className={cn(
                'flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm',
                index === highlight ? 'bg-accent' : 'hover:bg-accent/60',
              )}
            >
              <Avatar className="size-5">
                <AvatarFallback className={cn('text-[9px] font-medium', toneOf(member.id))}>
                  {initials(member.display_name || member.email)}
                </AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1 truncate">{member.display_name || member.email}</span>
            </button>
          ))}
        </div>
      )}
      <div className="mt-1.5 flex items-center gap-2">
        {error !== null && <p className="mr-auto text-xs text-destructive">{error}</p>}
        <span className="mr-auto text-[11px] text-muted-foreground">
          {error === null && $t('Ctrl+Entrée pour envoyer')}
        </span>
        {onCancel !== undefined && (
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onCancel}>
            {$t('Annuler')}
          </Button>
        )}
        <Button
          size="sm"
          className="h-7 gap-1.5 text-xs"
          disabled={busy || text.trim() === ''}
          onClick={() => void submit()}
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
          {submitLabel}
        </Button>
      </div>
    </div>
  )
}
