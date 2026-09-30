import {
  type IDataObject,
  type IExecuteFunctions,
  type INodeExecutionData,
  type INodeProperties,
  type INodeType,
  type INodeTypeDescription,
  NodeConnectionTypes,
  NodeOperationError,
  type ResourceMapperValue,
} from 'n8n-workflow'
import { type MetaTable, matchFilter, valuesOf } from '../logic'
import { allRows, basedbRequest, getBases, getColumns, getTables, tableOf } from '../transport'

/**
 * The rows of a basedb table, read and written from a workflow — with the rights of the
 * integration token, never more. The base, the table and its fields are those the token
 * sees; the values are converted to what each field takes (dates, lists, links).
 *
 * A token never deletes: there is no « Delete » here, and a workflow that must remove rows
 * does it from an automation of basedb, or marks them.
 */

/** What the matching fields mean, for an update and for a « Create or Update ». */
const MATCHING = {
  update: 'The row updated is the one whose fields hold these values — its ID, most often',
  upsert: 'A row whose fields hold these values is updated; with none, a row is added',
} as const

const mapper = (
  operation: 'create' | 'update' | 'upsert',
  description: string,
  matching = operation === 'create' ? '' : MATCHING[operation],
): INodeProperties => ({
  displayName: 'Fields',
  name: 'columns',
  type: 'resourceMapper',
  noDataExpression: true,
  default: { mappingMode: 'defineBelow', value: null },
  required: true,
  description,
  typeOptions: {
    loadOptionsDependsOn: ['base', 'table'],
    resourceMapper: {
      resourceMapperMethod: 'getColumns',
      mode: operation === 'create' ? 'add' : operation,
      fieldWords: { singular: 'field', plural: 'fields' },
      addAllFields: operation === 'create',
      multiKeyMatch: true,
      supportAutoMap: true,
      ...(operation === 'create'
        ? {}
        : {
            matchingFieldsLabels: {
              title: 'Fields to match on',
              description: matching,
              hint: matching,
            },
          }),
    },
  },
  displayOptions: { show: { resource: ['row'], operation: [operation] } },
})

