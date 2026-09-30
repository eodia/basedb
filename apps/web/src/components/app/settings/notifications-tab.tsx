'use client'

import { Refusal, SettingsSection, TabHeading } from '@/components/app/settings/section'
import { Switch } from '@/components/ui/switch'
import { type Me, type NotificationKind, api } from '@/lib/api/client'
import { $t } from '@/lib/i18n'
import { messageFor } from '@/lib/messages'
import { AtSign, Bell, Mail, MessageSquareReply, UserCheck, Zap } from 'lucide-react'
import { useState } from 'react'

/**
 * What notifies — chapter 16 §2.3 and §2.4.
 *
 * Each nature can be refused. A refused notification is not written at all, rather than
 * written and hidden: it never counts as unread, and turning the nature back on does not
 * bring back what happened in between. Each switch applies at once.
 *
 * Beside it, by mail: a notification left unread ten minutes also goes by mail — one mail
 * for all of them. Offered only when the instance can send one, and only for a nature
 * that notifies: no notification, nothing to mail.
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
  const [mailed, setMailed] = useState<ReadonlySet<NotificationKind>>(
    () => new Set(me.mailedNotifications),
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

  const toggleMail = async (kind: NotificationKind, on: boolean) => {
    const next = new Set(mailed)
    if (on) next.add(kind)
    else next.delete(kind)
    const before = mailed
    setMailed(next)
    setError(null)
    try {
      const updated = await api.updateProfile({
        mailedNotifications: KINDS.map((k) => k.kind).filter((k) => next.has(k)),
      })
      onMe(updated)
      setMailed(new Set(updated.mailedNotifications))
    } catch (e) {
      setMailed(before)
      setError(messageFor(e))
    }
  }

  return (
    <>
      <TabHeading title={$t('Notifications')}>
        {me.mailAvailable
          ? $t(
              'Ce qui s’affiche sous la cloche, en haut à droite des données. Une notification restée dix minutes sans être lue part aussi par courriel, si vous le voulez : un seul courriel pour toutes celles qui attendent.',
            )
          : $t(
              'Ce qui s’affiche sous la cloche, en haut à droite des données. Cette instance n’envoie pas de courriels : aucun serveur d’envoi n’y est configuré.',
            )}
      </TabHeading>

      <SettingsSection
        title={$t('Me notifier quand…')}
        description={$t('Toujours à propos d’une ligne que vous pouvez lire.')}
      >
        <ul className="divide-y rounded-md border">
          {me.mailAvailable && (
            <li className="flex items-end gap-3 px-3 py-1.5 text-xs text-muted-foreground">
              <span className="flex-1" />
              <span className="flex w-20 flex-col items-center gap-0.5 text-center leading-tight">
                <Bell className="size-3.5" />
                {$t('Dans basedb')}
              </span>
              <span className="flex w-20 flex-col items-center gap-0.5 text-center leading-tight">
                <Mail className="size-3.5" />
                {$t('Courriel')}
              </span>
            </li>
          )}
          {KINDS.map(({ kind, label, description, icon: Icon }) => (
            <li key={kind} className="flex items-center gap-3 px-3 py-2.5">
              <Icon className="size-4 shrink-0 text-muted-foreground" />
              <label htmlFor={`notify-${kind}`} className="min-w-0 flex-1 cursor-pointer">
                <span className="block text-sm font-medium">{label}</span>
                <span className="block text-xs text-muted-foreground">{description}</span>
              </label>
              <span className="flex w-20 justify-center">
                <Switch
                  id={`notify-${kind}`}
                  checked={!muted.has(kind)}
                  onCheckedChange={(on) => void toggle(kind, on)}
                />
              </span>
              {me.mailAvailable && (
                <span className="flex w-20 justify-center">
                  <Switch
                    checked={!muted.has(kind) && mailed.has(kind)}
                    // No notification, nothing to mail.
                    disabled={muted.has(kind)}
                    onCheckedChange={(on) => void toggleMail(kind, on)}
                    aria-label={$t('{label} par courriel', { label })}
                  />
                </span>
              )}
            </li>
          ))}
        </ul>
      </SettingsSection>

      {error !== null && <Refusal>{error}</Refusal>}
    </>
  )
}
