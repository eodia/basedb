'use client'

import { initials } from '@/components/app/value-widgets'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { type AppNotification, type Viewer, api } from '@/lib/api/client'
import { notificationSentence, relativeTime } from '@/lib/collab'
import { $t } from '@/lib/i18n'
import { messageFor } from '@/lib/messages'
import { cn } from '@/lib/utils'
import { AtSign, Bell, CheckCheck, CornerDownRight, Loader2, UserCheck, Zap } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

/**
 * Who else is here, and what concerns oneself — chapter 16, on screen: the faces of the
 * people looking at the same table or row, and the bell of the notifications.
 */

/** A soft, stable colour per person, so that a face is recognised from one screen to the next. */
const TONES = [
  'bg-sky-500/15 text-sky-800 dark:text-sky-300',
  'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300',
  'bg-amber-500/15 text-amber-800 dark:text-amber-300',
  'bg-rose-500/15 text-rose-800 dark:text-rose-300',
  'bg-violet-500/15 text-violet-800 dark:text-violet-300',
  'bg-teal-500/15 text-teal-800 dark:text-teal-300',
]
export function toneOf(id: string): string {
  let hash = 0
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return TONES[hash % TONES.length] as string
}

/** The other people looking here — oneself left out — as a row of faces. */
export function Viewers({
  viewers,
  self,
  record,
  size = 'sm',
}: {
  readonly viewers: readonly Viewer[]
  readonly self: string | null
  /** Only those with this row open, when given. */
  readonly record?: string
  readonly size?: 'sm' | 'xs'
}) {
  const others = viewers.filter(
    (v) => v.user !== self && (record === undefined || v.record === record),
  )
  if (others.length === 0) return null
  const shown = others.slice(0, 4)
  const box = size === 'xs' ? 'size-6 text-[10px]' : 'size-7 text-[11px]'
  return (
    <div
      className="flex items-center -space-x-1.5"
      aria-label={$t('Aussi ici : {map}', { map: others.map((v) => v.name).join(', ') })}
    >
      {shown.map((v) => (
        <Tooltip key={v.user}>
          <TooltipTrigger asChild>
            <Avatar className={cn(box, 'ring-2 ring-background')}>
              <AvatarFallback className={cn('font-medium', toneOf(v.user))}>
                {initials(v.name)}
              </AvatarFallback>
            </Avatar>
          </TooltipTrigger>
          <TooltipContent>
            {v.name}
            {record === undefined && v.record !== null ? $t(' — une fiche ouverte') : ''}
          </TooltipContent>
        </Tooltip>
      ))}
      {others.length > shown.length && (
        <span
          className={cn(
            box,
            'flex items-center justify-center rounded-full bg-muted font-medium text-muted-foreground ring-2 ring-background',
          )}
        >
          +{others.length - shown.length}
        </span>
      )}
    </div>
  )
}

const KIND_ICON = {
  mention: AtSign,
  reply: CornerDownRight,
  assigned: UserCheck,
  automation: Zap,
} as const satisfies Record<AppNotification['kind'], unknown>

/**
 * The bell: the unread count, and the list. Opening one opens its row; one whose row is
 * no longer readable says so and opens nothing.
 */
export function NotificationBell({
  tick,
  onOpen,
}: {
  /** Moves when the live stream says the notifications changed. */
  readonly tick: number
  readonly onOpen: (notification: AppNotification) => void
}) {
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const [items, setItems] = useState<readonly AppNotification[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const page = await api.notifications()
      setItems(page.notifications)
      setUnread(page.unread)
      setError(null)
    } catch (e) {
      setError(messageFor(e))
    }
  }, [])

  useEffect(() => {
    void tick
    void load()
  }, [tick, load])

  const markAll = async () => {
    try {
      await api.markNotificationsRead({ all: true })
      await load()
    } catch (e) {
      setError(messageFor(e))
    }
  }

  const choose = async (n: AppNotification) => {
    if (n.read_at === null) {
      await api.markNotificationsRead({ ids: [n.id] }).catch(() => undefined)
      void load()
    }
    if (!n.readable) return
    setOpen(false)
    onOpen(n)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="relative"
          aria-label={
            unread > 0 ? $t('Notifications, {unread} non lues', { unread }) : $t('Notifications')
          }
        >
          <Bell className="size-4" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-semibold">{$t('Notifications')}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            disabled={unread === 0}
            onClick={() => void markAll()}
          >
            <CheckCheck className="size-3.5" />
            {$t('Tout marquer comme lu')}
          </Button>
        </div>
        <div className="max-h-[420px] overflow-y-auto scroll-discret">
          {items === null && error === null && (
            <div className="flex justify-center py-6">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          )}
          {error !== null && <p className="px-3 py-4 text-sm text-destructive">{error}</p>}
          {items !== null && items.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              {$t(
                'Rien de nouveau. Vous serez prévenu ici quand on vous mentionne, vous répond ou vous désigne.',
              )}
            </p>
          )}
          {items?.map((n) => {
            const Icon = KIND_ICON[n.kind]
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => void choose(n)}
                className={cn(
                  'flex w-full gap-2.5 border-b px-3 py-2.5 text-left last:border-b-0 hover:bg-muted/50',
                  n.read_at === null && 'bg-primary/5',
                )}
              >
                <span className="relative mt-0.5 shrink-0">
                  <Avatar className="size-7">
                    <AvatarFallback
                      className={cn('text-[11px] font-medium', toneOf(n.actor?.id ?? 'x'))}
                    >
                      {initials(n.actor?.name ?? '?')}
                    </AvatarFallback>
                  </Avatar>
                  <Icon className="absolute -right-1 -bottom-1 size-3.5 rounded-full bg-background p-0.5 text-muted-foreground" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm leading-snug">{notificationSentence(n)}</span>
                  {n.excerpt !== '' && (
                    <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">
                      {n.excerpt}
                    </span>
                  )}
                  <span className="mt-1 block text-[11px] text-muted-foreground">
                    {relativeTime(n.created_at)} · {n.base.label}
                    {!n.readable && $t(' · ligne plus accessible')}
                  </span>
                </span>
                {n.read_at === null && (
                  <span
                    className="mt-2 size-2 shrink-0 rounded-full bg-primary"
                    aria-label={$t('Non lue')}
                  />
                )}
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
