import { OPERATORS } from '@basedb/core'
import { parameterInvalid } from './errors.js'

/**
 * Stage 1 of validation — chapter 09 §14.2.
 *
 * JSON types, cardinalities and the input bounds of §11.1, checked WITHOUT ANY ACCESS TO
 * THE CATALOG. The order is the decision: validating a field name before the right to
 * read its table is established would turn a help message into an existence oracle. What
 * needs the catalog — does this field exist, may it be expanded, does this value fit its
 * type — is stage 2, and belongs to the kernel.
 */

/** §11.1, one place. */
export const INPUT_BOUNDS = {
  name: 128,
  valuesKeys: 100,
  textBytes: 32 * 1024,
  predicates: 10,
  inValues: 100,
  sort: 3,
  select: 100,
  fullFields: 3,
  expand: 5,
  expandFields: 25,
  idempotencyKey: 64,
  lookupValue: 1024,
  cursor: 4096,
} as const

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Collects every stage-1 fault of one call, then refuses them together. */
export class Checker {
  private readonly faults: string[] = []

  constructor(private readonly params: Readonly<Record<string, unknown>>) {}

  /** Parameters the tool does not declare are refused, not ignored. */
  only(allowed: readonly string[]): this {
    for (const key of Object.keys(this.params)) {
      if (!allowed.includes(key)) this.faults.push(key)
    }
    return this
  }

  private fault(path: string): undefined {
    this.faults.push(path)
    return undefined
  }

  name(key: string, required = true): string | undefined {
    const v = this.params[key]
    if (v === undefined) return required ? this.fault(key) : undefined
    if (typeof v !== 'string' || v.trim() === '' || v.length > INPUT_BOUNDS.name) {
      return this.fault(key)
    }
    return v
  }

  uuid(key: string): string | undefined {
    const v = this.params[key]
    if (typeof v !== 'string' || !UUID.test(v)) return this.fault(key)
    return v
  }

  string(key: string, max: number, required = false): string | undefined {
    const v = this.params[key]
    if (v === undefined) return required ? this.fault(key) : undefined
    if (typeof v !== 'string' || v.length > max || (required && v === '')) return this.fault(key)
    return v
  }

  integer(key: string, min: number, max: number): number | undefined {
    const v = this.params[key]
    if (v === undefined) return undefined
    if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) return this.fault(key)
    return v
  }

  boolean(key: string): boolean | undefined {
    const v = this.params[key]
    if (v === undefined) return undefined
    if (typeof v !== 'boolean') return this.fault(key)
    return v
  }

  names(key: string, max: number): string[] | undefined {
    const v = this.params[key]
    if (v === undefined) return undefined
    if (!Array.isArray(v) || v.length > max) return this.fault(key)
    for (const [i, item] of v.entries()) {
      if (typeof item !== 'string' || item === '' || item.length > INPUT_BOUNDS.name * 2) {
        return this.fault(`${key}[${i}]`)
      }
    }
    return v as string[]
  }

  /** `{"<field>": {"op": …, "value": …}}` — at most ten predicates, depth one. */
  filter(key: string): Record<string, { op: string; value?: unknown }> | undefined {
    const v = this.params[key]
    if (v === undefined) return undefined
    if (v === null || typeof v !== 'object' || Array.isArray(v)) return this.fault(key)
    const entries = Object.entries(v as Record<string, unknown>)
    if (entries.length > INPUT_BOUNDS.predicates) return this.fault(key)

    const out: Record<string, { op: string; value?: unknown }> = {}
    for (const [field, predicate] of entries) {
      const path = `${key}.${field}`
      if (field === '' || field.length > INPUT_BOUNDS.name) {
        this.fault(path)
        continue
      }
      if (predicate === null || typeof predicate !== 'object' || Array.isArray(predicate)) {
        this.fault(path)
        continue
      }
      const { op, value, ...rest } = predicate as { op?: unknown; value?: unknown }
      if (Object.keys(rest).length > 0) this.fault(path)
      if (typeof op !== 'string' || !(OPERATORS as readonly string[]).includes(op)) {
        this.fault(`${path}.op`)
        continue
      }
      if (!this.predicateValue(op, value)) {
        this.fault(`${path}.value`)
        continue
      }
      out[field] = { op, ...(value === undefined ? {} : { value }) }
    }
    return out
  }

  private predicateValue(op: string, value: unknown): boolean {
    const scalar = (x: unknown) =>
      (typeof x === 'string' && Buffer.byteLength(x) <= INPUT_BOUNDS.textBytes) ||
      typeof x === 'boolean' ||
      (typeof x === 'number' && Number.isFinite(x))
    if (op === 'is_null') return value === undefined || typeof value === 'boolean'
    if (op === 'in') {
      return Array.isArray(value) && value.length <= INPUT_BOUNDS.inValues && value.every(scalar)
    }
    if (op === 'between') return Array.isArray(value) && value.length === 2 && value.every(scalar)
    // A multiple choice is asked for one value, or for a list of them.
    if (op === 'has_any' || op === 'has_all') {
      return Array.isArray(value)
        ? value.length > 0 && value.length <= INPUT_BOUNDS.inValues && value.every(scalar)
        : scalar(value)
    }
    return scalar(value)
  }

  /**
   * `values`: at most a hundred keys, texts of 32 KiB at most, scalars or null — or a
   * list of texts, which is what a multiple choice holds.
   */
  values(key: string): Record<string, unknown> | undefined {
    const v = this.params[key]
    if (v === null || typeof v !== 'object' || Array.isArray(v)) return this.fault(key)
    const entries = Object.entries(v as Record<string, unknown>)
    if (entries.length === 0 || entries.length > INPUT_BOUNDS.valuesKeys) return this.fault(key)
    for (const [field, value] of entries) {
      const ok =
        field !== '' &&
        field.length <= INPUT_BOUNDS.name &&
        (value === null ||
          typeof value === 'boolean' ||
          (typeof value === 'number' && Number.isFinite(value)) ||
          (typeof value === 'string' && Buffer.byteLength(value) <= INPUT_BOUNDS.textBytes) ||
          (Array.isArray(value) &&
            value.length <= INPUT_BOUNDS.inValues &&
            value.every(
              (x) => typeof x === 'string' && Buffer.byteLength(x) <= INPUT_BOUNDS.textBytes,
            )))
      if (!ok) this.fault(`${key}.${field}`)
    }
    return v as Record<string, unknown>
  }

  /** Refuses the call if anything was faulted. */
  done(): void {
    if (this.faults.length > 0) throw parameterInvalid(this.faults)
  }
}

/** The arguments of a `tools/call`, which must be an object when present. */
export function argumentsOf(params: unknown): Record<string, unknown> {
  const args = (params as { arguments?: unknown } | undefined)?.arguments
  if (args === undefined || args === null) return {}
  if (typeof args !== 'object' || Array.isArray(args)) throw parameterInvalid(['arguments'])
  return args as Record<string, unknown>
}
