'use client'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { api } from '@/lib/api/client'
import { $t } from '@/lib/i18n'
import { type ThemePreference, useTheme } from '@/lib/theme'
import { cn } from '@/lib/utils'
import { ChevronsUpDown, LogOut, Monitor, Moon, Settings, Sun } from 'lucide-react'

/**
 * The profile, bottom-left — the one corner of the screen that is about the reader
 * rather than about the data.
 *
 * It opens the settings, where everything about one's account lives — the name, the
 * address, the password, the open sessions, the tokens, what notifies (chapter 11 §10) —,
 * keeps the theme at hand, because one switches it more often than one looks for it, and
 * holds the way out.
 *
 * Above them, what the sidebar hands it: the entries that are not the data itself —
 * documentation, integrations, administration —, kept out of the column.
 */

interface Props {
  readonly user: { readonly displayName: string; readonly email: string }
  /** The reduced sidebar: the avatar alone, the name in a tooltip. */
  readonly compact?: boolean
  /** Menu items shown first, under the name. */
  readonly entries?: React.ReactNode
  readonly onSettings: () => void
  readonly onSignedOut: () => void
}

export function UserMenu({ user, compact = false, entries, onSettings, onSignedOut }: Props) {
  const preference = useTheme((s) => s.preference)
  const setPreference = useTheme((s) => s.setPreference)

  const initials = user.displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')

  const trigger = (
    <DropdownMenuTrigger asChild>
      <button
        type="button"
        aria-label={compact ? user.displayName : undefined}
        className={cn(
          'flex w-full items-center gap-2.5 rounded-lg p-2 text-left transition-colors hover:bg-sidebar-accent data-[state=open]:bg-sidebar-accent',
          compact && 'justify-center p-1',
        )}
      >
        <Avatar className="size-8">
          <AvatarFallback className="bg-primary/10 text-xs text-primary">{initials}</AvatarFallback>
        </Avatar>
        {!compact && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{user.displayName}</span>
              <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
            </span>
            <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
          </>
        )}
      </button>
    </DropdownMenuTrigger>
  )

  return (
    <DropdownMenu>
      {compact ? (
        <Tooltip>
          <TooltipTrigger asChild>{trigger}</TooltipTrigger>
          <TooltipContent side="right">{user.displayName}</TooltipContent>
        </Tooltip>
      ) : (
        trigger
      )}

      {/* `side="top"`: the trigger sits at the bottom of the window, and a menu opening
          downwards would be clipped by it. */}
      <DropdownMenuContent side="top" align="start" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <span className="block truncate text-sm text-foreground">{user.displayName}</span>
          <span className="block truncate">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {entries !== undefined && (
          <>
            {entries}
            <DropdownMenuSeparator />
          </>
        )}

        <DropdownMenuItem onSelect={onSettings}>
          <Settings className="size-4" />
          {$t('Paramètres')}
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            {preference === 'system' ? (
              <Monitor className="size-4" />
            ) : preference === 'dark' ? (
              <Moon className="size-4" />
            ) : (
              <Sun className="size-4" />
            )}
            {$t('Apparence')}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-48">
            <DropdownMenuRadioGroup
              value={preference}
              onValueChange={(v) => setPreference(v as ThemePreference)}
            >
              <DropdownMenuRadioItem value="system">
                <Monitor className="size-4" />
                {$t('Suivre le système')}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="light">
                <Sun className="size-4" />
                {$t('Clair')}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dark">
                <Moon className="size-4" />
                {$t('Sombre')}
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            void api.logout().finally(onSignedOut)
          }}
        >
          <LogOut className="size-4" />
          {$t('Se déconnecter')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
