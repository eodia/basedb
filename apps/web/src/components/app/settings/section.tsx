/**
 * The pieces every tab of the settings is drawn with — kept apart from the panel, which
 * imports the tabs: a tab importing the panel back would close a loop.
 */

/** What came back from a provider after a link was asked for, said once on the profile. */
export interface LinkNotice {
  readonly ok: boolean
  readonly text: string
}

/** The head of a tab: what it is, in a sentence. */
export function TabHeading({
  title,
  children,
}: {
  readonly title: string
  readonly children: React.ReactNode
}) {
  return (
    <div>
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  )
}

/** One setting, or one family of them: a bordered block with a title and a line under it. */
export function SettingsSection({
  title,
  description,
  action,
  children,
}: {
  readonly title: string
  readonly description?: React.ReactNode
  /** Drawn at the right of the title — a switch, a button. */
  readonly action?: React.ReactNode
  readonly children?: React.ReactNode
}) {
  return (
    <section className="rounded-lg border p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-sm font-medium">{title}</h2>
          {description !== undefined && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {action}
      </div>
      {children !== undefined && <div className="mt-4">{children}</div>}
    </section>
  )
}

/** A refusal, said where the act was attempted. */
export function Refusal({ children }: { readonly children: React.ReactNode }) {
  return (
    <p role="alert" className="animate-shake text-sm text-destructive">
      {children}
    </p>
  )
}
