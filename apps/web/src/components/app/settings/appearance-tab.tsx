'use client'

import { Refusal, SettingsSection, TabHeading } from '@/components/app/settings/section'
import { Choice } from '@/components/ui/choice'
import { type Me, api } from '@/lib/api/client'
import { dayOfDate, formatDay } from '@/lib/dates'
import { $t, LOCALES, LOCALE_NAMES, type Locale, browserLocale } from '@/lib/i18n'
import { messageFor } from '@/lib/messages'
import type { DateFormat, WeekStart } from '@/lib/preferences'
import { type ThemePreference, useTheme } from '@/lib/theme'
import { cn } from '@/lib/utils'
import { Check, Monitor, Moon, Sun } from 'lucide-react'
import { useState } from 'react'

/**
 * The language of the product, how it looks and how dates read — chapter 11 §10.
 *
 * The language belongs to the account, and follows the person; with none chosen, the
 * browser's is read. Choosing one reloads the page in it.
 *
 * The theme belongs to the browser: « suivre le système » is a property of the device.
 * The order of a date and the first day of the week belong to the account, and follow the
 * person from one computer to the next. Each choice applies at once — there is nothing
 * to confirm in a way of reading.
 */

/** The choice that follows the browser — a value no language has. */
const AUTOMATIC = 'auto'

const THEMES: ReadonlyArray<{ id: ThemePreference; label: string; icon: typeof Sun }> = [
  { id: 'system', label: $t('Suivre le système'), icon: Monitor },
  { id: 'light', label: $t('Clair'), icon: Sun },
  { id: 'dark', label: $t('Sombre'), icon: Moon },
]

export function AppearanceTab({ me, onMe }: { readonly me: Me; readonly onMe: (me: Me) => void }) {
  const preference = useTheme((s) => s.preference)
  const setPreference = useTheme((s) => s.setPreference)
  const [error, setError] = useState<string | null>(null)
  const today = dayOfDate(new Date())

  const save = async (change: {
    dateFormat?: DateFormat
    weekStart?: WeekStart
    locale?: Locale | null
  }) => {
    setError(null)
    try {
      onMe(await api.updateProfile(change))
    } catch (e) {
      setError(messageFor(e))
    }
  }

  return (
    <>
      <TabHeading title={$t('Apparence')}>
        {$t('La langue et le thème de l’interface, et la façon dont les dates se lisent.')}
      </TabHeading>

      <SettingsSection
        title={$t('Langue')}
        description={$t(
          'Celle de l’interface, des nombres et des dates. Elle vous suit d’un poste à l’autre.',
        )}
      >
        <Choice
          aria-label={$t('Langue')}
          value={me.locale ?? AUTOMATIC}
          onValueChange={(next) =>
            void save({ locale: next === AUTOMATIC ? null : (next as Locale) })
          }
          options={[
            {
              value: AUTOMATIC,
              label: $t('Langue du navigateur ({localeNames})', {
                localeNames: LOCALE_NAMES[browserLocale()],
              }),
            },
            ...LOCALES.map((l) => ({ value: l, label: LOCALE_NAMES[l] })),
          ]}
          size="default"
          className="w-72"
        />
      </SettingsSection>

      <SettingsSection title={$t('Thème')} description={$t('Propre à ce navigateur.')}>
        <Choices
          label={$t('Thème')}
          value={preference}
          options={THEMES.map((t) => ({
            value: t.id,
            label: t.label,
            icon: t.icon,
          }))}
          onChange={setPreference}
        />
      </SettingsSection>

      <SettingsSection
        title={$t('Format des dates')}
        description={$t(
          'Pour les valeurs des champs date, à l’affichage comme à la saisie. Les deux formes se tapent toujours, quel que soit le choix.',
        )}
      >
        <Choices
          label={$t('Format des dates')}
          value={me.dateFormat}
          options={[
            { value: 'dmy', label: formatDay(today, 'dmy'), hint: $t('jour, mois, année') },
            { value: 'iso', label: formatDay(today, 'iso'), hint: 'ISO 8601' },
          ]}
          onChange={(dateFormat) => void save({ dateFormat })}
        />
      </SettingsSection>

      <SettingsSection
        title={$t('Premier jour de la semaine')}
        description={$t('Dans les calendriers, le sélecteur de date et la frise chronologique.')}
      >
        <Choices
          label={$t('Premier jour de la semaine')}
          value={me.weekStart}
          options={[
            { value: 1, label: $t('Lundi') },
            { value: 0, label: $t('Dimanche') },
          ]}
          onChange={(weekStart) => void save({ weekStart })}
        />
      </SettingsSection>

      {error !== null && <Refusal>{error}</Refusal>}
    </>
  )
}

/** A choice among a few, drawn as tiles — a radio group to a screen reader. */
function Choices<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  readonly label: string
  readonly value: T
  readonly options: ReadonlyArray<{
    readonly value: T
    readonly label: string
    readonly hint?: string
    readonly icon?: typeof Sun
  }>
  readonly onChange: (value: T) => void
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const chosen = option.value === value
        const Icon = option.icon
        return (
          <button
            key={String(option.value)}
            type="button"
            // biome-ignore lint/a11y/useSemanticElements: a tile holds an icon, a label and a hint, which an <input type="radio"> cannot lay out
            role="radio"
            aria-checked={chosen}
            onClick={() => onChange(option.value)}
            className={cn(
              'flex min-w-36 items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-sm transition-colors',
              chosen
                ? 'border-primary bg-primary/5'
                : 'hover:border-foreground/20 hover:bg-accent/50',
            )}
          >
            {Icon !== undefined && <Icon className="size-4 shrink-0 text-muted-foreground" />}
            <span className="min-w-0 flex-1">
              <span className="block font-medium tabular-nums">{option.label}</span>
              {option.hint !== undefined && (
                <span className="block text-xs text-muted-foreground">{option.hint}</span>
              )}
            </span>
            <Check className={cn('size-4 shrink-0 text-primary', !chosen && 'invisible')} />
          </button>
        )
      })}
    </div>
  )
}
