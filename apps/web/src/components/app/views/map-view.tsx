'use client'

import 'leaflet/dist/leaflet.css'
import type { Row } from '@/components/app/grid/cell'
import { Unavailable } from '@/components/app/views/kanban-view'
import { loadRows } from '@/components/app/views/load'
import { type Field, type Place, type Table, api } from '@/lib/api/client'
import { $t, $tp } from '@/lib/i18n'
import { messageFor } from '@/lib/messages'
import type { MapSpec } from '@/lib/views'
import type { Map as LeafletMap } from 'leaflet'
import { Loader2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { colorOf, titleOf } from './card'

/**
 * The map — chapter 11 §1.9: each row placed by its address, or by its latitude and its
 * longitude. An address becomes a point through the instance's geocoding service, a few at
 * a time: the pins appear as they come, and the rows no one could place are counted, never
 * dropped in silence. A click on a pin opens the row.
 *
 * Leaflet draws it, on the tiles the operator chose — OpenStreetMap's by default. The pins
 * are circles drawn by the map itself: no picture to fetch, and the colour of the row's
 * choice when the view says which.
 */

const CEILING = 2000
const PRIMARY = '#16a34a'

interface Tiles {
  readonly url: string
  readonly attribution: string
}

const tiles = (): Tiles =>
  (window as unknown as { __BASEDB_TILES__?: Tiles }).__BASEDB_TILES__ ?? {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap',
  }

/** An address as the service is asked it: the text of the field, spaces collapsed. */
function addressOf(row: Row, field: Field): string | null {
  const raw = row[field.name]
  const value = Array.isArray(raw) ? raw[0] : raw
  if (typeof value !== 'string') return null
  const text = (field.unsafe_html === true ? value.replace(/<[^>]*>/g, ' ') : value)
    .replace(/\s+/g, ' ')
    .trim()
  return text === '' ? null : text
}

const key = (address: string) => address.toLowerCase()

const coordinate = (value: unknown): number | null => {
  const n = typeof value === 'number' ? value : Number(Array.isArray(value) ? value[0] : value)
  return value === null || value === undefined || value === '' || !Number.isFinite(n) ? null : n
}

export function MapView({
  table,
  fields,
  spec,
  filter,
  sort,
  reloadKey,
  openedId,
  onOpen,
  onError,
}: {
  readonly table: Table
  readonly fields: readonly Field[]
  readonly spec: MapSpec
  readonly filter: string
  readonly sort: string
  readonly reloadKey: number
  readonly openedId: string | null
  readonly onOpen: (row: Row) => void
  readonly onError: (message: string) => void
}) {
  const byName = (name: string | null) =>
    name === null ? null : (fields.find((f) => f.name === name) ?? null)
  const address = byName(spec.address_field)
  const latitude = byName(spec.latitude_field)
  const longitude = byName(spec.longitude_field)
  const title = byName(spec.title_field)
  const color = byName(spec.color_field)
  const placedBy: 'address' | 'coordinates' | null =
    address !== null ? 'address' : latitude !== null && longitude !== null ? 'coordinates' : null

  const [rows, setRows] = useState<readonly Row[]>([])
  const [capped, setCapped] = useState(false)
  const [loading, setLoading] = useState(true)
  const [places, setPlaces] = useState<Readonly<Record<string, Place | null>>>({})
  const [pending, setPending] = useState(0)

  // The rows, as the view filters and sorts them.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `reloadKey` is what asks for the reload
  useEffect(() => {
    if (placedBy === null) return
    let live = true
    setLoading(true)
    loadRows(table, { filter, sort, ceiling: CEILING }).then(
      (found) => {
        if (!live) return
        setRows(found.rows)
        setCapped(found.capped)
        setLoading(false)
      },
      (e) => {
        if (!live) return
        setLoading(false)
        onError(messageFor(e))
      },
    )
    return () => {
      live = false
    }
  }, [table, filter, sort, reloadKey, placedBy, onError])

  // Their addresses as points: what is known at once, then a few more at each call, as
  // long as the service makes progress.
  useEffect(() => {
    if (address === null) return
    const addresses = [...new Set(rows.flatMap((r) => addressOf(r, address) ?? []))].slice(0, 500)
    if (addresses.length === 0) {
      setPending(0)
      return
    }
    let live = true
    let previous = Number.POSITIVE_INFINITY
    const round = async () => {
      try {
        const found = await api.geocode(addresses)
        if (!live) return
        setPlaces((all) => ({ ...all, ...found.places }))
        setPending(found.pending)
        if (found.pending > 0 && found.pending < previous) {
          previous = found.pending
          setTimeout(() => void round(), 400)
        }
      } catch (e) {
        if (live) onError(messageFor(e))
      }
    }
    void round()
    return () => {
      live = false
    }
  }, [rows, address, onError])

  // Each row with its point, or without one.
  const placed = useMemo(() => {
    const out: Array<{ row: Row; lat: number; lng: number }> = []
    let unplaced = 0
    for (const row of rows) {
      let point: { lat: number; lng: number } | null = null
      if (placedBy === 'coordinates' && latitude !== null && longitude !== null) {
        const lat = coordinate(row[latitude.name])
        const lng = coordinate(row[longitude.name])
        point =
          lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
            ? { lat, lng }
            : null
      } else if (address !== null) {
        const text = addressOf(row, address)
        point = text === null ? null : (places[key(text)] ?? null)
      }
      if (point === null) unplaced++
      else out.push({ row, ...point })
    }
    return { out, unplaced }
  }, [rows, places, placedBy, address, latitude, longitude])

  const host = useRef<HTMLDivElement>(null)
  const map = useRef<LeafletMap | null>(null)
  const layer = useRef<import('leaflet').LayerGroup | null>(null)
  const fitted = useRef(false)
  const [ready, setReady] = useState(false)
  const open = useRef(onOpen)
  open.current = onOpen

  // The map itself, once: Leaflet reads the window, so it is loaded on the client.
  useEffect(() => {
    let live = true
    void import('leaflet').then((L) => {
      if (!live || host.current === null || map.current !== null) return
      const { url, attribution } = tiles()
      const created = L.map(host.current, { worldCopyJump: true }).setView([46.6, 2.4], 5)
      L.tileLayer(url, { attribution, maxZoom: 19 }).addTo(created)
      layer.current = L.layerGroup().addTo(created)
      map.current = created
      setReady(true)
    })
    // The frame follows its box: a row panel opened beside it, the navigation folded.
    const resized = new ResizeObserver(() => map.current?.invalidateSize())
    if (host.current !== null) resized.observe(host.current)
    return () => {
      live = false
      resized.disconnect()
      map.current?.remove()
      map.current = null
      layer.current = null
      fitted.current = false
    }
  }, [])

  // The pins: drawn again whenever a row, a point or the opened row changes.
  useEffect(() => {
    if (!ready) return
    let live = true
    void import('leaflet').then((L) => {
      const group = layer.current
      if (!live || group === null || map.current === null) return
      group.clearLayers()
      for (const { row, lat, lng } of placed.out) {
        const fill = colorOf(row, color) ?? PRIMARY
        const opened = row._id === openedId
        L.circleMarker([lat, lng], {
          radius: opened ? 10 : 7,
          color: opened ? '#111827' : '#ffffff',
          weight: opened ? 3 : 2,
          fillColor: fill,
          fillOpacity: 0.9,
        })
          .bindTooltip(titleOf(row, title))
          .on('click', () => open.current(row))
          .addTo(group)
      }
      // Framed on the pins once, when there are some: later loads keep the reader's frame.
      if (!fitted.current && placed.out.length > 0) {
        fitted.current = true
        map.current.fitBounds(
          L.latLngBounds(placed.out.map((p) => [p.lat, p.lng] as [number, number])),
          { padding: [40, 40], maxZoom: 15 },
        )
      }
    })
    return () => {
      live = false
    }
  }, [ready, placed, color, title, openedId])

  if (placedBy === null) {
    return (
      <Unavailable>
        {$t(
          'Le champ qui place les lignes de cette carte n’existe plus, ou ne vous est pas ouvert.',
        )}
      </Unavailable>
    )
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={host}
        className="z-0 min-h-0 flex-1"
        aria-label={$t('Carte des lignes de {label}', { label: table.label })}
      />
      <div className="pointer-events-none absolute right-3 bottom-6 left-3 flex justify-center">
        <p className="pointer-events-auto flex items-center gap-2 rounded-full border bg-background/95 px-3 py-1.5 text-xs text-muted-foreground shadow-sm">
          {(loading || pending > 0) && <Loader2 className="size-3.5 animate-spin" />}
          {loading
            ? $t('Chargement…')
            : [
                $tp(placed.out.length, '{count} ligne sur la carte', '{count} lignes sur la carte'),
                ...(pending > 0
                  ? [$tp(pending, '{count} adresse à situer', '{count} adresses à situer')]
                  : placed.unplaced > 0
                    ? [$tp(placed.unplaced, '{count} sans position', '{count} sans position')]
                    : []),
                ...(capped ? [$t('les {ceiling} premières seulement', { ceiling: CEILING })] : []),
              ].join(' · ')}
        </p>
      </div>
    </div>
  )
}
