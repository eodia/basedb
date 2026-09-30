'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Hint } from '@/components/ui/tooltip'
import { type Place, api } from '@/lib/api/client'
import { $t } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Loader2, MapPin, Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

/**
 * An address — a short text in the « Adresse » format (chapter 04 §2.11): written as it is,
 * found on the map in a click, and, when the instance has a geocoding service, looked up
 * on demand (chapter 11 §1.9). On demand, never as it is typed: OpenStreetMap's service
 * forbids completing a text key after key, and one request per edit is all it takes.
 */

/** Where an address is shown on OpenStreetMap. */
export const mapUrl = (address: string) =>
  `https://www.openstreetmap.org/search?query=${encodeURIComponent(address)}`

let offered: Promise<boolean> | null = null
/** Whether the instance can propose addresses: asked once per page. */
function geocodingOffered(): Promise<boolean> {
  offered ??= api.resume().then(
    (me) => me?.geocodingAvailable === true,
    () => false,
  )
  return offered
}

/** An address in a cell or on a card: the text, and the map a click away. */
export function AddressLink({
  value,
  className,
}: { readonly value: string; readonly className?: string }) {
  return (
    <Hint label={$t('Voir sur la carte')}>
      <a
        href={mapUrl(value)}
        target="_blank"
        rel="noopener noreferrer"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        className={cn('inline-flex min-w-0 items-center gap-1 hover:underline', className)}
      >
        <MapPin className="size-3 shrink-0 text-muted-foreground" />
        <span className="truncate">{value}</span>
      </a>
    </Hint>
  )
}

/** An address being typed: the map beside it, and the service's propositions on demand. */
export function AddressInput({
  value,
  onChange,
  onCommit,
  readOnly,
  label,
}: {
  readonly value: string
  readonly onChange: (next: string) => void
  /** The text as it stands — on leaving the input, or on choosing a proposition. */
  readonly onCommit: (next: string) => void
  readonly readOnly?: boolean
  readonly label: string
}) {
  const [offered, setOffered] = useState(false)
  // `null`: nothing asked; an empty list: asked, and nothing found.
  const [places, setPlaces] = useState<readonly Place[] | null>(null)
  const [searching, setSearching] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let live = true
    void geocodingOffered().then((yes) => live && setOffered(yes))
    return () => {
      live = false
    }
  }, [])

  // The propositions close on a click elsewhere.
  useEffect(() => {
    if (places === null) return
    const away = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setPlaces(null)
    }
    document.addEventListener('mousedown', away)
    return () => document.removeEventListener('mousedown', away)
  }, [places])

  const search = async () => {
    setSearching(true)
    try {
      setPlaces(await api.searchAddresses(value))
    } catch {
      setPlaces([])
    } finally {
      setSearching(false)
    }
  }

  const choose = (place: Place) => {
    onChange(place.label)
    onCommit(place.label)
    setPlaces(null)
  }

  return (
    <div ref={box} className="relative flex items-center gap-1">
      <Input
        value={value}
        readOnly={readOnly}
        onChange={(e) => {
          onChange(e.target.value)
          setPlaces(null)
        }}
        onBlur={() => onCommit(value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') setPlaces(null)
        }}
        placeholder={$t('12 rue des Lilas, 69003 Lyon')}
        aria-label={label}
        autoComplete="off"
      />
      {offered && readOnly !== true && value.trim().length >= 3 && (
        <Hint label={$t('Trouver l’adresse')}>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={$t('Trouver l’adresse')}
            disabled={searching}
            onClick={() => void search()}
          >
            {searching ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Search className="size-4" />
            )}
          </Button>
        </Hint>
      )}
      {value.trim() !== '' && (
        <Hint label={$t('Voir sur la carte')}>
          <Button variant="ghost" size="icon-sm" asChild>
            <a
              href={mapUrl(value)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={$t('Voir sur la carte')}
            >
              <MapPin className="size-4" />
            </a>
          </Button>
        </Hint>
      )}
      {places !== null && (
        <ul
          aria-label={$t('Adresses proposées')}
          className="absolute top-full right-0 left-0 z-50 mt-1 overflow-hidden rounded-md border bg-popover py-1 text-sm shadow-md"
        >
          {places.length === 0 ? (
            <li className="px-2 py-1.5 text-muted-foreground">
              {$t('Aucune adresse trouvée. Précisez la ville ou le code postal.')}
            </li>
          ) : (
            places.map((p) => (
              <li key={`${p.lat},${p.lng},${p.label}`}>
                <button
                  type="button"
                  className="flex w-full items-start gap-2 px-2 py-1.5 text-left hover:bg-accent"
                  onClick={() => choose(p)}
                >
                  <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                  <span className="line-clamp-2">{p.label}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
