'use client'

import { useEffect } from 'react'
import { AiStar } from '@/components/app/ai-star'
import { Hint } from '@/components/ui/tooltip'
import { $t } from '@/lib/i18n'
import { useWorkspace } from '@/lib/store/workspace'

/**
 * The copilot's switch, at the right end of the top bar — the same place over the tables,
 * the automations and the dashboards, and the same switch: the copilot stays open from
 * one section to the other. Drawn as insights draws its own: a lit pill to open it, a quiet
 * pressed one once open. Ctrl+J, wherever the switch is.
 */
export function CopilotToggle() {
  const open = useWorkspace((s) => s.copilotOpen)
  const setOpen = useWorkspace((s) => s.setCopilotOpen)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'j') {
        e.preventDefault()
        const ws = useWorkspace.getState()
        ws.setCopilotOpen(!ws.copilotOpen)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const label = `${open ? $t('Fermer le Copilot') : $t('Ouvrir le Copilot')} (Ctrl+J)`
  if (open) {
    return (
      <Hint label={label}>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-pressed
          className="inline-flex h-8 shrink-0 items-center gap-2 rounded-full bg-violet-500/10 pr-2 pl-3 text-[13px] font-medium text-violet-700 ring-1 ring-violet-500/25 ring-inset transition-colors hover:bg-violet-500/15 dark:text-violet-300"
        >
          <AiStar size={15} />
          <span className="hidden sm:inline">{$t('Demander au Copilot')}</span>
          <kbd className="hidden rounded-md bg-violet-500/15 px-1.5 py-0.5 font-mono text-[10px] text-violet-700 md:inline dark:text-violet-300">
            Ctrl J
          </kbd>
        </button>
      </Hint>
    )
  }
  return (
    <Hint label={label}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-pressed={false}
        className="group relative inline-flex h-8 shrink-0 items-center rounded-full bg-gradient-to-r from-violet-500/70 via-fuchsia-400/60 to-primary/70 p-px shadow-[0_6px_20px_-10px_rgba(124,58,237,0.6)] transition-shadow hover:shadow-[0_8px_26px_-8px_rgba(124,58,237,0.7)]"
      >
        <span className="inline-flex h-full items-center gap-2 rounded-full bg-background/95 pr-2 pl-3 text-[13px] font-medium text-foreground transition-colors group-hover:bg-background/85">
          <AiStar size={15} className="transition-transform group-hover:rotate-12" />
          <span className="hidden sm:inline">{$t('Demander au Copilot')}</span>
          <kbd className="hidden rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground md:inline">
            Ctrl J
          </kbd>
        </span>
      </button>
    </Hint>
  )
}
