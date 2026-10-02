'use client'

import { Choice } from '@/components/ui/choice'
import { Switch } from '@/components/ui/switch'
import type { DocumentSpec, Table } from '@/lib/api/client'
import { $t, LOCALES, LOCALE_NAMES } from '@/lib/i18n'
import { useId } from 'react'
import { RichField } from './blocks'
import { ColorPicker, Section, Segmented, Setting } from './controls'
import { ImageInput } from './image-input'
import { ACCENTS, TEXT_COLORS, imageFields, shown } from './model'

/**
 * The template's look, apart from its blocks — chapter 21 §1.1 and §1.2: colours, faces,
 * sizes and page in one panel; header and footer in the other.
 */

function Toggle({
  checked,
  onChange,
  label,
}: {
  readonly checked: boolean
  readonly onChange: (next: boolean) => void
  readonly label: string
}) {
  const id = useId()
  return (
    <label htmlFor={id} className="flex items-center gap-2 text-sm">
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
      {label}
    </label>
  )
}

export function StylePanel({
  spec,
  onChange,
}: {
  readonly spec: DocumentSpec
  readonly onChange: (next: Partial<DocumentSpec>) => void
}) {
  const theme = spec.theme
  const setTheme = (next: Partial<DocumentSpec['theme']>) =>
    onChange({ theme: { ...theme, ...next } })
  const faces = [
    { value: 'sans', label: $t('Sans empattement') },
    { value: 'serif', label: $t('Avec empattement') },
  ]
  return (
    <div className="space-y-4">
      <Section
        title={$t('Couleurs')}
        description={$t(
          'L’accent colore les titres, les bandeaux, l’en-tête des tableaux et les liens.',
        )}
      >
        <Setting label={$t('Couleur d’accent')}>
          {(id) => (
            <ColorPicker
              id={id}
              value={theme.accent}
              onChange={(accent) => setTheme({ accent })}
              swatches={ACCENTS}
              label={$t('Couleur d’accent')}
            />
          )}
        </Setting>
        <Setting label={$t('Couleur du texte')}>
          {(id) => (
            <ColorPicker
              id={id}
              value={theme.text}
              onChange={(text) => setTheme({ text })}
              swatches={TEXT_COLORS}
              label={$t('Couleur du texte')}
            />
          )}
        </Setting>
      </Section>

      <Section title={$t('Typographie')}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Setting label={$t('Police du texte')}>
            {(id) => (
              <Choice
                id={id}
                value={theme.font}
                onValueChange={(font) => setTheme({ font: font as 'sans' | 'serif' })}
                options={faces}
                aria-label={$t('Police du texte')}
              />
            )}
          </Setting>
          <Setting label={$t('Police des titres')}>
            {(id) => (
              <Choice
                id={id}
                value={theme.title_font}
                onValueChange={(font) => setTheme({ title_font: font as 'sans' | 'serif' })}
                options={faces}
                aria-label={$t('Police des titres')}
              />
            )}
          </Setting>
          <Setting label={$t('Taille du texte')}>
            {() => (
              <Segmented
                value={theme.size}
                onChange={(size) => setTheme({ size })}
                options={[9, 10, 11, 12].map((s) => ({ value: s, label: `${s} pt` }))}
                aria-label={$t('Taille du texte')}
              />
            )}
          </Setting>
          <Setting label={$t('Intertitres')}>
            {(id) => (
              <Choice
                id={id}
                value={theme.titles}
                onValueChange={(titles) => setTheme({ titles: titles as typeof theme.titles })}
                options={[
                  { value: 'plain', label: $t('Couleur du texte') },
                  { value: 'accent', label: $t('Couleur d’accent') },
                  { value: 'rule', label: $t('Soulignés d’un trait d’accent') },
                ]}
                aria-label={$t('Intertitres')}
              />
            )}
          </Setting>
        </div>
        <p className="text-xs text-muted-foreground">
          {$t(
            'Les intertitres sont ceux des blocs de texte. Avec empattement, un texte que la police ne sait pas écrire — idéogrammes, alphabets d’Europe centrale — reste dans la police sans empattement.',
          )}
        </p>
      </Section>

      <Section title={$t('Page')}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Setting label={$t('Format')}>
            {() => (
              <Segmented
                value={spec.page.size}
                onChange={(size) => onChange({ page: { ...spec.page, size } })}
                options={[
                  { value: 'A4', label: 'A4' },
                  { value: 'LETTER', label: 'Letter' },
                ]}
                aria-label={$t('Format de page')}
              />
            )}
          </Setting>
          <Setting label={$t('Orientation')}>
            {() => (
              <Segmented
                value={spec.page.orientation}
                onChange={(orientation) => onChange({ page: { ...spec.page, orientation } })}
                options={[
                  { value: 'portrait', label: $t('Portrait') },
                  { value: 'landscape', label: $t('Paysage') },
                ]}
                aria-label={$t('Orientation')}
              />
            )}
          </Setting>
          <Setting label={$t('Marges')}>
            {() => (
              <Segmented
                value={theme.margin}
                onChange={(margin) => setTheme({ margin })}
                options={[
                  { value: 14, label: $t('Étroites') },
                  { value: 20, label: $t('Normales') },
                  { value: 26, label: $t('Larges') },
                ]}
                aria-label={$t('Marges')}
              />
            )}
          </Setting>
          <Setting label={$t('Cadre')}>
            {() => (
              <Segmented
                value={theme.border}
                onChange={(border) => setTheme({ border })}
                options={[
                  { value: 'none', label: $t('Aucun') },
                  { value: 'line', label: $t('Filet') },
                  { value: 'double', label: $t('Double filet') },
                ]}
                aria-label={$t('Cadre de page')}
              />
            )}
          </Setting>
          <Setting
            label={$t('Langue des valeurs')}
            hint={$t('Montants, dates, oui et non s’écrivent dans cette langue.')}
          >
            {(id) => (
              <Choice
                id={id}
                value={spec.locale}
                onValueChange={(l) => onChange({ locale: l as DocumentSpec['locale'] })}
                options={LOCALES.map((l) => ({ value: l, label: LOCALE_NAMES[l] }))}
                aria-label={$t('Langue des valeurs')}
              />
            )}
          </Setting>
          <div className="flex items-end pb-1">
            <Toggle
              checked={spec.page.valign === 'center'}
              onChange={(center) =>
                onChange({ page: { ...spec.page, valign: center ? 'center' : 'top' } })
              }
              label={$t('Centrer verticalement sur la page')}
            />
          </div>
        </div>
      </Section>
    </div>
  )
}

