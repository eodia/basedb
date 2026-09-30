'use client'

import { cn } from '@/lib/utils'
import { type ReactNode, useEffect, useRef } from 'react'

/**
 * The end of a form: the answer is in, and the screen says so with joy — a circle that
 * blooms in the accent, a check drawn inside it, a ring that spreads, then confetti in the
 * form's colours, from the check first and from both sides after. The words rise last.
 *
 * Asked for less motion, the system is obeyed: no confetti at all, and the rest arrives
 * still (globals.css, `[data-form-screen]`).
 */
export function Celebration({
  accent,
  confetti,
  align,
  emblem,
  children,
}: {
  readonly accent: string
  /** The confetti — the form's author may prefer a quieter end. */
  readonly confetti: boolean
  readonly align: 'left' | 'center'
  /** What blooms in place of the check — a quiz's score; the confetti start from it. */
  readonly emblem?: ReactNode
  readonly children: ReactNode
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const check = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!confetti) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const el = canvas.current
    const from = check.current
    if (el === null || from === null) return
    return launch(el, from, accent)
  }, [confetti, accent])

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <canvas
        ref={canvas}
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10 size-full"
      />
      <div
        className={cn(
          'mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-6 py-16',
          align === 'center' ? 'items-center text-center' : 'items-start text-left',
        )}
      >
        {emblem !== undefined ? (
          <div ref={check} className="relative shrink-0">
            {emblem}
          </div>
        ) : (
          <div ref={check} className="relative size-24 shrink-0">
            <span
              aria-hidden
              className="absolute inset-0 animate-form-ring rounded-full bg-(--fm-accent) [animation-delay:0.25s]"
            />
            <span
              aria-hidden
              className="absolute inset-0 animate-form-ring rounded-full bg-(--fm-accent) [animation-delay:0.55s]"
            />
            <svg
              viewBox="0 0 96 96"
              aria-hidden="true"
              className="relative size-24 animate-form-pop"
            >
              <circle cx="48" cy="48" r="44" fill="var(--fm-accent)" />
              <path
                d="M29 49.5 L42 62 L67 35"
                fill="none"
                stroke="var(--fm-on-accent)"
                strokeWidth="7"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="60"
                strokeDashoffset="60"
                className="animate-form-draw [animation-delay:0.3s]"
              />
            </svg>
          </div>
        )}
        <div className="mt-8 animate-form-rise [animation-delay:0.45s]">{children}</div>
      </div>
    </div>
  )
}

interface Piece {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  color: string
  angle: number
  spin: number
  wobble: number
  wobbleSpeed: number
  round: boolean
  born: number
}

/** The accent, a lighter and a deeper one, and a few festive colours around it. */
function paletteOf(accent: string): string[] {
  return [
    accent,
    accent,
    `color-mix(in srgb, ${accent} 55%, white)`,
    `color-mix(in srgb, ${accent} 70%, black)`,
    '#fbbf24',
    '#34d399',
    '#60a5fa',
    '#f472b6',
    '#a78bfa',
  ]
}

/**
 * Throws the confetti; returns what stops it. Drawn on a canvas the size of the form, in
 * device pixels, and gone after three seconds — or as soon as the screen changes.
 */
function launch(canvas: HTMLCanvasElement, from: HTMLElement, accent: string): () => void {
  const ctx = canvas.getContext('2d')
  if (ctx === null) return () => undefined
  const ratio = window.devicePixelRatio || 1
  const box = canvas.getBoundingClientRect()
  canvas.width = Math.round(box.width * ratio)
  canvas.height = Math.round(box.height * ratio)
  ctx.scale(ratio, ratio)
  const colors = paletteOf(accent)
  // `color-mix` is not a colour a canvas reads: it is resolved once, through the DOM.
  const probe = document.createElement('span')
  canvas.parentElement?.appendChild(probe)
  const resolved = colors.map((c) => {
    probe.style.color = c
    return getComputedStyle(probe).color || accent
  })
  probe.remove()

  const origin = from.getBoundingClientRect()
  const cx = origin.left - box.left + origin.width / 2
  const cy = origin.top - box.top + origin.height / 2
  const pieces: Piece[] = []
  const start = performance.now()
  const random = (a: number, b: number) => a + Math.random() * (b - a)

  const burst = (
    x: number,
    y: number,
    count: number,
    angle: number,
    spread: number,
    speed: [number, number],
    at: number,
  ) => {
    for (let i = 0; i < count; i++) {
      const a = angle + random(-spread, spread)
      const v = random(speed[0], speed[1])
      pieces.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        size: random(6, 11),
        color: resolved[Math.floor(Math.random() * resolved.length)] ?? accent,
        angle: random(0, Math.PI * 2),
        spin: random(-0.25, 0.25),
        wobble: random(0, Math.PI * 2),
        wobbleSpeed: random(0.05, 0.12),
        round: Math.random() < 0.3,
        born: start + at,
      })
    }
  }
  // From the check, upwards and around; then from both lower corners, towards the middle.
  burst(cx, cy, 130, -Math.PI / 2, Math.PI * 0.55, [8, 17], 280)
  burst(0, box.height * 0.95, 80, -Math.PI / 3, 0.35, [13, 21], 520)
  burst(box.width, box.height * 0.95, 80, (-Math.PI * 2) / 3, 0.35, [13, 21], 520)

  const LIFE = 4600
  let frame = 0
  const draw = (now: number) => {
    ctx.clearRect(0, 0, box.width, box.height)
    let alive = false
    for (const p of pieces) {
      if (now < p.born) {
        alive = true
        continue
      }
      // Paper, not stones: a light gravity, the air that holds it, a sway as it falls.
      p.vy += 0.1
      p.vx *= 0.965
      p.vy *= 0.965
      p.x += p.vx + Math.sin(p.wobble) * 0.9
      p.y += p.vy
      p.angle += p.spin
      p.wobble += p.wobbleSpeed
      const age = now - p.born
      if (p.y > box.height + 40 || age > LIFE) continue
      alive = true
      ctx.save()
      ctx.globalAlpha = age > LIFE - 1000 ? Math.max(0, (LIFE - age) / 1000) : 1
      ctx.translate(p.x, p.y)
      ctx.rotate(p.angle)
      ctx.fillStyle = p.color
      if (p.round) {
        ctx.beginPath()
        ctx.arc(0, 0, p.size * 0.38, 0, Math.PI * 2)
        ctx.fill()
      } else {
        // A strip of paper turning: its width breathes as it spins.
        ctx.fillRect(
          -p.size / 2,
          (-p.size / 4) * Math.abs(Math.cos(p.wobble)),
          p.size,
          (p.size / 2) * Math.abs(Math.cos(p.wobble)) + 1,
        )
      }
      ctx.restore()
    }
    if (alive) frame = requestAnimationFrame(draw)
    else ctx.clearRect(0, 0, box.width, box.height)
  }
  frame = requestAnimationFrame(draw)
  return () => cancelAnimationFrame(frame)
}
