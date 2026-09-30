'use client'

import { AccountForm } from '@/components/account-form'
import { AuthLayout, PRESSABLE, REVEAL, pauseOnSuccess, revealAt } from '@/components/auth-layout'
import { Login, OidcButtons } from '@/components/login'
import { Button } from '@/components/ui/button'
import { type AccessLevel, type InvitationPreview, type Me, api } from '@/lib/api/client'
import { withBase } from '@/lib/base-path'
import { $t } from '@/lib/i18n'
import { messageFor } from '@/lib/messages'
import { useTheme } from '@/lib/theme'
import { cn } from '@/lib/utils'
import { Check, Link2Off, Loader2 } from 'lucide-react'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

/**
 * The page an invitation's link opens — chapter 05 §15.8.
 *
 * It says what the invitation offers before anything else; then the person creates their
 * account, or signs in, and joins. The link is the proof: whoever opens it and signs in
 * receives the access, once.
 */

type Page =
  | { readonly kind: 'loading' }
  | { readonly kind: 'unknown' }
  | { readonly kind: 'ready'; readonly preview: InvitationPreview; readonly me: Me | null }

const LEVEL: Readonly<Record<AccessLevel, string>> = {
  none: $t('aucun accès'),
  read: $t('en lecture'),
  edit: $t('en modification'),
  manage: $t('en gestion'),
}

/** Where the application lands: the project last browsed (see `app/page.tsx`). */
function remember(projectId: string): void {
  try {
    window.localStorage.setItem('basedb.project.v1', projectId)
  } catch {
    // A private window: the application opens on its first project instead.
  }
}

function offer(preview: InvitationPreview): string {
  const where =
    preview.scope.kind === 'project'
      ? $t('le projet « {label} »', { label: preview.scope.label })
      : $t('la base « {label} » du projet « {project} »', {
          label: preview.scope.label,
          project: preview.project,
        })
  return $t('{invited_by} vous invite dans {where}, {level}.', {
    invited_by: preview.invited_by,
    where,
    level: LEVEL[preview.level],
  })
}

export default function InvitationPage() {
  const params = useParams<{ token: string }>()
  const token = decodeURIComponent(params.token ?? '')
  const [page, setPage] = useState<Page>({ kind: 'loading' })
  const [mode, setMode] = useState<'signup' | 'login'>('signup')
  const [joining, setJoining] = useState(false)
  const [joined, setJoined] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => useTheme.getState().initialize(), [])

  const load = useCallback(async () => {
    try {
      const [preview, me] = await Promise.all([api.invitationPreview(token), api.resume()])
      setPage({ kind: 'ready', preview, me })
    } catch {
      setPage({ kind: 'unknown' })
    }
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  /** Accepts, then opens the application on the project it leads to. */
  const join = useCallback(async () => {
    setJoining(true)
    setError(null)
    try {
      const accepted = await api.acceptInvitation(token)
      setJoined(true)
      remember(accepted.projectId)
      await pauseOnSuccess()
      window.location.assign(withBase('/'))
    } catch (e) {
      setError(messageFor(e))
      setJoining(false)
    }
  }, [token])

  if (page.kind === 'loading') {
    return (
      <main className="flex min-h-svh items-center justify-center bg-background">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </main>
    )
  }

  if (page.kind === 'unknown') {
    return (
      <main className="flex min-h-svh items-center justify-center bg-background p-6 text-foreground">
        <div className="max-w-sm animate-in fade-in slide-in-from-bottom-2 text-center duration-500">
          <span className="mx-auto mb-4 grid size-12 place-items-center rounded-xl bg-muted">
            <Link2Off className="size-6 text-muted-foreground" />
          </span>
          <h1 className="text-lg font-semibold">{$t('Cette invitation n’est plus valable')}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {$t(
              'Elle a expiré, a déjà servi ou a été annulée. Demandez un nouveau lien à la personne qui vous a invité.',
            )}
          </p>
          <Button asChild variant="outline" className="mt-6">
            <a href={withBase('/')}>{$t('Aller à basedb')}</a>
          </Button>
        </div>
      </main>
    )
  }

  const { preview, me } = page
  const title = $t('Rejoindre « {label} »', { label: preview.scope.label })

  // Already signed in: one gesture, and the application opens on the project.
  if (me !== null) {
    return (
      <AuthLayout title={title} description={offer(preview)}>
        <div className={cn('grid gap-4', REVEAL)} style={revealAt(0)}>
          <p className="text-sm text-muted-foreground">
            {$t('Vous êtes connecté en tant que')}{' '}
            <span className="font-medium text-foreground">{me.email}</span>.
          </p>
          {error !== null && (
            <p role="alert" className="animate-shake text-sm text-destructive">
              {error}
            </p>
          )}
          <Button
            size="lg"
            className={cn('w-full', PRESSABLE)}
            onClick={() => void join()}
            disabled={joining}
          >
            {joined ? (
              <Check className="animate-in zoom-in-50 duration-200" aria-hidden="true" />
            ) : (
              joining && <Loader2 className="animate-spin" aria-hidden="true" />
            )}
            <span aria-live="polite">
              {joined
                ? $t('C’est fait')
                : preview.scope.kind === 'project'
                  ? $t('Rejoindre le projet')
                  : $t('Rejoindre la base')}
            </span>
          </Button>
          <button
            type="button"
            className="w-fit rounded-sm text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            onClick={() => {
              void api.logout().finally(() => setPage({ ...page, me: null }))
            }}
          >
            {$t('Ce n’est pas vous ? Changer de compte')}
          </button>
        </div>
      </AuthLayout>
    )
  }

  if (mode === 'login') {
    return (
      <Login
        title={title}
        description={$t('{preview} Connectez-vous pour la rejoindre.', { preview: offer(preview) })}
        initialEmail={preview.email}
        onSignedIn={() => void join()}
        onSignUp={() => setMode('signup')}
        alwaysOfferSignUp
        returnTo={window.location.pathname}
      />
    )
  }

  return (
    <AuthLayout
      title={title}
      description={$t('{preview} Créez votre compte pour la rejoindre.', {
        preview: offer(preview),
      })}
      footer={
        <p>
          {$t('Déjà un compte ?')}{' '}
          <button
            type="button"
            onClick={() => setMode('login')}
            className="rounded-sm font-medium text-foreground underline-offset-4 hover:underline"
          >
            {$t('Se connecter')}
          </button>
        </p>
      }
    >
      <AccountForm
        submitLabel={$t('Créer mon compte et rejoindre')}
        doneLabel={$t('Compte créé')}
        initialEmail={preview.email}
        onSubmit={async ({ name, email, password }) => {
          await api.signUp({ email, displayName: name, password, invitation: token })
        }}
        onDone={() => void join()}
      />
      {/* Back here once signed in with a provider: the page then offers to join. */}
      <OidcButtons returnTo={window.location.pathname} />
      {error !== null && (
        <p role="alert" className="mt-4 animate-shake text-sm text-destructive">
          {error}
        </p>
      )}
    </AuthLayout>
  )
}