export class Basedb implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'basedb',
    name: 'basedb',
    icon: 'file:basedb.svg',
    group: ['transform'],
    version: 1,
    subtitle:
      '={{ ($parameter["resource"] === "comment" ? "Comment" : { create: "Create", upsert: "Create or update", get: "Get", getAll: "Get many", update: "Update" }[$parameter["operation"]]) + ": " + $parameter["table"] }}',
    description: 'Read and write the rows of a basedb table',
    defaults: { name: 'basedb' },
    usableAsTool: true,
    inputs: [NodeConnectionTypes.Main],
    outputs: [NodeConnectionTypes.Main],
    credentials: [{ name: 'basedbApi', required: true }],
    properties: [
      {
        displayName: 'Resource',
        name: 'resource',
        type: 'options',
        noDataExpression: true,
        options: [
          { name: 'Row', value: 'row' },
          { name: 'Comment', value: 'comment' },
        ],
        default: 'row',
      },
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['row'] } },
        options: [
          {
            name: 'Create',
            value: 'create',
            action: 'Create a row',
            description: 'Add a row to a table',
          },
          {
            name: 'Create or Update',
            value: 'upsert',
            action: 'Create or update a row',
            description: 'Update the row whose fields match, or add it when none does',
          },
          { name: 'Get', value: 'get', action: 'Get a row', description: 'Read one row by its ID' },
          {
            name: 'Get Many',
            value: 'getAll',
            action: 'Get many rows',
            description: 'Read the rows a filter keeps, in the order asked',
          },
          {
            name: 'Update',
            value: 'update',
            action: 'Update a row',
            description: 'Change fields of a row',
          },
        ],
        default: 'getAll',
      },
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['comment'] } },
        options: [
          {
            name: 'Create',
            value: 'create',
            action: 'Comment on a row',
            description: 'Add a comment to a row — @mentions notify',
          },
        ],
        default: 'create',
      },
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
      ...(['row', 'comment'] as const).map(
        (resource): INodeProperties => ({
          displayName: 'Row ID',
          name: 'id',
          type: 'string',
          default: '',
          required: true,
          placeholder: '0195e3c2-…',
          description: 'The _ID of the row',
          displayOptions: {
            show: { resource: [resource], operation: [resource === 'row' ? 'get' : 'create'] },
          },
        }),
      ),
      mapper('create', 'The values of the new row'),
      mapper('update', 'The row to update, and the values to write'),
      mapper('upsert', 'The fields that find the row, and the values to write'),
      {
        displayName: 'Return All',
        name: 'returnAll',
        type: 'boolean',
        default: false,
        description: 'Whether to return all results or only up to a given limit',
        displayOptions: { show: { resource: ['row'], operation: ['getAll'] } },
      },
      {
        displayName: 'Limit',
        name: 'limit',
        type: 'number',
        typeOptions: { minValue: 1 },
        default: 50,
        description: 'Max number of results to return',
        displayOptions: { show: { resource: ['row'], operation: ['getAll'], returnAll: [false] } },
      },
      {
        displayName: 'Filter',
        name: 'filter',
        type: 'string',
        default: '',
        placeholder: 'statut eq "gagne" and montant gte 10000',
        description:
          'basedb’s filter, with the technical names of the fields: eq, ne, contains, starts_with, in, is_null, gt, gte, lt, lte, between, joined by and, or, not',
        displayOptions: { show: { resource: ['row'], operation: ['getAll'] } },
      },
      {
        displayName: 'Sort',
        name: 'sort',
        type: 'string',
        default: '',
        placeholder: '-montant,nom',
        description: 'Technical names separated by commas; a minus sign sorts descending',
        displayOptions: { show: { resource: ['row'], operation: ['getAll'] } },
      },
      {
        displayName: 'Options',
        name: 'options',
        type: 'collection',
        placeholder: 'Add option',
        default: {},
        displayOptions: { show: { resource: ['row'], operation: ['get', 'getAll'] } },
        options: [
          {
            displayName: 'Links',
            name: 'links',
            type: 'options',
            default: 'display',
            options: [
              {
                name: 'ID and Display Value',
                value: 'display',
                description: 'Each linked row as { ID, display }',
              },
              { name: 'ID Only', value: 'id', description: 'Faster, for a synchronisation' },
            ],
          },
          {
            displayName: 'Numbers as Numbers',
            name: 'numbers',
            type: 'boolean',
            default: false,
            description:
              'Whether to turn numbers into JavaScript numbers. basedb sends them as decimal text so that no digit is lost: keep it off for amounts to the cent.',
          },
        ],
      },
      {
        displayName: 'Comment',
        name: 'body',
        type: 'string',
        typeOptions: { rows: 3 },
        default: '',
        required: true,
        description: 'The text of the comment',
        displayOptions: { show: { resource: ['comment'], operation: ['create'] } },
      },
    ],
  }

  methods = {
    loadOptions: { getBases, getTables },
    resourceMapping: { getColumns },
  }

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData()
    const out: INodeExecutionData[] = []
    // The description of each table once per run, not once per item.
    const tables = new Map<string, MetaTable>()
    const describe = async (base: string, table: string) => {
      const key = `${base}/${table}`
      let found = tables.get(key)
      if (found === undefined) {
        found = await tableOf.call(this, base, table)
        tables.set(key, found)
      }
      return found
    }

    for (let i = 0; i < items.length; i++) {
      try {
        const resource = this.getNodeParameter('resource', i) as 'row' | 'comment'
        const operation = this.getNodeParameter('operation', i) as string
        const base = this.getNodeParameter('base', i) as string
        const table = this.getNodeParameter('table', i) as string
        const path = `/data/${encodeURIComponent(base)}/${encodeURIComponent(table)}`
        const rows = await run.call(this, i, { resource, operation, base, table, path, describe })
        out.push(
          ...rows.map((json) => ({ json, pairedItem: { item: i } }) satisfies INodeExecutionData),
        )
      } catch (error) {
        if (!this.continueOnFail()) throw error
        out.push({ json: { error: (error as Error).message }, pairedItem: { item: i } })
      }
    }
    return [out]
  }
}

interface Target {
  readonly resource: 'row' | 'comment'
  readonly operation: string
  readonly base: string
  readonly table: string
  readonly path: string
  readonly describe: (base: string, table: string) => Promise<MetaTable>
}

