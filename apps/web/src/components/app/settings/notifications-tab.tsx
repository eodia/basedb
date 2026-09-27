'use client'

import { Refusal, SettingsSection, TabHeading } from '@/components/app/settings/section'
import { Switch } from '@/components/ui/switch'
import { type Me, type NotificationKind, api } from '@/lib/api/client'
import { $t } from '@/lib/i18n'
import { messageFor } from '@/lib/messages'
import { AtSign, MessageSquareReply, UserCheck, Zap } from 'lucide-react'
import { useState } from 'react'

/**
 * What notifies — chapter 16 §2.3.
 *
 * Each nature can be refused. A refused notification is not written at all, rather than
 * written and hidden: it never counts as unread, and turning the nature back on does not
 * bring back what happened in between. Each switch applies at once.
 */

const KINDS: ReadonlyArray<{
  readonly kind: NotificationKind
  readonly label: string
  readonly description: string
  readonly icon: typeof AtSign
}> = [
  {
    kind: 'mention',
    label: $t('Mentions'),
    description: $t('Quelqu’un vous cite dans un commentaire, avec @.'),
    icon: AtSign,
  },
  {
    kind: 'reply',
    label: $t('Réponses'),
    description: $t('Un nouveau commentaire arrive dans un fil où vous avez écrit.'),
    icon: MessageSquareReply,
  },
  {
    kind: 'assigned',
    label: $t('Attributions'),
    description: $t('Un champ Personne d’une ligne vous désigne.'),
    icon: UserCheck,
  },
  {
    kind: 'automation',
    label: $t('Automatisations'),
    description: $t('Une automatisation vous adresse une notification.'),
    icon: Zap,
  },
]

export function NotificationsTab({
  me,
  onMe,
}: {
  readonly me: Me
  readonly onMe: (me: Me) => void
}) {
  // Shown at once, confirmed by the answer: a switch that waits for the server before
  // moving reads as one that did not take.
  const [muted, setMuted] = useState<ReadonlySet<NotificationKind>>(
    () => new Set(me.mutedNotifications),
  )
  const [error, setError] = useState<string | null>(null)

  const toggle = async (kind: NotificationKind, on: boolean) => {
    const next = new Set(muted)
    if (on) next.delete(kind)
    else next.add(kind)
    const before = muted
    setMuted(next)
    setError(null)
    try {
      const updated = await api.updateProfile({
        mutedNotifications: KINDS.map((k) => k.kind).filter((k) => next.has(k)),
      })
      onMe(updated)
      setMuted(new Set(updated.mutedNotifications))
    } catch (e) {
      setMuted(before)
      setError(messageFor(e))
    }
  }

  return (
    <>
      <TabHeading title={$t('Notifications')}>
        {$t(
          'Ce qui s’affiche sous la cloche, en haut à droite des données. Rien ne part par courriel.',
        )}
      </TabHeading>

      <SettingsSection
        title={$t('Me notifier quand…')}
        description={$t('Toujours à propos d’une ligne que vous pouvez lire.')}
      >
        <ul className="divide-y rounded-md border">
          {KINDS.map(({ kind, label, description, icon: Icon }) => (
            <li key={kind} className="flex items-center gap-3 px-3 py-2.5">
              <Icon className="size-4 shrink-0 text-muted-foreground" />
              <label htmlFor={`notify-${kind}`} className="min-w-0 flex-1 cursor-pointer">
                <span className="block text-sm font-medium">{label}</span>
                <span className="block text-xs text-muted-foreground">{description}</span>
              </label>
              <Switch
                id={`notify-${kind}`}
                checked={!muted.has(kind)}
                onCheckedChange={(on) => void toggle(kind, on)}
              />
            </li>
          ))}
        </ul>
      </SettingsSection>

      {error !== null && <Refusal>{error}</Refusal>}
    </>
  )
}
