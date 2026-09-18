'use client'

import { useEffect, useRef, useState } from 'react'
import type { Map as LeafletMap, CircleMarker } from 'leaflet'

import { createClient } from '@/lib/supabase/client'
import type { TaskLiveLocationRow, TaskStatus } from '@/types/database'

interface Coordinate { latitude: number; longitude: number }

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

  useEffect(() => {
    setLocation(initialLocation)
  }, [initialLocation])

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    let disposed = false
    void import('leaflet').then((L) => {
      if (disposed || !containerRef.current) return
      const center = initialLocation
        ? [initialLocation.latitude, initialLocation.longitude] as [number, number]
        : pickup
          ? [pickup.latitude, pickup.longitude] as [number, number]
          : [4.9757, 8.3417] as [number, number]
      const map = L.map(containerRef.current, { zoomControl: true }).setView(center, initialLocation || pickup ? 15 : 12)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map)
      if (pickup) L.circleMarker([pickup.latitude, pickup.longitude], { radius: 7, color: '#0b2d6b', fillOpacity: 0.9 }).bindTooltip('Task location').addTo(map)
      if (destination) L.circleMarker([destination.latitude, destination.longitude], { radius: 7, color: '#f59e0b', fillOpacity: 0.9 }).bindTooltip('Destination').addTo(map)
      if (initialLocation) agentMarkerRef.current = L.circleMarker([initialLocation.latitude, initialLocation.longitude], { radius: 9, color: '#ffffff', weight: 3, fillColor: '#007bff', fillOpacity: 1 }).bindTooltip('Go Agent').addTo(map)
      mapRef.current = map
    })
    return () => {
      disposed = true
      mapRef.current?.remove()
      mapRef.current = null
      agentMarkerRef.current = null
    }
  }, [destination, initialLocation, pickup])

  useEffect(() => {
    if (!location || !mapRef.current) return
    void import('leaflet').then((L) => {
      const point: [number, number] = [location.latitude, location.longitude]
      if (agentMarkerRef.current) agentMarkerRef.current.setLatLng(point)
      else agentMarkerRef.current = L.circleMarker(point, { radius: 9, color: '#ffffff', weight: 3, fillColor: '#007bff', fillOpacity: 1 }).bindTooltip('Go Agent').addTo(mapRef.current!)
      mapRef.current?.panTo(point)
    })
  }, [location])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`task-location:${taskId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_live_locations', filter: `task_id=eq.${taskId}` }, (payload) => {
        if (payload.eventType !== 'DELETE') setLocation(payload.new as TaskLiveLocationRow)
      })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [taskId])

  const active = location?.is_tracking && ['en_route', 'arrived', 'in_progress'].includes(status)

  return (
    <div className="space-y-3">
      <div ref={containerRef} className="h-72 overflow-hidden rounded-lg border bg-muted" aria-label="Live task map" />
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>{active ? 'Live location updating automatically' : location ? 'Last shared Go Agent location' : 'Tracking has not started yet'}</span>
        {location ? <span>{new Date(location.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span> : null}
      </div>
    </div>
  )
}
