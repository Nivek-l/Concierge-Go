'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { CircleMarker, Map as LeafletMap, Polyline } from 'leaflet'
import { Clock3, LocateFixed, Navigation, Radio, Route } from 'lucide-react'

import { publicEnv } from '@/lib/env'
import { createClient } from '@/lib/supabase/client'
import type { TaskLiveLocationRow, TaskStatus } from '@/types/database'

interface Coordinate {
  latitude: number
  longitude: number
}

interface RouteSummary {
  coordinates: [number, number][]
  distanceMetres: number
  durationSeconds: number | null
  routed: boolean
}

interface OsrmResponse {
  code?: string
  routes?: Array<{
    distance: number
    duration: number
    geometry: { coordinates: [number, number][] }
  }>
}

const TRACKING_STATUSES: TaskStatus[] = ['en_route', 'arrived', 'in_progress']

function distanceKm(a: Coordinate, b: Coordinate) {
  const radius = 6371
  const latitudeDelta = ((b.latitude - a.latitude) * Math.PI) / 180
  const longitudeDelta = ((b.longitude - a.longitude) * Math.PI) / 180
  const value =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos((a.latitude * Math.PI) / 180) *
      Math.cos((b.latitude * Math.PI) / 180) *
      Math.sin(longitudeDelta / 2) ** 2
  return 2 * radius * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value))
}

function stage(status: TaskStatus) {
  if (status === 'assigned') return ['Agent assigned', 'Your Go Agent is preparing to set out.']
  if (status === 'en_route') return ['Agent on the way', 'Routing to the task location.']
  if (status === 'arrived') return ['Agent has arrived', 'Your Go Agent is at the task location.']
  if (status === 'in_progress') return ['Task in progress', 'Live progress updates as the task continues.']
  return ['Task tracking', 'Location updates appear here when available.']
}

function formatDistance(distanceMetres: number | null) {
  if (distanceMetres == null) return 'Waiting for location'
  if (distanceMetres < 1000) return `${Math.max(10, Math.round(distanceMetres / 10) * 10)} m`
  return `${(distanceMetres / 1000).toFixed(distanceMetres < 10_000 ? 1 : 0)} km`
}

function formatDuration(durationSeconds: number | null) {
  if (durationSeconds == null) return 'Calculating route'
  const minutes = Math.max(1, Math.round(durationSeconds / 60))
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return remainder ? `${hours} hr ${remainder} min` : `${hours} hr`
}

function fallbackRoute(from: Coordinate, to: Coordinate): RouteSummary {
  return {
    coordinates: [
      [from.latitude, from.longitude],
      [to.latitude, to.longitude],
    ],
    distanceMetres: distanceKm(from, to) * 1000,
    durationSeconds: null,
    routed: false,
  }
}

