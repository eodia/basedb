'use client'

import { AccountForm } from '@/components/account-form'
import { AuthLayout } from '@/components/auth-layout'
import { api } from '@/lib/api/client'
import { $t } from '@/lib/i18n'

/**
 * The very first screen of an instance — chapter 13 §7.
 *
 * No administrator exists yet, so there is nobody to sign in as: the person here creates
 * that account, with their own address, name and password, and lands signed in. The
 * server closes this road the moment it is taken; whoever arrives second is sent to the
 * login screen.
 */
export function Bootstrap({ onDone }: { readonly onDone: () => void }) {
  return (
    <AuthLayout
      title={$t('Créez le compte administrateur')}
      description={$t(
        'Cette instance n’a pas encore d’administrateur. Ce compte gérera les bases, les personnes et leurs droits ; vous inviterez les autres ensuite.',
      )}
    >
      <AccountForm
        submitLabel={$t('Créer le compte')}
        doneLabel={$t('Compte créé')}
        onSubmit={({ name, email, password }) =>
          api.bootstrap({ email, displayName: name, password })
        }
        onDone={onDone}
        // Someone else created the administrator first: there is nothing left to create,
        // only an account to sign in to.
        onNotFound={onDone}
      />
    </AuthLayout>
  )
}
