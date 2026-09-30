import {
  type IDataObject,
  type INodeType,
  type INodeTypeDescription,
  type IWebhookFunctions,
  type IWebhookResponseData,
  NodeConnectionTypes,
} from 'n8n-workflow'
import { eventsFor, verifySignature } from '../logic'

/**
 * Receives the webhooks of basedb: each row created, changed or deleted, the moment it is —
 * even by SQL written straight into PostgreSQL. The webhook is created in basedb, from the
 * base's menu, « API et agents » › « Webhooks… », with this node's production URL; the secret
 * basedb then shows goes into the credentials, and every delivery is checked against it.
 *
 * One item per event, with the row before and after and the fields that changed. basedb
 * delivers at least once: an event already seen can come again, and carries the same `id`.
 */
export class BasedbWebhookTrigger implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'basedb Webhook Trigger',
    name: 'basedbWebhookTrigger',
    icon: 'file:basedb.svg',
    group: ['trigger'],
    version: 1,
    description: 'Starts the workflow the moment basedb sends a webhook',
    defaults: { name: 'basedb Webhook Trigger' },
    inputs: [],
    outputs: [NodeConnectionTypes.Main],
    credentials: [{ name: 'basedbWebhookApi', required: true }],
    webhooks: [
      {
        name: 'default',
        httpMethod: 'POST',
        responseMode: 'onReceived',
        path: 'basedb',
      },
    ],
    properties: [
      {
        displayName:
          'Create the webhook in basedb — menu of the base › API et agents › Webhooks… — with the production URL above, then put the secret basedb shows into the credentials.',
        name: 'notice',
        type: 'notice',
        default: '',
      },
      {
        displayName: 'Events',
        name: 'events',
        type: 'multiOptions',
        options: [
          { name: 'Row Created', value: 'record.created' },
          { name: 'Row Updated', value: 'record.updated' },
          { name: 'Row Deleted', value: 'record.deleted' },
        ],
        default: ['record.created', 'record.updated', 'record.deleted'],
        description: 'The events that start the workflow; the others are acknowledged and left',
      },
      {
        displayName: 'Tables',
        name: 'tables',
        type: 'string',
        default: '',
        placeholder: 'opportunites, clients',
        description:
          'Only the events of these tables, by technical name, separated by commas. Empty: every table of the webhook.',
      },
    ],
  }

  async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
    const request = this.getRequestObject()
    const credentials = await this.getCredentials('basedbWebhookApi')
    const header = request.headers['x-basedb-signature']
    const verdict = verifySignature(
      String(credentials.secret),
      Array.isArray(header) ? header[0] : header,
      request.rawBody ?? JSON.stringify(request.body ?? {}),
    )
    if (verdict !== 'valid') {
      // Not from basedb, or altered, or replayed long after: nothing starts.
      this.getResponseObject()
        .status(401)
        .json({ error: `signature ${verdict}` })
      return { noWebhookResponse: true }
    }

    const types = this.getNodeParameter('events', []) as string[]
    const tables = (this.getNodeParameter('tables', '') as string)
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t !== '')
    const events = eventsFor(this.getBodyData(), types, tables)
    // Acknowledged either way: an event this workflow does not want is not a failure, and
    // basedb would otherwise send it again.
    if (events.length === 0) return { webhookResponse: { received: true, kept: 0 } }
    return {
      workflowData: [
        this.helpers.returnJsonArray(
          events.map((e) => ({
            ...e,
            delivery: request.headers['x-basedb-delivery-id'] ?? null,
          })) as IDataObject[],
        ),
      ],
    }
  }
}
