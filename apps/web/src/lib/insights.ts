'use client'

import { useEffect } from 'react'
import { create } from 'zustand'
import { api } from '@/lib/api/client'

/**
 * Whether insights is beside this instance (chapter 19 §5) — asked once, shared by every
 * place that shows it: without it, its dashboards are hidden rather than offered and broken.
 * `undefined` while unknown; a question left unanswered stays so, and is asked again later.
 */
const useInsightsState = create<{ readonly available: boolean | undefined }>(() => ({
  available: undefined,
}))

let asking = false

function ask(): void {
  if (asking || useInsightsState.getState().available !== undefined) return
  asking = true
  api
    .insightsStatus()
    .then((s) => useInsightsState.setState({ available: s.configured }))
    .catch(() => {})
    .finally(() => {
      asking = false
    })
}

/** insights here or not: `undefined` until known. */
export function useInsightsAvailable(): boolean | undefined {
  useEffect(ask, [])
  return useInsightsState((s) => s.available)
}
