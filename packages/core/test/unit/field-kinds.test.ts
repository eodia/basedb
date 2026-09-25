import { describe, expect, it } from 'vitest'
import { MAX_FILES_PER_VALUE, choiceCheck, fileShapeCheck, pgTypeOf } from '../../src/ddl/emit.js'
import type { BasedbError } from '../../src/errors/index.js'
import { cleanFileName, fileLink, sniffType } from '../../src/files/operations.js'
import { signV4 } from '../../src/files/storage.js'
import {
  type FilterableColumn,
  buildFilter,
  buildSort,
  operatorsFor,
  sortableKind,
} from '../../src/records/filter.js'
import { shapeChoices } from '../../src/records/values.js'

/**
 * The multiple choice and the two file kinds — chapter 04 §3 and §3 bis.
 *
 * What the database holds (`text[]`, `jsonb`, and the `CHECK` of each), what a filter may
 * ask of them, and the pieces of the file path that need no database to be wrong.
 */

const COLUMNS = new Map<string, FilterableColumn>([
  ['tags', { name: 'tags', kind: 'multi_select' }],
  ['pieces', { name: 'pieces', kind: 'file' }],
  ['photos', { name: 'photos', kind: 'image' }],
])

function codeOf(fn: () => unknown): string {
  try {
    fn()
  } catch (e) {
    return (e as BasedbError).code
  }
  throw new Error('no error raised')
}

describe('column types', () => {
  it('a multiple choice is a text array, a list of files a jsonb', () => {
    expect(pgTypeOf('multi_select')).toBe('text[]')
    expect(pgTypeOf('file')).toBe('jsonb')
    expect(pgTypeOf('image')).toBe('jsonb')
  })

  it('holds a multiple choice to its list, and refuses the empty and the nested array', () => {
    expect(choiceCheck('multi_select', '"tags"', ['a', "l'été"])).toBe(
      `cardinality("tags") > 0 AND array_ndims("tags") = 1 AND "tags" <@ ARRAY['a', 'l''été']::text[]`,
    )
    // The single choice keeps the `IN` it always had.
    expect(choiceCheck('select', '"statut"', ['a', 'b'])).toBe(`"statut" IN ('a', 'b')`)
  })

  it('holds a list of files to an array of 1 to 20 entries, without raising on a scalar', () => {
    const check = fileShapeCheck('"pieces"')
    expect(check).toContain('jsonb_typeof("pieces") = \'array\'')
    expect(check).toContain(`BETWEEN 1 AND ${MAX_FILES_PER_VALUE}`)
    // NULL passes — every existing row is NULL when the column is added — and then a
    // CASE, never an AND: `jsonb_array_length` raises on a scalar.
    expect(check.startsWith('"pieces" IS NULL OR CASE WHEN')).toBe(true)
  })
})

describe('filters on a multiple choice', () => {
  it('offers has_any, has_all and is_null — and nothing that compares the whole list', () => {
    expect(operatorsFor('multi_select')).toEqual(['has_any', 'has_all', 'is_null'])
    expect(codeOf(() => buildFilter('tags eq "a"', COLUMNS))).toBe('FILTER_OPERATOR_INVALID')
    expect(codeOf(() => buildFilter('tags in ["a"]', COLUMNS))).toBe('FILTER_OPERATOR_INVALID')
  })

  it('translates has_any to && and has_all to @>, the values bound as one array', () => {
    const any = buildFilter('tags has_any ["urgent", "client"]', COLUMNS)
    expect(any.sql).toBe('"tags" && $1::text[]')
    expect(any.params).toEqual([['urgent', 'client']])

    const all = buildFilter('tags has_all ["urgent", "client"]', COLUMNS)
    expect(all.sql).toBe('"tags" @> $1::text[]')
  })

  it('reads a single value as a list of one', () => {
    const { sql, params } = buildFilter('tags has_any "urgent"', COLUMNS)
    expect(sql).toBe('"tags" && $1::text[]')
    expect(params).toEqual([['urgent']])
  })

  it('writes "holds none of" as the negation of has_any', () => {
    const { sql } = buildFilter('not tags has_any ["a"]', COLUMNS)
    expect(sql).toBe('NOT ("tags" && $1::text[])')
  })

  it('refuses an empty list rather than matching nothing, or everything', () => {
    expect(codeOf(() => buildFilter('tags has_all []', COLUMNS))).toBe('REQUEST_INVALID')
  })
})

