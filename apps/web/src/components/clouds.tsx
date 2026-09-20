'use client'

import { useEffect, useRef } from 'react'

/**
 * Animated background of the login screen.
 *
 * Loaded ON THIS SCREEN ONLY, and dynamically: `three` weighs some 600 KiB, and the
 * rest of the product has no use for it. Behind a `<Suspense>`-free dynamic import, the
 * page is usable before the canvas exists — the form never waits for the decoration.
 *
 * Everything is bundled, nothing comes from a CDN: the product is self-hostable, so an
 * installation without internet access must look the same as one with it.
 */

interface VantaEffect {
  destroy(): void
}

export function Clouds() {
  const container = useRef<HTMLDivElement>(null)
  const effect = useRef<VantaEffect | null>(null)

  useEffect(() => {
    let cancelled = false

    const start = async () => {
      const element = container.current
      if (element === null) return

      // A viewer who asked for less motion gets none: this is decoration, and it is the
      // one thing on this screen nobody needs.
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

      const [three, clouds] = await Promise.all([
        import('three'),
        import('vanta/dist/vanta.clouds.min.js'),
      ])
      if (cancelled) return

      const create = (clouds as { default: (options: Record<string, unknown>) => VantaEffect })
        .default
      effect.current = create({
        el: element,
        THREE: three,
        mouseControls: false,
        touchControls: false,
        gyroControls: false,
        minHeight: 200,
        minWidth: 200,
        skyColor: 0x1b2836,
        cloudColor: 0x33455b,
        cloudShadowColor: 0x0d1520,
        sunColor: 0xff8a3d,
        sunGlareColor: 0xff5e2b,
        sunlightColor: 0xff9a52,
        speed: 0.7,
      })
    }

    void start()
    return () => {
      cancelled = true
      effect.current?.destroy()
      effect.current = null
    }
  }, [])

  return (
    <div
      ref={container}
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        // A plain colour underneath: while `three` loads, and forever for a viewer who
        // asked for reduced motion, the screen must still look deliberate.
        background: 'linear-gradient(160deg, #16212e 0%, #0f1720 60%, #0b1118 100%)',
      }}
    />
  )
}
