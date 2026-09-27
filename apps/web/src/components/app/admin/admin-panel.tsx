'use client'

import { GroupsTab } from '@/components/app/admin/groups-tab'
import { PermissionsTab } from '@/components/app/admin/permissions-tab'
import { UsersTab } from '@/components/app/admin/users-tab'
import { SidebarToggle } from '@/components/app/sidebar'
import type { Me } from '@/lib/api/client'
import { $t, intlLocale } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Shield, UserRound, Users } from 'lucide-react'

/**
 * The administration — chapter 05 §15: people, groups and permissions.
 *
 * Three screens, reached from the bottom of the sidebar by administrators only:
 *
 *   Utilisateurs  — the accounts: create one (a temporary password is handed over, to be
 *                   changed at first sign-in), rename, reset, disable, place in groups;
 *   Groupes       — who is in which group; « Administrateurs » and « Tous les
 *                   utilisateurs » come with every tenant and cannot be removed;
 *   Permissions   — for each group, a level on each project, base and table.
 *
 * Every change asks for the password when the session was not elevated in the last five
 * minutes: the dialog appears on its own, and the change goes through once it is answered.
 */

export type AdminTab = 'users' | 'groups' | 'permissions'

const TABS: ReadonlyArray<{ id: AdminTab; label: string; icon: typeof Users }> = [
  { id: 'users', label: $t('Utilisateurs'), icon: UserRound },
  { id: 'groups', label: $t('Groupes'), icon: Users },
  { id: 'permissions', label: $t('Permissions'), icon: Shield },
]

export function AdminPanel({
  tab,
  me,
  focusProject,
  onTab,
  onAccessChanged,
}: {
  readonly tab: AdminTab
  readonly me: Me
  /** The project unfolded first in the permission grid — the one being browsed. */
  readonly focusProject: string | null
  readonly onTab: (tab: AdminTab) => void
  /** Rights moved: what the sidebar lists may have changed with them. */
  readonly onAccessChanged: () => void
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b px-3">
        <SidebarToggle />
        <span className="text-sm font-medium">{$t('Administration')}</span>
        <nav
          className="ml-2 flex items-center gap-1"
          aria-label={$t('Sections de l’administration')}
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
                  'flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm transition-colors',
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
        {tab === 'users' ? (
          <UsersTab me={me} />
        ) : tab === 'groups' ? (
          <GroupsTab />
        ) : (
          <PermissionsTab focusProject={focusProject} onChanged={onAccessChanged} />
        )}
      </div>
    </div>
  )
}

/** Two letters for an avatar: the initials of the name, else the start of the address. */
export function initials(name: string, email: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length >= 2) return `${words[0][0]}${words[1][0]}`.toUpperCase()
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return email.slice(0, 2).toUpperCase()
}

/** « il y a 3 jours », or the date when it is older than a month. */
export function sinceWhen(iso: string | null): string {
  if (iso === null) return $t('Jamais')
  const at = Date.parse(iso)
  const minutes = Math.round((Date.now() - at) / 60_000)
  if (minutes < 1) return $t('À l’instant')
  if (minutes < 60) return $t('Il y a {minutes} min', { minutes })
  const hours = Math.round(minutes / 60)
  if (hours < 24) return $t('Il y a {hours} h', { hours })
  const days = Math.round(hours / 24)
  if (days < 31) return $t('Il y a {days} j', { days })
  return new Date(at).toLocaleDateString(intlLocale())
}
