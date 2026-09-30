import type { ICredentialType, INodeProperties } from 'n8n-workflow'

/**
 * The signing secret of a basedb webhook, shown once when the webhook is created: with it the
 * trigger checks that each delivery comes from basedb, and was not altered on the way.
 */
export class BasedbWebhookApi implements ICredentialType {
  name = 'basedbWebhookApi'

  displayName = 'basedb Webhook'

  documentationUrl = 'https://eodia.github.io/basedb/integrations/n8n/'

  icon = 'file:basedb.svg' as const

  properties: INodeProperties[] = [
    {
      displayName: 'Signing Secret',
      name: 'secret',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      description: 'The secret basedb showed when the webhook was created',
      required: true,
    },
  ]
}
