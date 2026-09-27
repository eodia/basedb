'use client'

import { FieldIcon } from '@/components/app/field-icon'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { Field } from '@/lib/api/client'
import { $t } from '@/lib/i18n'
import { isBlankHtml, pillsToVariables, variablesToPills } from '@/lib/rich-text'
import { cn } from '@/lib/utils'
import {
  type Editor,
  EditorContent,
  Extension,
  Node,
  mergeAttributes,
  useEditor,
} from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {
  Bold,
  Braces,
  Code,
  Heading2,
  Italic,
  Link2,
  List,
  ListOrdered,
  type LucideIcon,
  Minus,
  Quote,
  Strikethrough,
  Underline,
} from 'lucide-react'
import {
  Fragment,
  type ReactNode,
  createElement,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

/**
 * The editor of a rich text — the HTML variant of a long text (chapter 04 §2.2), and of
 * nothing else.
 *
 * Its schema IS the profile the server enforces: paragraphs and headings, bold, italic,
 * underline, strikethrough, lists, quotes, code, links and rules. What cannot be stored is
 * not offered — no image, no table, no colour — so a person never writes something the
 * server would silently drop.
 *
 * A column of the row can be cited: `{{nom}}` in the stored HTML, a pill here, the row's
 * value wherever the text is read (chapter 04 §2.2, « Variables »).
 */

/** The typography of a rich text, the same in the editor and wherever it is read. */
export const RICH_TEXT_CLASSES = cn(
  'text-sm leading-relaxed break-words',
  '[&_p]:my-1.5 [&_h1]:mt-3 [&_h1]:mb-1.5 [&_h1]:text-lg [&_h1]:font-semibold',
  '[&_h2]:mt-3 [&_h2]:mb-1 [&_h2]:text-base [&_h2]:font-semibold',
  '[&_h3]:mt-2 [&_h3]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold',
  '[&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5',
  '[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground',
  '[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:font-mono [&_code]:text-[0.85em]',
  '[&_pre]:my-2 [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-2 [&_pre_code]:bg-transparent [&_pre_code]:p-0',
  '[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2',
  '[&_hr]:my-3 [&_hr]:border-border',
  '[&_[data-variable]]:rounded [&_[data-variable]]:bg-primary/10 [&_[data-variable]]:px-1 [&_[data-variable]]:py-px [&_[data-variable]]:font-medium [&_[data-variable]]:text-primary',
)

/** A column cited in the text: an atom, shown by its label, kept by its physical name. */
const Variable = Node.create<{ labelOf: (name: string) => string }>({
  name: 'variable',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addOptions() {
    return { labelOf: (name: string) => name }
  },
  addAttributes() {
    return {
      name: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-variable'),
        renderHTML: (attributes) => ({ 'data-variable': attributes.name }),
      },
    }
  },
  parseHTML() {
    return [{ tag: 'span[data-variable]' }]
  },
  renderHTML({ node, HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes), this.options.labelOf(node.attrs.name)]
  },
  renderText({ node }) {
    return `{{${node.attrs.name}}}`
  },
})

/**
 * Ctrl+Entrée saves. Before the line break that StarterKit binds to the same keys: a save
 * that also wrote a `<br>` into the text would store one more line each time.
 */
const Submit = Extension.create<{ submit: () => boolean }>({
  name: 'submit',
  priority: 1000,
  addOptions() {
    return { submit: () => false }
  },
  addKeyboardShortcuts() {
    return { 'Mod-Enter': () => this.options.submit() }
  },
})

/** What the editor holds, as the API takes it: variables as `{{nom}}`, nothing when blank. */
function stored(editor: Editor): string {
  const html = editor.getHTML()
  return isBlankHtml(html) ? '' : pillsToVariables(html)
}

