'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { setOptions, importLibrary } from '@googlemaps/js-api-loader'

export type Zone = {
  id: string
  name: string
  bonkers_day: string
  polygon: object
}

export type MapAddress = {
  street: string
  subCommunity: string
  area: string
  fullText: string
  lat: number
  lng: number
}

export type MapResult = {
  lat: number
  lng: number
  zoneId: string | null
  bonkersDay: string | null
  address: MapAddress
}

type Props = {
  zones: Zone[]
  onProceed: (result: MapResult) => void
  onOutOfArea: (result: MapResult) => void
}

const DUBAI_CENTER = { lat: 25.2048, lng: 55.2708 }
const DUBAI_BOUNDS = { north: 25.36, south: 24.79, east: 55.93, west: 54.89 }

let mapsConfigured = false

export default function SignupMap({ zones, onProceed, onOutOfArea }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const markerRef = useRef<google.maps.Marker | null>(null)
  const sessionTokenRef = useRef<any>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [status, setStatus] = useState<'idle' | 'locating' | 'checking' | 'done'>('idle')

  useEffect(() => {
    if (!containerRef.current) return
    let cancelled = false

    async function init() {
      if (!mapsConfigured) {
        setOptions({ key: process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || '', version: 'weekly' })
        mapsConfigured = true
      }
      const { Map } = await importLibrary('maps') as google.maps.MapsLibrary
      const { Marker } = await importLibrary('marker') as google.maps.MarkerLibrary

      if (cancelled) return

      const map = new Map(containerRef.current!, {
        center: DUBAI_CENTER,
        zoom: 11,
        mapTypeControl: false,
        fullscreenControl: false,
        streetViewControl: false,
        zoomControlOptions: { position: google.maps.ControlPosition.RIGHT_CENTER },
        restriction: { latLngBounds: DUBAI_BOUNDS, strictBounds: false },
      })
      mapRef.current = map

      const marker = new Marker({
        draggable: true,
        map: null,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#f59e0b',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2.5,
        },
      })
      markerRef.current = marker

      marker.addListener('dragend', () => {
        const pos = marker.getPosition()
        if (!pos) return
        runZoneCheck(pos.lat(), pos.lng())
      })

      // Auto-request location as soon as map is ready
      if (navigator.geolocation) {
        setStatus('locating')
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (cancelled) return
            const lat = pos.coords.latitude
            const lng = pos.coords.longitude
            marker.setPosition({ lat, lng })
            marker.setMap(map)
            map.panTo({ lat, lng })
            map.setZoom(17)
            runZoneCheck(lat, lng)
          },
          () => {
            if (!cancelled) setStatus('idle')
          },
          { enableHighAccuracy: true, timeout: 10000 }
        )
      }
    }

    init().catch(console.error)
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchSuggestions = useCallback(async (input: string) => {
    if (input.length < 3) { setSuggestions([]); return }
    try {
      const placesLib = await importLibrary('places') as any
      const { AutocompleteSuggestion, AutocompleteSessionToken } = placesLib
      if (!sessionTokenRef.current) {
        sessionTokenRef.current = new AutocompleteSessionToken()
      }
      const { suggestions: s } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input,
        sessionToken: sessionTokenRef.current,
        includedRegionCodes: ['ae'],
        locationBias: DUBAI_BOUNDS,
      })
      setSuggestions(s || [])
      setShowSuggestions(true)
    } catch {
      setSuggestions([])
    }
  }, [])

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 300)
  }

  const selectSuggestion = async (suggestion: any) => {
    setShowSuggestions(false)
    setSuggestions([])
    try {
      const place = suggestion.placePrediction.toPlace()
      await place.fetchFields({ fields: ['location', 'formattedAddress'] })
      const lat = place.location.lat()
      const lng = place.location.lng()
      setQuery(place.formattedAddress || suggestion.placePrediction?.text?.text || '')
      sessionTokenRef.current = null
      const map = mapRef.current
      const marker = markerRef.current
      if (map && marker) {
        marker.setPosition({ lat, lng })
        marker.setMap(map)
        map.panTo({ lat, lng })
        map.setZoom(17)
      }
      runZoneCheck(lat, lng)
    } catch (e) {
      console.error(e)
    }
  }

  async function runZoneCheck(lat: number, lng: number) {
    setStatus('checking')
    const addr: MapAddress = { street: '', subCommunity: '', area: '', fullText: '', lat, lng }

    if (!zones.length) {
      setStatus('done')
      onProceed({ lat, lng, zoneId: null, bonkersDay: null, address: addr })
      return
    }

    try {
      const { default: booleanPIP } = await import('@turf/boolean-point-in-polygon')
      const { point } = await import('@turf/helpers')
      const pt = point([lng, lat])
      for (const zone of zones) {
        try {
          if (booleanPIP(pt, zone.polygon as any)) {
            setStatus('done')
            onProceed({ lat, lng, zoneId: zone.id, bonkersDay: zone.bonkers_day, address: addr })
            return
          }
        } catch { /* skip invalid polygon */ }
      }
      setStatus('done')
      onOutOfArea({ lat, lng, zoneId: null, bonkersDay: null, address: addr })
    } catch {
      setStatus('done')
      onProceed({ lat, lng, zoneId: null, bonkersDay: null, address: addr })
    }
  }

  const inputStyle: React.CSSProperties = {
    flex: 1,
    border: '1px solid #ddd6cc',
    borderRadius: '12px',
    padding: '12px 16px',
    fontFamily: 'var(--font-montserrat), sans-serif',
    fontSize: '1rem',
    color: '#1a2744',
    backgroundColor: '#ffffff',
    outline: 'none',
    boxSizing: 'border-box',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {/* Search box */}
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          value={query}
          onChange={handleQueryChange}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          placeholder="Search for your street or community…"
          style={inputStyle}
        />

        {showSuggestions && suggestions.length > 0 && (
          <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, backgroundColor: '#fff', border: '1px solid #ddd6cc', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 50, overflow: 'hidden' }}>
            {suggestions.map((s: any, i: number) => {
              const main = s.placePrediction?.mainText?.text || s.placePrediction?.text?.text || ''
              const secondary = s.placePrediction?.secondaryText?.text || ''
              return (
                <div
                  key={i}
                  onMouseDown={() => selectSuggestion(s)}
                  style={{ padding: '10px 16px', cursor: 'pointer', borderTop: i > 0 ? '1px solid #f0ebe3' : 'none' }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#fdf3e8')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <p style={{ margin: 0, fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.88rem', fontWeight: 600, color: '#1a2744' }}>{main}</p>
                  {secondary && <p style={{ margin: 0, fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.78rem', color: '#888', marginTop: '2px' }}>{secondary}</p>}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {status === 'locating' && (
        <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.8rem', color: '#1a2f51', margin: 0, opacity: 0.6 }}>
          Finding your location…
        </p>
      )}

      {/* Map */}
      <div
        ref={containerRef}
        style={{ width: '100%', height: '340px', borderRadius: '16px', overflow: 'hidden', border: '2px solid #e8e0d4' }}
      />

      {status === 'checking' && (
        <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.8rem', color: '#1a2f51', margin: 0, textAlign: 'center', opacity: 0.6 }}>
          Checking your area…
        </p>
      )}
    </div>
  )
}
