'use client'

import { AppearanceTab } from '@/components/app/settings/appearance-tab'
import { NotificationsTab } from '@/components/app/settings/notifications-tab'
import { ProfileTab } from '@/components/app/settings/profile-tab'
import type { LinkNotice } from '@/components/app/settings/section'
import { SecurityTab } from '@/components/app/settings/security-tab'
import { TokensTab } from '@/components/app/settings/tokens-tab'
import { SidebarToggle } from '@/components/app/sidebar'
import type { Me } from '@/lib/api/client'
import { $t } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Bell, KeyRound, Palette, ShieldCheck, UserRound } from 'lucide-react'

/**
 * One's own settings — chapter 11 §10. Everything here is about the person signed in, and
 * nothing about the data: the name the others read and the ways in to the account, the
 * password and the open sessions, how dates read, what notifies, and the doors one opened
 * with integration tokens.
 *
 * Reached from the profile menu, bottom-left, by everyone. What only administrators set
 * lives in the administration, not here.
 */

export type { LinkNotice }

export type SettingsTab = 'profile' | 'security' | 'appearance' | 'notifications' | 'tokens'

const TABS: ReadonlyArray<{ id: SettingsTab; label: string; icon: typeof UserRound }> = [
  { id: 'profile', label: $t('Profil'), icon: UserRound },
  { id: 'security', label: $t('Sécurité'), icon: ShieldCheck },
  { id: 'appearance', label: $t('Apparence'), icon: Palette },
  { id: 'notifications', label: $t('Notifications'), icon: Bell },
  { id: 'tokens', label: $t('Jetons'), icon: KeyRound },
]

/** The tabs as an address names them — `/?parametres=securite` —, and back. */
const SLUGS: Readonly<Record<SettingsTab, string>> = {
  profile: 'profil',
  security: 'securite',
  appearance: 'apparence',
  notifications: 'notifications',
  tokens: 'jetons',
}

export const slugOfTab = (tab: SettingsTab): string => SLUGS[tab]

export function tabOfSlug(slug: string | null): SettingsTab | null {
  const found = (Object.keys(SLUGS) as SettingsTab[]).find((tab) => SLUGS[tab] === slug)
  return found ?? null
}

export function SettingsPanel({
  tab,
  me,
  notice,
  onTab,
  onMe,
  onDismissNotice,
}: {
  readonly tab: SettingsTab
  readonly me: Me
  readonly notice: LinkNotice | null
  readonly onTab: (tab: SettingsTab) => void
  /** The account changed — its name, its address, its preferences. */
  readonly onMe: (me: Me) => void
  readonly onDismissNotice: () => void
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b px-3">
        <SidebarToggle />
        <span className="text-sm font-medium">{$t('Paramètres')}</span>
        <nav
          className="ml-2 flex min-w-0 items-center gap-1 overflow-x-auto scroll-discret"
          aria-label={$t('Sections des paramètres')}
        >
          {TABS.map((t) => {
            const Icon = t.icon
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onTab(t.id)}
                aria-current={tab === t.id ? 'page' : undefined}
                className={cn(
                  'flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-sm transition-colors',
                  tab === t.id
                    ? 'bg-accent font-medium text-foreground'
                    : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                )}
              >
                <Icon className="size-4" />
                {t.label}
              </button>
            )
          })}
        </nav>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto scroll-discret">
        <div className="mx-auto max-w-3xl space-y-4 px-6 py-6">
          {tab === 'profile' ? (
            <ProfileTab me={me} notice={notice} onMe={onMe} onDismissNotice={onDismissNotice} />
          ) : tab === 'security' ? (
            <SecurityTab me={me} />
          ) : tab === 'appearance' ? (
            <AppearanceTab me={me} onMe={onMe} />
          ) : tab === 'notifications' ? (
            <NotificationsTab me={me} onMe={onMe} />
          ) : (
            <TokensTab />
          )}
        </div>
      </div>
    </div>
  )
}