export function RichTextEditor({
  value,
  onChange,
  fields = [],
  autoFocus = false,
  placeholder = $t('Écrire…'),
  className,
  contentClassName,
  onBlur,
  onSubmit,
  disabled = false,
}: {
  /** As stored: sanitized HTML, variables as `{{nom}}`. */
  readonly value: string
  readonly onChange: (next: string) => void
  /** The columns a variable may cite — none: no variable offered. */
  readonly fields?: readonly Field[]
  readonly autoFocus?: boolean
  readonly placeholder?: string
  readonly className?: string
  readonly contentClassName?: string
  readonly onBlur?: () => void
  /** Ctrl+Entrée. */
  readonly onSubmit?: () => void
  readonly disabled?: boolean
}) {
  // The labels are read through a ref: the extension is built once, the fields may change.
  const labels = useRef(fields)
  labels.current = fields
  const change = useRef(onChange)
  change.current = onChange
  const submit = useRef(onSubmit)
  submit.current = onSubmit
  // What the editor last handed out: a `value` equal to it is its own echo, not news.
  const echoed = useRef(value)

  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,
    autofocus: autoFocus ? 'end' : false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: {
          openOnClick: false,
          // Off: it makes the link mark inclusive, and what is typed right after a link
          // would become part of it. A pasted address still becomes a link.
          autolink: false,
          protocols: ['mailto'],
          HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' },
        },
      }),
      Variable.configure({
        labelOf: (name) => labels.current.find((f) => f.name === name)?.label ?? name,
      }),
      // A function, not the ref: `configure` copies the objects it is given, and a copied
      // ref would keep the handler of the first render — and its stale draft.
      Submit.configure({
        submit: () => {
          const run = submit.current
          if (run === undefined) return false
          run()
          return true
        },
      }),
    ],
    content: variablesToPills(value),
    editorProps: {
      attributes: {
        class: cn(
          RICH_TEXT_CLASSES,
          'min-h-24 px-3 py-2 outline-none [&_p.is-editor-empty:first-child]:before:pointer-events-none',
          contentClassName,
        ),
        'aria-label': placeholder,
        'data-placeholder': placeholder,
      },
    },
    onUpdate: ({ editor: current }) => {
      const next = stored(current)
      echoed.current = next
      change.current(next)
    },
    onBlur: () => onBlur?.(),
  })

  // A value from outside — another row opened, a refusal rolled back — replaces the text.
  useEffect(() => {
    if (editor === null || value === echoed.current) return
    echoed.current = value
    editor.commands.setContent(variablesToPills(value), { emitUpdate: false })
  }, [editor, value])

  useEffect(() => {
    editor?.setEditable(!disabled)
  }, [editor, disabled])

  return (
    <div
      className={cn(
        'overflow-hidden rounded-md border bg-background focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/25',
        disabled && 'opacity-60',
        className,
      )}
    >
      {editor !== null && !disabled && <Toolbar editor={editor} fields={fields} />}
      <EditorContent editor={editor} />
    </div>
  )
}

