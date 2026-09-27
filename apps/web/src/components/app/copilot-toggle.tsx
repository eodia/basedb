'use client'

import { Button } from '@/components/ui/button'
import { $t } from '@/lib/i18n'
import { useWorkspace } from '@/lib/store/workspace'
import { Sparkles } from 'lucide-react'

/**
 * The copilot's switch, at the right end of the top bar — the same place over the tables,
 * the dashboards and the automations, and the same switch: the copilot stays open from
 * one section to the other.
 */
export function CopilotToggle() {
  const open = useWorkspace((s) => s.copilotOpen)
  const setOpen = useWorkspace((s) => s.setCopilotOpen)
  return (
    <Button
      variant={open ? 'default' : 'ghost'}
      size="sm"
      className="gap-1.5"
      onClick={() => setOpen(!open)}
      aria-pressed={open}
    >
      <Sparkles className="size-3.5" />
      <span className="hidden sm:inline">{$t('Copilot')}</span>
    </Button>
  )
}
