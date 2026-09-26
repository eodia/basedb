'use client'

import type { BaseEnvironment } from '@/lib/api/client'
import { cn } from '@/lib/utils'

/**
 * The environments of a base, as the navigation shows them — chapter 14.
 *
 * One line per base, whatever its number of environments: the environment one works in
 * is a badge beside the label, and the badge is where one changes it. A base with a
 * single environment — production — shows no badge at all: there is nothing to tell
 * apart, and a « Production » tag on every line would only be noise.
 */

/** Production reads calm; the others stand out, each in its own colour. */
const TONES = [
  'bg-amber-500/15 text-amber-800 dark:text-amber-300',
  'bg-sky-500/15 text-sky-800 dark:text-sky-300',
  'bg-violet-500/15 text-violet-800 dark:text-violet-300',
  'bg-rose-500/15 text-rose-800 dark:text-rose-300',
] as const

export function environmentTone(env: Pick<BaseEnvironment, 'production' | 'position'>): string {
  if (env.production) return 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300'
  return TONES[(Math.max(env.position, 1) - 1) % TONES.length] ?? TONES[0]
}

export function EnvironmentBadge({
  environment,
  className,
}: {
  readonly environment: Pick<BaseEnvironment, 'label' | 'production' | 'position'>
  readonly className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex h-5 max-w-24 shrink-0 items-center rounded-full px-1.5 text-[0.7rem] font-medium',
        environmentTone(environment),
        className,
      )}
    >
      <span className="truncate">{environment.label}</span>
    </span>
  )
}

/** The bases of a project, one group per base: its environments, production first. */
export function familiesOf<T extends { readonly environment: BaseEnvironment }>(
  bases: readonly T[],
): T[][] {
  const groups = new Map<string, T[]>()
  for (const base of bases) {
    const list = groups.get(base.environment.lineage) ?? []
    list.push(base)
    groups.set(base.environment.lineage, list)
  }
  return [...groups.values()].map((list) =>
    [...list].sort(
      (a, b) =>
        Number(b.environment.production) - Number(a.environment.production) ||
        a.environment.position - b.environment.position,
    ),
  )
}

const CHOICE_KEY = 'basedb.environment'

/** The environment last chosen for each base — a convenience of this browser only. */
export function readEnvironmentChoices(): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(CHOICE_KEY)
    const parsed: unknown = raw === null ? {} : JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, string>) : {}
  } catch {
    return {}
  }
}

export function writeEnvironmentChoice(lineage: string, name: string): void {
  try {
    const next = { ...readEnvironmentChoices(), [lineage]: name }
    window.localStorage.setItem(CHOICE_KEY, JSON.stringify(next))
  } catch {
    // Private window, blocked storage: the choice lasts as long as the page.
  }
}

/**
 * The environment a family shows: the one being worked in when it is one of them, else
 * the one last chosen, else production.
 */
export function shownEnvironment<T extends { readonly name: string }>(
  family: readonly T[],
  current: string | null,
  chosen: Readonly<Record<string, string>>,
  lineage: string,
): T | undefined {
  return (
    family.find((b) => b.name === current) ??
    family.find((b) => b.name === chosen[lineage]) ??
    family[0]
  )
}