function Toolbar({
  editor,
  fields,
}: { readonly editor: Editor; readonly fields: readonly Field[] }) {
  return (
    <div
      role="toolbar"
      aria-label={$t('Mise en forme')}
      className="flex flex-wrap items-center gap-0.5 border-b bg-muted/40 px-1.5 py-1"
    >
      <Tool
        icon={Bold}
        label={$t('Gras')}
        active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
      />
      <Tool
        icon={Italic}
        label={$t('Italique')}
        active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      />
      <Tool
        icon={Underline}
        label={$t('Souligné')}
        active={editor.isActive('underline')}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      />
      <Tool
        icon={Strikethrough}
        label={$t('Barré')}
        active={editor.isActive('strike')}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      />
      <Separator />
      <Tool
        icon={Heading2}
        label={$t('Titre')}
        active={editor.isActive('heading', { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      />
      <Tool
        icon={List}
        label={$t('Liste à puces')}
        active={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      />
      <Tool
        icon={ListOrdered}
        label={$t('Liste numérotée')}
        active={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      />
      <Tool
        icon={Quote}
        label={$t('Citation')}
        active={editor.isActive('blockquote')}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      />
      <Tool
        icon={Code}
        label={$t('Code')}
        active={editor.isActive('code')}
        onClick={() => editor.chain().focus().toggleCode().run()}
      />
      <LinkTool editor={editor} />
      <Tool
        icon={Minus}
        label={$t('Séparateur||trait horizontal dans un texte')}
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      />
      {fields.length > 0 && (
        <>
          <Separator />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs">
                <Braces className="size-3.5" />
                {$t('Colonne')}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="max-h-72 overflow-y-auto"
              // The person was writing: the caret goes back to the text, not to the button.
              onCloseAutoFocus={(e) => {
                e.preventDefault()
                editor.commands.focus()
              }}
            >
              {fields.map((f) => (
                <DropdownMenuItem
                  key={f.name}
                  onSelect={() =>
                    editor
                      .chain()
                      .focus()
                      .insertContent([
                        { type: 'variable', attrs: { name: f.name } },
                        { type: 'text', text: ' ' },
                      ])
                      .run()
                  }
                >
                  <FieldIcon kind={f.kind} format={f.format?.display} />
                  {f.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}
    </div>
  )
}

function Separator() {
  return <span aria-hidden className="mx-0.5 h-4 w-px bg-border" />
}

function Tool({
  icon: Icon,
  label,
  active = false,
  onClick,
}: {
  readonly icon: LucideIcon
  readonly label: string
  readonly active?: boolean
  readonly onClick: () => void
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          aria-pressed={active}
          // The editor keeps its selection: a button that took the focus would lose it.
          onMouseDown={(e) => e.preventDefault()}
          onClick={onClick}
          className={cn('size-7', active && 'bg-accent text-foreground')}
        >
          <Icon className="size-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

/** A link on the selection: typed, or taken off. Only `http`, `https` and `mailto` stay. */
function LinkTool({ editor }: { readonly editor: Editor }) {
  const [open, setOpen] = useState(false)
  const [href, setHref] = useState('')
  const active = editor.isActive('link')

  const apply = () => {
    const url = href.trim()
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
    } else {
      const full = /^(https?:|mailto:)/i.test(url) ? url : `https://${url}`
      editor.chain().focus().extendMarkRange('link').setLink({ href: full }).run()
    }
    setOpen(false)
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setHref((editor.getAttributes('link').href as string | undefined) ?? '')
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={$t('Lien')}
          aria-pressed={active}
          onMouseDown={(e) => e.preventDefault()}
          className={cn('size-7', active && 'bg-accent text-foreground')}
        >
          <Link2 className="size-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2">
        <form
          className="flex gap-1.5"
          onSubmit={(e) => {
            e.preventDefault()
            apply()
          }}
        >
          <Input
            value={href}
            onChange={(e) => setHref(e.target.value)}
            placeholder="https://… ou mailto:…"
            aria-label={$t('Adresse du lien')}
            className="h-8"
            autoFocus
          />
          <Button type="submit" size="sm" className="h-8">
            {href.trim() === '' && active ? $t('Retirer') : $t('OK')}
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  )
}

// ── Reading ──────────────────────────────────────────────────────────────────────────

/** What a rich text may hold: the profile the server stores (chapter 04 §2.2). */
const SHOWN = new Set([
  'p',
  'br',
  'strong',
  'em',
  'u',
  's',
  'ul',
  'ol',
  'li',
  'blockquote',
  'code',
  'pre',
  'h1',
  'h2',
  'h3',
  'a',
  'hr',
])

const TEXT_NODE = 3
const ELEMENT_NODE = 1

/**
 * One node of a parsed rich text, as React elements — the allowed tags and nothing else,
 * links with a safe scheme only. The server already stores the sanitized form; rebuilding
 * it element by element rather than injecting it keeps a second, independent barrier.
 */
function toReact(node: ChildNode, key: number): ReactNode {
  if (node.nodeType === TEXT_NODE) return node.textContent
  if (node.nodeType !== ELEMENT_NODE) return null
  const element = node as Element
  const tag = element.tagName.toLowerCase()
  const children = [...element.childNodes].map(toReact)
  if (!SHOWN.has(tag)) return <Fragment key={key}>{children}</Fragment>
  if (tag === 'br' || tag === 'hr') return createElement(tag, { key })
  if (tag === 'a') {
    const href = element.getAttribute('href') ?? ''
    return (
      <a
        key={key}
        href={/^(https?:|mailto:)/i.test(href) ? href : undefined}
        target="_blank"
        rel="noopener noreferrer nofollow"
      >
        {children}
      </a>
    )
  }
  return createElement(tag, { key }, ...children)
}

/** A rich text, read — in the same typography as its editor. */
export function RichTextView({
  html,
  className,
}: { readonly html: string; readonly className?: string }) {
  const nodes = useMemo(() => {
    if (typeof window === 'undefined') return null
    const body = new DOMParser().parseFromString(html, 'text/html').body
    return [...body.childNodes].map(toReact)
  }, [html])
  return <div className={cn(RICH_TEXT_CLASSES, className)}>{nodes}</div>
}