describe('filters and sorting on files', () => {
  it('a list of files is present or absent, and nothing else', () => {
    expect(operatorsFor('file')).toEqual(['is_null'])
    expect(operatorsFor('image')).toEqual(['is_null'])
    expect(buildFilter('not pieces is_null', COLUMNS).sql).toBe('NOT ("pieces" IS NULL)')
    expect(codeOf(() => buildFilter('pieces contains "a"', COLUMNS))).toBe(
      'FILTER_OPERATOR_INVALID',
    )
  })

  it('no list is sortable: its order is not one a reader would recognise', () => {
    for (const kind of ['multi_select', 'file', 'image'] as const) {
      expect(sortableKind(kind)).toBe(false)
    }
    expect(codeOf(() => buildSort('tags', COLUMNS))).toBe('SORT_UNAVAILABLE')
    expect(codeOf(() => buildSort('-photos', COLUMNS))).toBe('SORT_UNAVAILABLE')
  })
})

describe('writing a multiple choice', () => {
  it('drops repeats and blanks, keeping the first-seen order', () => {
    expect(shapeChoices('tags', ['b', 'a', 'b', ' ', 'a '])).toEqual(['b', 'a'])
  })

  it('writes empty as NULL, so that "required" means at least one value', () => {
    expect(shapeChoices('tags', [])).toBeNull()
    expect(shapeChoices('tags', '')).toBeNull()
    expect(shapeChoices('tags', null)).toBeNull()
  })

  it('reads a lone string as a list of one', () => {
    expect(shapeChoices('tags', 'urgent')).toEqual(['urgent'])
  })

  it('refuses what is not a list of texts', () => {
    expect(codeOf(() => shapeChoices('tags', [1, 2]))).toBe('VALUE_INVALID')
    expect(codeOf(() => shapeChoices('tags', { a: 1 }))).toBe('VALUE_INVALID')
  })
})

describe('files', () => {
  const bytes = (...values: number[]) => new Uint8Array(values)
  const text = (s: string) => new TextEncoder().encode(s)

  it('finds a picture type from the bytes, whatever the name says', () => {
    expect(sniffType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe('image/png')
    expect(sniffType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg')
    expect(sniffType(text('GIF89a……'))).toBe('image/gif')
    expect(sniffType(text('RIFF\u0000\u0000\u0000\u0000WEBPVP8 '))).toBe('image/webp')
    expect(sniffType(text('%PDF-1.7'))).toBe('application/pdf')
  })

  it('does not take an SVG or an HTML page for a picture', () => {
    expect(sniffType(text('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>'))).toBeNull()
    expect(sniffType(text('<!doctype html><script>alert(1)</script>'))).toBeNull()
  })

  it('keeps the name a person gave, minus directories and control characters', () => {
    expect(cleanFileName('C:\\Users\\moi\\Devis été.pdf')).toBe('Devis été.pdf')
    expect(cleanFileName('../../etc/passwd')).toBe('passwd')
    expect(cleanFileName('a\u0000b\nc.txt')).toBe('abc.txt')
    expect(cleanFileName('   ')).toBe('fichier')
    expect(cleanFileName('..')).toBe('fichier')
    expect([...cleanFileName('é'.repeat(400))].length).toBe(255)
  })

  it('mints the same link all through a six-hour window, so a browser can cache it', () => {
    const key = Buffer.alloc(32, 7)
    const file = { id: '0192a3b4-c5d6-7e8f-9a0b-1c2d3e4f5a6b', name: 'devis été.pdf' }
    const a = fileLink(key, 't1', file, new Date('2026-09-25T06:00:01Z'))
    const b = fileLink(key, 't1', file, new Date('2026-09-25T11:59:59Z'))
    const c = fileLink(key, 't1', file, new Date('2026-09-25T12:00:01Z'))
    expect(a).toBe(b)
    expect(c).not.toBe(a)
    expect(a).toMatch(
      /^\/api\/v1\/t1\/files\/0192a3b4-c5d6-7e8f-9a0b-1c2d3e4f5a6b\/devis%20%C3%A9t%C3%A9\.pdf\?exp=\d+&sig=[\w-]{32}$/,
    )
    // Another tenant, another signature: a link does not travel across tenants.
    expect(fileLink(key, 't2', file, new Date('2026-09-25T06:00:01Z')).split('sig=')[1]).not.toBe(
      a.split('sig=')[1],
    )
  })
})

describe('S3 signature (AWS Signature Version 4)', () => {
  it('matches the GET Object example of the AWS documentation', () => {
    // docs.aws.amazon.com — "Signature Calculations for the Authorization Header",
    // example "GET Object".
    const headers = signV4({
      method: 'GET',
      url: new URL('https://examplebucket.s3.amazonaws.com/test.txt'),
      region: 'us-east-1',
      accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
      secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      payloadHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      extra: { range: 'bytes=0-9' },
      now: new Date('2013-05-24T00:00:00Z'),
    })
    expect(headers.authorization).toBe(
      'AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request, SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41',
    )
    expect(headers['x-amz-date']).toBe('20130524T000000Z')
    // `host` is signed but not sent: `fetch` sets it from the URL.
    expect(headers.host).toBeUndefined()
  })
})
