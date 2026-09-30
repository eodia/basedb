import {
  type IDataObject,
  type INodeExecutionData,
  type INodeType,
  type INodeTypeDescription,
  type IPollFunctions,
  NodeConnectionTypes,
} from 'n8n-workflow'
import { type PollState, freshRows, pollFilter } from '../logic'
import { allRows, getBases, getTables } from '../transport'

/**
 * Starts a workflow for each row added — or added or changed — in a basedb table, by asking
 * basedb at each poll for the rows since the last one it emitted.
 *
 * The instant remembered is basedb's own (`_created_at`, `_updated_at`), never n8n's clock:
 * two machines that disagree by a few seconds lose no row. basedb reads those instants to
 * the millisecond, so a poll asks again from the last one and leaves out the rows it has
 * already emitted at it. At its first poll the trigger emits nothing: it notes where the
 * table stands, and starts from there.
 */

/** At most this many rows per poll; the rest come at the next one, in order. */
const PER_POLL = 5_000

export class BasedbTrigger implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'basedb Trigger',
    name: 'basedbTrigger',
    icon: 'file:basedb.svg',
    group: ['trigger'],
    version: 1,
    subtitle:
      '={{ ($parameter["event"] === "created" ? "Row created" : "Row created or updated") + ": " + $parameter["table"] }}',
    description: 'Starts the workflow when a row is added or changed in a basedb table',
    defaults: { name: 'basedb Trigger' },
    polling: true,
    inputs: [],
    outputs: [NodeConnectionTypes.Main],
    credentials: [{ name: 'basedbApi', required: true }],
    properties: [
      {
        displayName: 'Base Name or ID',
        name: 'base',
        type: 'options',
        typeOptions: { loadOptionsMethod: 'getBases' },
        default: '',
        required: true,
        description:
          'The base the token opens. Choose from the list, or specify its technical name using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
      },
      {
        displayName: 'Table Name or ID',
        name: 'table',
        type: 'options',
        typeOptions: { loadOptionsMethod: 'getTables', loadOptionsDependsOn: ['base'] },
        default: '',
        required: true,
        description:
          'Choose from the list, or specify its technical name using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
      },
      {
        displayName: 'Trigger On',
        name: 'event',
        type: 'options',
        options: [
          { name: 'Row Created', value: 'created', description: 'Each new row, once' },
          {
            name: 'Row Created or Updated',
            value: 'updated',
            description: 'Each new row, and each row changed since the last poll',
          },
        ],
        default: 'created',
      },
      {
        displayName: 'Filter',
        name: 'filter',
        type: 'string',
        default: '',
        placeholder: 'statut eq "gagne"',
        description:
          'Only the rows this basedb filter keeps, with the technical names of the fields',
      },
    ],
  }

  methods = { loadOptions: { getBases, getTables } }

  async poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null> {
    const base = this.getNodeParameter('base') as string
    const table = this.getNodeParameter('table') as string
    const column = this.getNodeParameter('event') === 'created' ? '_created_at' : '_updated_at'
    const filter = (this.getNodeParameter('filter', '') as string).trim()
    const extra: IDataObject = filter === '' ? {} : { filter }

    // A test from the editor: the latest row, so that the next nodes have one to map.
    if (this.getMode() === 'manual') {
      const latest = await allRows.call(this, base, table, { ...extra, sort: `-${column}` }, 1)
      return latest.length === 0 ? null : [this.helpers.returnJsonArray(latest)]
    }

    const state = this.getWorkflowStaticData('node') as PollState
    if (state.since === undefined) {
      // Where the table stands: its latest instant, and the rows already there at it.
      const latest = await allRows.call(
        this,
        base,
        table,
        { ...extra, sort: `-${column},_id` },
        100,
      )
      const top = latest[0]?.[column]
      const atTop = latest.filter((r) => r[column] === top)
      const { next } = freshRows(atTop.reverse(), column, {})
      state.since = next.since ?? new Date(0).toISOString()
      state.seen = next.seen ?? []
      return null
    }

    const rows = await allRows.call(
      this,
      base,
      table,
      { filter: pollFilter(column, state.since, filter), sort: `${column},_id` },
      PER_POLL,
    )
    const { fresh, next } = freshRows(rows, column, state)
    state.since = next.since
    state.seen = next.seen
    return fresh.length === 0 ? null : [this.helpers.returnJsonArray(fresh as IDataObject[])]
  }
}
