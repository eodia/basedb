'use client'

import { QuestionView, draftOf } from '@/components/app/analytics/question-view'
import { ApiError, type DescribedBase, type Question, api } from '@/lib/api/client'
import { $t } from '@/lib/i18n'
import { messageFor } from '@/lib/messages'
import { type Tab, useWorkspace } from '@/lib/store/workspace'
import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'

/**
 * A question in a tab of the workspace (chapter 18 §1): built with the mouse or written in
 * SQL, shown as a table or a chart, run read only with the reader's own rights — the same
 * question as on a dashboard. The tab keeps its draft: another tab and back finds it as left.
 */
export function QuestionTab({
  base,
  tab,
  manages,
  onNavigationChanged,
}: {
  readonly base: DescribedBase
  readonly tab: Tab
  /** The caller manages the base's structure: they may share a question. */
  readonly manages: boolean
  /** A question was saved, renamed or deleted: the dashboards list them. */
  readonly onNavigationChanged?: () => void
}) {
  const setQuestionDraft = useWorkspace((s) => s.setQuestionDraft)
  const attachQuestion = useWorkspace((s) => s.attachQuestion)
  const detachQuestion = useWorkspace((s) => s.detachQuestion)
  const close = useWorkspace((s) => s.close)
  const reloadTick = useWorkspace((s) => s.reloadTick)
  const [saved, setSaved] = useState<Question | null>(null)
  const [error, setError] = useState<string | null>(null)

  // The saved question the tab shows — read again when it was renamed elsewhere (the tab's
  // label moved) or changed (a reload was asked for).
  const questionId = tab.questionId
  // biome-ignore lint/correctness/useExhaustiveDependencies: `tab.label` and `reloadTick` are the signals.
  useEffect(() => {
    if (questionId === null) {
      setSaved(null)
      return
    }
    let live = true
    api.question(base.name, questionId).then(
      (found) => {
        if (!live) return
        setSaved(found)
        setError(null)
        // A tab that never held it starts from it.
        if (useWorkspace.getState().tabs.find((t) => t.id === tab.id)?.question === null) {
          setQuestionDraft(tab.id, draftOf(found))
        }
      },
      (e) => {
        if (!live) return
        // Deleted, or no longer shared with this reader: the tab keeps what it was editing.
        if (e instanceof ApiError && e.code === 'RESOURCE_NOT_FOUND') detachQuestion(questionId)
        else setError(messageFor(e))
      },
    )
    return () => {
      live = false
    }
  }, [base.name, questionId, tab.id, tab.label, reloadTick, detachQuestion, setQuestionDraft])

  if (tab.question === null) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
        {error === null ? <Loader2 className="size-5 animate-spin" /> : error}
      </div>
    )
  }

  return (
    <QuestionView
      key={tab.id}
      base={base}
      initial={tab.question}
      question={saved !== null && saved.id === tab.question.id ? saved : null}
      manages={manages}
      onDraftChange={(draft) => setQuestionDraft(tab.id, draft)}
      onSaved={(question) => {
        setSaved(question)
        attachQuestion(tab.id, question.id, question.label)
        setQuestionDraft(tab.id, draftOf(question))
        onNavigationChanged?.()
      }}
      onDeleted={() => {
        close(tab.id)
        onNavigationChanged?.()
      }}
      backLabel={$t('Retour')}
    />
  )
}
