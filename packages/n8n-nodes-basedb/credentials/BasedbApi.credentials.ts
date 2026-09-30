import type {
  IAuthenticateGeneric,
  ICredentialTestRequest,
  ICredentialType,
  INodeProperties,
} from 'n8n-workflow'

/**
 * An integration token of basedb: it opens one base, reads its rows, and writes them when it
 * was created with write access — never more than the person who created it. Created in
 * basedb from the base's menu, « API et agents » › « Jetons API et MCP… ».
 */
export class BasedbApi implements ICredentialType {
  name = 'basedbApi'

  displayName = 'basedb API'

  documentationUrl = 'https://eodia.github.io/basedb/integrations/n8n/'

  icon = 'file:basedb.svg' as const

  properties: INodeProperties[] = [
    {
      displayName: 'Instance URL',
      name: 'url',
      type: 'string',
      default: '',
      placeholder: 'https://basedb.example.com',
      description: 'The address where you open basedb',
      required: true,
    },
    {
      displayName: 'Workspace',
      name: 'tenant',
      type: 'string',
      default: 't4z56fq',
      description:
        'The reference of the workspace, as it appears in the API addresses: /api/v1/<workspace>/…',
      required: true,
    },
    {
      displayName: 'Token',
      name: 'token',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      placeholder: 'bdb_…',
      description: 'An integration token, created in basedb from the menu of the base',
      required: true,
    },
  ]

  authenticate: IAuthenticateGeneric = {
    type: 'generic',
    properties: {
      headers: { Authorization: '=Bearer {{$credentials.token}}' },
    },
  }

  test: ICredentialTestRequest = {
    request: {
      baseURL: '={{$credentials.url.replace(/[/]+$/, "")}}/api/v1/{{$credentials.tenant}}',
      url: '/meta/bases',
    },
  }
}
