'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Map as LeafletMap, CircleMarker } from 'leaflet'
import { ChevronRight, MapPinned, Navigation, Route } from 'lucide-react'

import { createClient } from '@/lib/supabase/client'
import { TASK_STATUS_META } from '@/lib/constants'
import type { TaskLiveLocationRow, TaskStatus } from '@/types/database'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface Coordinate {
  latitude: number
  longitude: number
}

function distanceKm(a: Coordinate, b: Coordinate) {
  const radius = 6371
  const toRadians = (value: number) => (value * Math.PI) / 180
  const dLat = toRadians(b.latitude - a.latitude)
  const dLon = toRadians(b.longitude - a.longitude)
  const lat1 = toRadians(a.latitude)
  const lat2 = toRadians(b.latitude)

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2

  return radius * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
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
  const agentMarkerRef = useRef<CircleMarker | null>(null)
  const [location, setLocation] = useState(initialLocation)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setLocation(initialLocation)
  }, [initialLocation])

  useEffect(() => {
    if (!open || !containerRef.current || mapRef.current) return
    let disposed = false

    void import('leaflet').then((L) => {
      if (disposed || !containerRef.current) return

      const center = initialLocation
        ? ([initialLocation.latitude, initialLocation.longitude] as [number, number])
        : pickup
          ? ([pickup.latitude, pickup.longitude] as [number, number])
          : ([4.9757, 8.3417] as [number, number])

      const map = L.map(containerRef.current, { zoomControl: true }).setView(
        center,
        initialLocation || pickup ? 15 : 12,
      )

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map)

      if (pickup) {
        L.circleMarker([pickup.latitude, pickup.longitude], {
          radius: 7,
          color: '#0b2d6b',
          fillOpacity: 0.9,
        })
          .bindTooltip('Task location')
          .addTo(map)
      }

      if (destination) {
        L.circleMarker([destination.latitude, destination.longitude], {
          radius: 7,
          color: '#f59e0b',
          fillOpacity: 0.9,
        })
          .bindTooltip('Destination')
          .addTo(map)
      }

      if (initialLocation) {
        agentMarkerRef.current = L.circleMarker([initialLocation.latitude, initialLocation.longitude], {
          radius: 9,
          color: '#ffffff',
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
      agentMarkerRef.current = null
    }
  }, [destination, initialLocation, open, pickup])

  useEffect(() => {
    if (!location || !mapRef.current) return

    void import('leaflet').then((L) => {
      const point: [number, number] = [location.latitude, location.longitude]

      if (agentMarkerRef.current) agentMarkerRef.current.setLatLng(point)
      else {
        agentMarkerRef.current = L.circleMarker(point, {
          radius: 9,
          color: '#ffffff',
          weight: 3,
          fillColor: '#007bff',
          fillOpacity: 1,
        })
          .bindTooltip('Go Agent')
          .addTo(mapRef.current!)
      }

      mapRef.current?.panTo(point)
    })
  }, [location])

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

  const active =
    Boolean(location?.is_tracking) && ['en_route', 'arrived', 'in_progress'].includes(status)

  const routeTarget = status === 'en_route' ? pickup : null

  const remainingKm = useMemo(() => {
    if (!location || !routeTarget) return null
    return distanceKm(
      { latitude: location.latitude, longitude: location.longitude },
      routeTarget,
    )
  }, [location, routeTarget])

  const meta = TASK_STATUS_META[status]

  const journeyLabel =
    status === 'en_route'
      ? 'Go Agent → task location'
      : status === 'arrived'
        ? 'Agent has reached the task location'
        : status === 'in_progress'
          ? 'Task is being handled'
          : status === 'assigned'
            ? 'Agent assigned'
            : meta.label

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="group w-full rounded-2xl border bg-card p-4 text-left shadow-soft transition-all hover:border-primary/30 hover:shadow-lift sm:p-5"
        >
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-subtle text-primary">
              <Navigation className="h-4 w-4" aria-hidden />
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                    Current journey
                  </p>
                  <p className="mt-1 truncate text-sm font-semibold">{journeyLabel}</p>
                </div>
                <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
              </div>

              <div className="mt-4 flex items-center gap-2" aria-hidden>
                <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                <span className="relative h-1 flex-1 overflow-hidden rounded-full bg-muted">
                  <span
                    className="absolute inset-y-0 left-0 rounded-full bg-primary"
                    style={{ width: `${Math.max(12, Math.min(meta.progress, 92))}%` }}
                  />
                </span>
                <MapPinned className="h-4 w-4 text-brand-orange" />
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  {active
                    ? 'Live location updating'
                    : location
                      ? 'Showing the latest shared location'
                      : 'Waiting for the Go Agent to share location'}
                </span>
                {remainingKm != null ? (
                  <span className="font-semibold text-foreground">
                    {remainingKm < 1
                      ? `${Math.max(1, Math.round(remainingKm * 1000))} m remaining`
                      : `${remainingKm.toFixed(1)} km remaining`}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </button>
      </DialogTrigger>

      <DialogContent className="max-h-[92dvh] max-w-3xl overflow-y-auto p-0">
        <DialogHeader className="border-b p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-subtle text-primary">
              <Route className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <DialogTitle>{journeyLabel}</DialogTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                {active ? 'Live Go Agent position' : 'Latest available journey position'}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="p-4 sm:p-6">
          <div
            ref={containerRef}
            className="h-[52dvh] min-h-[320px] overflow-hidden rounded-2xl border bg-muted"
            aria-label="Live task map"
          />

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border bg-muted/25 p-4">
              <p className="text-xs text-muted-foreground">Journey status</p>
              <p className="mt-1 text-sm font-semibold">{meta.customerHeadline}</p>
            </div>
            <div className="rounded-xl border bg-muted/25 p-4">
              <p className="text-xs text-muted-foreground">Distance to current target</p>
              <p className="mt-1 text-sm font-semibold">
                {remainingKm != null
                  ? remainingKm < 1
                    ? `${Math.max(1, Math.round(remainingKm * 1000))} m`
                    : `${remainingKm.toFixed(1)} km`
                  : 'Available when the active route can be determined'}
              </p>
            </div>
          </div>

          <p className="mt-4 text-xs leading-5 text-muted-foreground">
            Distance is calculated from the latest shared position to the current task target.
            Concierge Go does not show a made-up ETA when road-route timing is unavailable.
          </p>

          <div className="mt-5 flex justify-end">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Close map
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