export function TaskLiveMap({
  taskId,
  status,
  initialLocation,
  pickup,
  destination,
}: {
  taskId: string
  status: TaskStatus
  initialLocation: TaskLiveLocationRow | null
  pickup?: Coordinate | null
  destination?: Coordinate | null
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const markerRef = useRef<CircleMarker | null>(null)
  const routeLayerRef = useRef<Polyline | null>(null)
  const fittedRouteRef = useRef(false)
  const routeRequestRef = useRef(0)
  const [location, setLocation] = useState(initialLocation)
  const [routeSummary, setRouteSummary] = useState<RouteSummary | null>(null)
  const [routeLoading, setRouteLoading] = useState(false)
  const [routeMessage, setRouteMessage] = useState('Waiting for a live location update.')

  const target = useMemo(() => {
    const followUpLeg = status === 'in_progress' || status === 'awaiting_confirmation'
    if (followUpLeg && destination) {
      return { coordinate: destination, label: 'Follow-up destination' }
    }
    if (pickup) return { coordinate: pickup, label: 'Task location' }
    if (destination) return { coordinate: destination, label: 'Destination' }
    return null
  }, [destination, pickup, status])

  useEffect(() => setLocation(initialLocation), [initialLocation])

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    let disposed = false

    void import('leaflet').then((leaflet) => {
      if (disposed || !containerRef.current) return
      const centre: [number, number] = initialLocation
        ? [initialLocation.latitude, initialLocation.longitude]
        : target
          ? [target.coordinate.latitude, target.coordinate.longitude]
          : [4.9757, 8.3417]
      const map = leaflet.map(containerRef.current, { zoomControl: true }).setView(centre, 14)
      leaflet
        .tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 19,
        })
        .addTo(map)

      if (pickup) {
        leaflet
          .circleMarker([pickup.latitude, pickup.longitude], {
            radius: 7,
            color: '#0b2d6b',
            fillOpacity: 0.9,
          })
          .bindTooltip('Task location')
          .addTo(map)
      }
      if (destination) {
        leaflet
          .circleMarker([destination.latitude, destination.longitude], {
            radius: 7,
            color: '#f59e0b',
            fillOpacity: 0.9,
          })
          .bindTooltip('Follow-up destination')
          .addTo(map)
      }
      if (initialLocation) {
        markerRef.current = leaflet
          .circleMarker([initialLocation.latitude, initialLocation.longitude], {
            radius: 9,
            color: '#fff',
            weight: 3,
            fillColor: '#007bff',
            fillOpacity: 1,
          })
          .bindTooltip('Go Agent')
          .addTo(map)
      }
      mapRef.current = map
      window.setTimeout(() => map.invalidateSize(), 50)
    })

    return () => {
      disposed = true
      mapRef.current?.remove()
      mapRef.current = null
      markerRef.current = null
      routeLayerRef.current = null
      fittedRouteRef.current = false
    }
  }, [destination, initialLocation, pickup, target])

  useEffect(() => {
    if (!location || !mapRef.current) return
    void import('leaflet').then((leaflet) => {
      const point: [number, number] = [location.latitude, location.longitude]
      if (markerRef.current) markerRef.current.setLatLng(point)
      else {
        markerRef.current = leaflet
          .circleMarker(point, {
            radius: 9,
            color: '#fff',
            weight: 3,
            fillColor: '#007bff',
            fillOpacity: 1,
          })
          .bindTooltip('Go Agent')
          .addTo(mapRef.current!)
      }
      mapRef.current?.panTo(point, { animate: true, duration: 0.6 })
    })
  }, [location])

  useEffect(() => {
    if (!location || !target) {
      setRouteSummary(null)
      setRouteMessage(!target ? 'Add task coordinates to enable routing.' : 'Waiting for the agent location.')
      return
    }

    const controller = new AbortController()
    const requestId = ++routeRequestRef.current
    let timedOut = false
    const timeout = window.setTimeout(() => {
      timedOut = true
      controller.abort()
    }, 10_000)
    const from = { latitude: location.latitude, longitude: location.longitude }
    const to = target.coordinate
    const url = `${publicEnv.routingApiUrl}/route/v1/driving/${from.longitude},${from.latitude};${to.longitude},${to.latitude}?overview=full&geometries=geojson&steps=false`

    setRouteLoading(true)
    setRouteMessage(`Finding the quickest route to ${target.label.toLowerCase()}…`)

    void fetch(url, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Routing request failed')
        const body = (await response.json()) as OsrmResponse
        const route = body.routes?.[0]
        if (body.code !== 'Ok' || !route) throw new Error('No route found')
        if (requestId !== routeRequestRef.current) return
        setRouteSummary({
          coordinates: route.geometry.coordinates.map(([longitude, latitude]) => [
            latitude,
            longitude,
          ]),
          distanceMetres: route.distance,
          durationSeconds: route.duration,
          routed: true,
        })
        setRouteMessage(`Auto-routing to ${target.label.toLowerCase()}. Route updates with the agent.`)
      })
      .catch(() => {
        if (requestId !== routeRequestRef.current || (controller.signal.aborted && !timedOut)) return
        setRouteMessage(
          timedOut
            ? 'Routing is taking too long. Showing direct distance.'
            : 'Road routing is temporarily unavailable. Showing direct distance.',
        )
        setRouteSummary(fallbackRoute(from, to))
      })
      .finally(() => {
        window.clearTimeout(timeout)
        if (requestId === routeRequestRef.current) setRouteLoading(false)
      })

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [location, target])

  useEffect(() => {
    if (!routeSummary || !mapRef.current) return
    void import('leaflet').then((leaflet) => {
      routeLayerRef.current?.remove()
      routeLayerRef.current = leaflet
        .polyline(routeSummary.coordinates, {
          color: routeSummary.routed ? '#5965f2' : '#667085',
          weight: routeSummary.routed ? 6 : 3,
          opacity: 0.9,
          dashArray: routeSummary.routed ? undefined : '8 8',
        })
        .addTo(mapRef.current!)

      if (!fittedRouteRef.current) {
        mapRef.current?.fitBounds(routeLayerRef.current.getBounds(), {
          paddingTopLeft: [32, 88],
          paddingBottomRight: [32, 180],
          maxZoom: 16,
        })
        fittedRouteRef.current = true
      }
    })
  }, [routeSummary])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`task-location:${taskId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'task_live_locations',
          filter: `task_id=eq.${taskId}`,
        },
        (payload) => {
          if (payload.eventType !== 'DELETE') setLocation(payload.new as TaskLiveLocationRow)
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [taskId])

  const [title, description] = stage(status)
  const active = Boolean(location?.is_tracking && TRACKING_STATUSES.includes(status))
  const eta = routeSummary?.durationSeconds ?? null
  const arrivalTime = eta ? new Date(Date.now() + eta * 1000) : null

  function recenterMap() {
    if (routeLayerRef.current) {
      mapRef.current?.fitBounds(routeLayerRef.current.getBounds(), {
        paddingTopLeft: [32, 88],
        paddingBottomRight: [32, 180],
        maxZoom: 16,
      })
      return
    }
    if (location) mapRef.current?.setView([location.latitude, location.longitude], 15)
    else if (target) {
      mapRef.current?.setView(
        [target.coordinate.latitude, target.coordinate.longitude],
        15,
      )
    }
  }

  return (
    <section
      className="relative isolate min-h-[31rem] overflow-hidden rounded-[1.75rem] border bg-muted shadow-sm sm:min-h-[36rem]"
      aria-label="Live task tracking"
    >
      <div
        ref={containerRef}
        className="absolute inset-0 z-0 bg-muted"
        role="region"
        aria-label={`Live route map${target ? ` to ${target.label.toLowerCase()}` : ''}`}
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] flex items-start justify-between gap-2 p-3 sm:p-4">
        <div className="max-w-[70%] rounded-2xl bg-[#5965f2] px-3 py-2 text-sm font-semibold text-white shadow-lg">
          {arrivalTime ? (
            <span className="flex items-center gap-2">
              <Clock3 className="h-4 w-4 shrink-0" aria-hidden />
              Arrive by{' '}
              {arrivalTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          ) : (
            <span>{routeLoading ? 'Finding quickest route…' : title}</span>
          )}
        </div>
        <div className="flex min-h-14 min-w-14 flex-col items-center justify-center rounded-full border-4 border-white bg-success px-2 text-center text-white shadow-lg">
          <strong className="text-base leading-none">{eta ? Math.max(1, Math.round(eta / 60)) : '—'}</strong>
          <span className="text-[10px] font-bold leading-none">min</span>
        </div>
      </div>

      <button
        type="button"
        onClick={recenterMap}
        className="absolute right-3 top-20 z-[500] grid min-h-11 min-w-11 place-items-center rounded-full border bg-background text-foreground shadow-md transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-95 sm:right-4 sm:top-24"
        aria-label="Recenter route on map"
      >
        <LocateFixed className="h-5 w-5" aria-hidden />
      </button>

      <div className="absolute inset-x-0 bottom-0 z-[500] rounded-t-[1.75rem] border-t bg-background/95 px-4 pb-4 pt-3 shadow-[0_-8px_30px_rgba(15,23,42,0.16)] backdrop-blur sm:px-5 sm:pb-5">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-muted-foreground/25" aria-hidden />
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary-subtle text-primary">
            <Navigation className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold">{title}</h2>
              {active ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-success-subtle px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-success">
                  <Radio className="h-3 w-3" aria-hidden /> Live
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          </div>
        </div>

        <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
          <div className="min-w-0 rounded-xl bg-muted/60 p-2.5">
            <dt className="text-[11px] text-muted-foreground">Distance</dt>
            <dd className="mt-0.5 truncate font-semibold">{formatDistance(routeSummary?.distanceMetres ?? null)}</dd>
          </div>
          <div className="min-w-0 rounded-xl bg-muted/60 p-2.5">
            <dt className="text-[11px] text-muted-foreground">ETA</dt>
            <dd className="mt-0.5 truncate font-semibold">{formatDuration(eta)}</dd>
          </div>
          <div className="min-w-0 rounded-xl bg-muted/60 p-2.5">
            <dt className="text-[11px] text-muted-foreground">Current leg</dt>
            <dd className="mt-0.5 truncate font-semibold">{target?.label ?? 'Location needed'}</dd>
          </div>
        </dl>

        <div className="mt-3 flex min-w-0 items-start gap-2 text-xs text-muted-foreground">
          <Route className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1">{routeLoading ? 'Updating route…' : routeMessage}</span>
          {location ? (
            <span className="shrink-0">
              {new Date(location.recorded_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          ) : null}
        </div>
        <p className="sr-only" aria-live="polite">
          {active
            ? 'Live location and route update automatically.'
            : location
              ? 'Showing the last shared Go Agent location.'
              : 'Tracking has not started yet.'}
        </p>
      </div>
    </section>
  )
}
