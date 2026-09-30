/** What `GET /meta/bases/<base>` describes (basedb chapter 08 §9): tables and their fields. */

export interface MetaField {
  readonly name: string
  readonly label: string
  readonly description: string | null
  readonly kind: string
  readonly required: boolean
  readonly read_only: boolean
  readonly system: boolean
  readonly operators?: readonly string[]
  readonly sortable?: boolean
  readonly ai?: boolean
  readonly options?: ReadonlyArray<{ readonly value: string; readonly label: string }>
  readonly format?: { readonly display: string; readonly currency: string | null }
  readonly computed?: { readonly result_kind: string; readonly multiple: boolean }
  readonly default?: unknown
  readonly link?: { readonly target?: string; readonly required: boolean }
}

export interface MetaTable {
  readonly id: string
  readonly name: string
  readonly label: string
  readonly description: string | null
  readonly actions: readonly string[]
  readonly synced?: boolean
  readonly fields: readonly MetaField[]
}

export interface MetaBase {
  readonly id: string
  readonly name: string
  readonly label: string
  readonly description: string | null
  readonly actions: readonly string[]
  readonly tables: readonly MetaTable[]
}

/** A base as `GET /meta/bases` lists it. */
export interface BaseSummary {
  readonly id: string
  readonly name: string
  readonly label: string
  readonly description: string | null
  readonly table_count: number
}

/** A person of the workspace — what a Person field holds. */
export interface Member {
  readonly id: string
  readonly display_name: string
  readonly email: string
  readonly disabled: boolean
}