/** Numbers as JavaScript numbers, when the workflow prefers them to basedb's decimal text. */
function withNumbers(row: IDataObject, table: MetaTable): IDataObject {
  const out: IDataObject = { ...row }
  for (const f of table.fields) {
    const v = row[f.name]
    if (f.kind === 'number' && typeof v === 'string' && v !== '') out[f.name] = Number(v)
  }
  return out
}

async function run(this: IExecuteFunctions, i: number, t: Target): Promise<IDataObject[]> {
  const id = encodeURIComponent(String(this.getNodeParameter('id', i, '')).trim())

  if (t.resource === 'comment') {
    const body = this.getNodeParameter('body', i) as string
    const answer = (await basedbRequest.call(this, 'POST', `${t.path}/${id}/comments`, {
      body: { body },
    })) as { data: IDataObject }
    return [answer.data]
  }

  switch (t.operation) {
    case 'get':
    case 'getAll': {
      const options = this.getNodeParameter('options', i, {}) as {
        links?: string
        numbers?: boolean
      }
      const qs: IDataObject = { links: options.links ?? 'display' }
      let rows: IDataObject[]
      if (t.operation === 'get') {
        const answer = (await basedbRequest.call(this, 'GET', `${t.path}/${id}`, { qs })) as {
          data: IDataObject
        }
        rows = [answer.data]
      } else {
        const filter = (this.getNodeParameter('filter', i, '') as string).trim()
        const sort = (this.getNodeParameter('sort', i, '') as string).trim()
        const returnAll = this.getNodeParameter('returnAll', i, false) as boolean
        const limit = returnAll
          ? Number.POSITIVE_INFINITY
          : (this.getNodeParameter('limit', i) as number)
        rows = await allRows.call(
          this,
          t.base,
          t.table,
          { ...qs, ...(filter === '' ? {} : { filter }), ...(sort === '' ? {} : { sort }) },
          limit,
        )
      }
      if (options.numbers !== true) return rows
      const table = await t.describe(t.base, t.table)
      return rows.map((r) => withNumbers(r, table))
    }

    case 'create':
    case 'update':
    case 'upsert': {
      const table = await t.describe(t.base, t.table)
      const mapping = this.getNodeParameter('columns', i) as ResourceMapperValue
      const mapped: Record<string, unknown> =
        mapping.mappingMode === 'autoMapInputData'
          ? { ...this.getInputData()[i].json }
          : { ...(mapping.value ?? {}) }
      const matching = mapping.matchingColumns ?? []

      if (t.operation === 'create') {
        const answer = (await basedbRequest.call(this, 'POST', t.path, {
          body: { values: valuesOf(table, mapped) as IDataObject },
        })) as { data: IDataObject }
        return [answer.data]
      }

      if (matching.length === 0) {
        throw new NodeOperationError(this.getNode(), 'Choose the fields to match on', {
          itemIndex: i,
        })
      }
      // The row by its ID needs no search.
      const byId = matching.length === 1 && matching[0] === '_id'
      const found = byId
        ? [{ _id: String(mapped._id ?? '').trim() }]
        : await allRows.call(
            this,
            t.base,
            t.table,
            { filter: matchFilter(table, matching, mapped), links: 'id' },
            2,
          )
      if (found.length > 1) {
        throw new NodeOperationError(
          this.getNode(),
          'Several rows match: choose fields to match on that only one row holds',
          { itemIndex: i, description: `Filter: ${matchFilter(table, matching, mapped)}` },
        )
      }
      const row = found[0]
      if (row === undefined || row._id === '') {
        if (t.operation === 'update') {
          throw new NodeOperationError(this.getNode(), 'No row matches', {
            itemIndex: i,
            description: `Filter: ${matchFilter(table, matching, mapped)}`,
          })
        }
        const answer = (await basedbRequest.call(this, 'POST', t.path, {
          body: { values: valuesOf(table, mapped) as IDataObject },
        })) as { data: IDataObject }
        return [answer.data]
      }
      const answer = (await basedbRequest.call(
        this,
        'PATCH',
        `${t.path}/${encodeURIComponent(String(row._id))}`,
        { body: { values: valuesOf(table, mapped, matching) as IDataObject } },
      )) as { data: IDataObject }
      return [answer.data]
    }

    default:
      throw new NodeOperationError(this.getNode(), `Unknown operation "${t.operation}"`, {
        itemIndex: i,
      })
  }
}
