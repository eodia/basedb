'use client'

import { AccountForm } from '@/components/account-form'
import { AuthLayout } from '@/components/auth-layout'
import { OidcButtons } from '@/components/login'
import { type SignupPolicy, api } from '@/lib/api/client'
import { useEffect, useState } from 'react'

/** The domains an instance admits, as a line under the address field. */
export function domainsHint(policy: SignupPolicy | null): string | undefined {
  if (policy === null || policy.domains.length === 0) return undefined
  const list = policy.domains.map((d) => `@${d}`).join(', ')
  return `Réservé aux adresses ${list}.`
}

/**
 * Creating one's own account — chapter 13 §8. It lands on an empty workspace: its own
 * projects to create, and what others will share with it.
 */
export function SignUp({
  onDone,
  onSignIn,
}: {
  readonly onDone: () => void
  readonly onSignIn: () => void
}) {
  const [policy, setPolicy] = useState<SignupPolicy | null>(null)

  useEffect(() => {
    let alive = true
    void api.signupPolicy().then((found) => {
      if (alive) setPolicy(found)
    })
    return () => {
      alive = false
    }
  }, [])

  return (
    <AuthLayout
      title="Créez votre compte"
      description="Vos projets, vos bases, et les personnes avec qui vous les partagez — en une minute."
      footer={
        <p>
          Déjà un compte&nbsp;?{' '}
          <button
            type="button"
            onClick={onSignIn}
            className="rounded-sm font-medium text-foreground underline-offset-4 hover:underline"
          >
            Se connecter
          </button>
        </p>
      }
    >
      <AccountForm
        submitLabel="Créer mon compte"
        doneLabel="Compte créé"
        emailHint={domainsHint(policy)}
        onSubmit={({ name, email, password }) => api.signUp({ email, displayName: name, password })}
        onDone={onDone}
        notFoundMessage="Les inscriptions sont fermées sur cette instance : demandez un lien d’invitation à qui gère le projet."
      />
      <OidcButtons />
    </AuthLayout>
  )
}