export function HeaderFooterPanel({
  spec,
  table,
  onChange,
}: {
  readonly spec: DocumentSpec
  readonly table: Table
  readonly onChange: (next: Partial<DocumentSpec>) => void
}) {
  const header = spec.header
  const footer = spec.footer
  const setHeader = (next: Partial<DocumentSpec['header']>) =>
    onChange({ header: { ...header, ...next } })
  const setFooter = (next: Partial<DocumentSpec['footer']>) =>
    onChange({ footer: { ...footer, ...next } })
  const fields = shown(table.fields)
  return (
    <div className="space-y-4">
      <Section
        title={$t('En-tête')}
        description={$t(
          'Votre logo et vos coordonnées à gauche ; ce qu’est le document, son numéro et sa date à droite.',
        )}
      >
        <Setting label={$t('Afficher')}>
          {() => (
            <Segmented
              value={header.show}
              onChange={(show) => setHeader({ show })}
              options={[
                { value: 'none', label: $t('Nulle part') },
                { value: 'first', label: $t('Première page') },
                { value: 'every', label: $t('Chaque page') },
              ]}
              aria-label={$t('Pages où l’en-tête s’affiche')}
            />
          )}
        </Setting>
        {header.show !== 'none' && (
          <>
            <Setting label={$t('Logo')}>
              {() => (
                <div className="space-y-2">
                  <ImageInput
                    value={header.logo}
                    onChange={(logo) => setHeader({ logo })}
                    fields={imageFields(table)}
                    allowNone
                    label={$t('Logo')}
                  />
                  {header.logo !== null && (
                    <Segmented
                      value={header.logo_width}
                      onChange={(logo_width) => setHeader({ logo_width })}
                      options={[
                        { value: 25, label: $t('Petit') },
                        { value: 40, label: $t('Moyen') },
                        { value: 60, label: $t('Grand') },
                      ]}
                      aria-label={$t('Taille du logo')}
                    />
                  )}
                </div>
              )}
            </Setting>
            <div className="grid gap-3 xl:grid-cols-2">
              <Setting label={$t('À gauche, sous le logo')}>
                {() => (
                  <RichField
                    value={header.left}
                    onChange={(left) => setHeader({ left })}
                    fields={fields}
                    placeholder={$t('Votre entreprise, son adresse…')}
                  />
                )}
              </Setting>
              <Setting label={$t('À droite')}>
                {() => (
                  <RichField
                    value={header.right}
                    onChange={(right) => setHeader({ right })}
                    fields={fields}
                    placeholder={$t('FACTURE, son numéro, sa date…')}
                  />
                )}
              </Setting>
            </div>
            <Toggle
              checked={header.rule}
              onChange={(rule) => setHeader({ rule })}
              label={$t('Trait d’accent sous l’en-tête')}
            />
          </>
        )}
      </Section>

      <Section
        title={$t('Pied de page')}
        description={$t('Sur chaque page : mentions légales, coordonnées, numéro de page.')}
      >
        <RichField
          value={footer.html}
          onChange={(html) => setFooter({ html })}
          fields={fields}
          placeholder={$t('SIRET, TVA, IBAN… Il cite une colonne comme un texte.')}
          minHeight="min-h-14"
        />
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Segmented
            value={footer.align}
            onChange={(align) => setFooter({ align })}
            options={[
              { value: 'left', label: $t('À gauche') },
              { value: 'center', label: $t('Centré') },
            ]}
            aria-label={$t('Alignement du pied de page')}
          />
          <Toggle
            checked={footer.page_numbers}
            onChange={(page_numbers) => setFooter({ page_numbers })}
            label={$t('Numéros de page')}
          />
          <Toggle
            checked={footer.rule}
            onChange={(rule) => setFooter({ rule })}
            label={$t('Trait au-dessus')}
          />
        </div>
      </Section>
    </div>
  )
}
