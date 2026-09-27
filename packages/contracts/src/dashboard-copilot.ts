import type {
  DashboardCard,
  DashboardParameter,
  DashboardTab,
  ParameterValue,
  QuestionQuery,
  Visualization,
} from './analytics.js'

/**
 * The copilot of the dashboards — chapter 18 §2.6: what it proposes, as the kernel hands it
 * over once checked, and as the screen applies it. Like the copilot of the tables (chapter
 * 12 §1.6), it proposes and the person applies: a question to look at, changes to a
 * dashboard, values for its filters. Nothing here writes.
 */

/** What a dashboard is made of: the three lists a save replaces. */
export interface DashboardContent {
  readonly tabs: readonly DashboardTab[]
  readonly cards: readonly DashboardCard[]
  readonly parameters: readonly DashboardParameter[]
}

/** One change of a proposal, said in a line. */
export interface DashboardChange {
  readonly kind:
    | 'add_card'
    | 'add_text'
    | 'update_card'
    | 'remove_card'
    | 'add_filter'
    | 'add_tab'
    | 'rename'
  readonly text: string
}

export type DashboardCopilotAction =
  | {
      /** A question to look at: drawn in the conversation, opened, or put on the dashboard. */
      readonly type: 'question'
      readonly label: string
      readonly query: QuestionQuery
      readonly visualization: Visualization
    }
  | {
      /**
       * Changes to the dashboard on screen, or a new one — checked by the kernel as a save
       * would be, and given whole: applying it is one save.
       */
      readonly type: 'dashboard'
      readonly target: 'current' | 'new'
      /** The dashboard changed, for `current`. */
      readonly dashboard: string | null
      /** Its version the changes were made on: applied to another, they would undo it. */
      readonly basedOn: string | null
      readonly label: string
      readonly description: string | null
      readonly changes: readonly DashboardChange[]
      readonly content: DashboardContent
    }
  | {
      /** Values for the filters on screen: nothing is saved, the cards read again. */
      readonly type: 'set_filters'
      readonly values: Readonly<Record<string, ParameterValue | null>>
      readonly changes: readonly string[]
    }

/** What was read to answer — shown to the person: it is what left for the provider. */
export interface DashboardCopilotRead {
  readonly kind: 'card' | 'question' | 'records' | 'sql'
  readonly table: string | null
  readonly text: string
  readonly rows: number
  readonly error: string | null
}

export interface DashboardCopilotAnswer {
  readonly message: string
  readonly actions: readonly DashboardCopilotAction[]
  readonly reads: readonly DashboardCopilotRead[]
  /** Proposals the kernel set aside, and why. */
  readonly dropped: readonly string[]
}
