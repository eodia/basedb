'use client'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { type Me, api } from '@/lib/api/client'
import { copy, download } from '@/lib/export'
import { $t } from '@/lib/i18n'
import { messageFor } from '@/lib/messages'
import { type ExportResult, exportTemplate } from '@/lib/template-export'
import { optionValue } from '@basedb/contracts'
import { Check, Copy, Download, Loader2, Server } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

/**
 * « Enregistrer comme modèle » — chapter 20 §6: a base as a template, from what the person
 * reads of it; downloaded as JSON, ready for the site's catalog, or — for an administrator —
 * added straight to the instance's gallery.
 */
export function ExportTemplateDialog({
  base,
  me,
  onClose,
}: {
  readonly base: {
    readonly name: string
    readonly label: string
    readonly description?: string | null
  } | null
  readonly me: Me
  readonly onClose: () => void
}) {
  const [label, setLabel] = useState('')
  const [key, setKey] = useState('')
  const [summary, setSummary] = useState('')
  const [category, setCategory] = useState('')
  const [rows, setRows] = useState(true)
  const [busy, setBusy] = useState<'download' | 'copy' | 'instance' | null>(null)
  const [result, setResult] = useState<ExportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (base === null) return
    setLabel(base.label)
    setKey(optionValue(base.label).replace(/_/g, '-'))
    setSummary(base.description ?? '')
    setCategory('')
    setRows(true)
    setResult(null)
    setError(null)
  }, [base])

  const build = async (): Promise<ExportResult | null> => {
    if (base === null) return null
    const described = await api.describeBase(base.name)
    const built = await exportTemplate(described, {
      key: key.trim(),
      label: label.trim(),
      summary: summary.trim(),
      category: category.trim(),
      rows,
      me: me.id,
    })
    setResult(built)
    return built
  }

  const run = async (action: 'download' | 'copy' | 'instance') => {
    setBusy(action)
    setError(null)
    try {
      const built = await build()
      if (built === null) return
      const json = JSON.stringify(built.template, null, 2)
      if (action === 'download') download('json', json, built.template.key)
      if (action === 'copy' && (await copy(json))) {
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }
      if (action === 'instance') {
        await api.importTemplate(built.template)
        toast.success(
          $t('« {label} » ajouté au catalogue de l’instance', { label: built.template.label }),
        )
      }
    } catch (e) {
      setError(e instanceof Error && !('code' in e) ? e.message : messageFor(e))
    } finally {
      setBusy(null)
    }
  }

  const ready = label.trim() !== '' && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(key.trim()) && busy === null

  return (
    <Dialog open={base !== null} onOpenChange={(o) => !o && busy === null && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{$t('Enregistrer comme modèle')}</DialogTitle>
          <DialogDescription>
            {$t(
              'Les tables, les champs et leurs réglages — consignes IA comprises —, les relations, les vues partagées, les tableaux de bord et les automatisations de « {label} ». Ni fichier, ni partage, ni webhook.',
              { label: base?.label },
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="export-label">{$t('Nom du modèle')}</Label>
              <Input id="export-label" value={label} onChange={(e) => setLabel(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="export-key">{$t('Clé')}</Label>
              <Input
                id="export-key"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="export-summary">{$t('Résumé||présentation courte d’un modèle')}</Label>
            <Input
              id="export-summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder={$t('Une phrase pour la galerie')}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="export-category">{$t('Catégorie')}</Label>
            <Input
              id="export-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder={$t('Relation client, Produit et technique…')}
            />
          </div>
          <label htmlFor="export-rows" className="flex items-center gap-2 text-sm">
            <Checkbox
              id="export-rows"
              checked={rows}
              onCheckedChange={(v) => setRows(v === true)}
            />
            {$t('Emporter jusqu’à 50 lignes par table comme exemples')}
          </label>
          {result !== null && result.omitted.length > 0 && (
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer">
                {$t('{omittedCount} élément(s) laissé(s) de côté', {
                  omittedCount: result.omitted.length,
                })}
              </summary>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {result.omitted.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </details>
          )}
          {error !== null && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          {me.isAdmin ? (
            <Button
              variant="ghost"
              disabled={!ready}
              onClick={() => void run('instance')}
              className="gap-1.5"
            >
              {busy === 'instance' ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Server className="size-4" />
              )}
              {$t('Ajouter à l’instance')}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={!ready}
              onClick={() => void run('copy')}
              className="gap-1.5"
            >
              {busy === 'copy' ? (
                <Loader2 className="size-4 animate-spin" />
              ) : copied ? (
                <Check className="size-4" />
              ) : (
                <Copy className="size-4" />
              )}
              {$t('Copier le JSON')}
            </Button>
            <Button disabled={!ready} onClick={() => void run('download')} className="gap-1.5">
              {busy === 'download' ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              {$t('Télécharger')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
