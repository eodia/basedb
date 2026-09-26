'use client'

import { type Member, api } from '@/lib/api/client'
import { type ReactNode, createContext, useContext, useEffect, useState } from 'react'

/**
 * The people of the tenant — what a `user` field names (chapter 04 §2.10).
 *
 * A person column holds an identifier; the name that goes with it is read ONCE, here, and
 * shared by every cell, card and panel that shows one. A reader who may not list the
 * members — a shared form's anonymous visitor — simply gets none, and sees identifiers.
 */

const Members = createContext<readonly Member[]>([])

export function MembersProvider({ children }: { readonly children: ReactNode }) {
  const [members, setMembers] = useState<readonly Member[]>([])
  useEffect(() => {
    let current = true
    api
      .members()
      .then((list) => {
        if (current) setMembers(list)
      })
      .catch(() => {
        // Names are a comfort: without them, a person cell shows the identifier.
      })
    return () => {
      current = false
    }
  }, [])
  return <Members.Provider value={members}>{children}</Members.Provider>
}

/** People already known by name — a shared view's page, which may not list the members. */
export function KnownMembers({
  members,
  children,
}: {
  readonly members: readonly Member[]
  readonly children: ReactNode
}) {
  return <Members.Provider value={members}>{children}</Members.Provider>
}

export const useMembers = () => useContext(Members)

/** What to call someone: their name, their address, or the start of their identifier. */
export function memberName(members: readonly Member[], id: unknown): string {
  if (typeof id !== 'string' || id === '') return ''
  const member = members.find((m) => m.id === id)
  return member?.display_name || member?.email || id.slice(0, 8)
}
