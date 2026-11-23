import type { ReactNode } from 'react'
import { shellTokens } from '@/lib/static-shell'

/** The static build exports this page once, as a shell for every token (lib/static-shell.ts). */
export const generateStaticParams = shellTokens

export default function TokenLayout({ children }: { readonly children: ReactNode }) {
  return children
}
