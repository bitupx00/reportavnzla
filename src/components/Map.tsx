'use client'

import { useEffect, useState, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix default marker icon
const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

const redIcon = L.divIcon({
  html: `<div style="background:#dc2626;width:24px;height:24px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>`,
  className: '',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  popupAnchor: [0, -14],
})

const greenIcon = L.divIcon({
  html: `<div style="background:#16a34a;width:24px;height:24px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>`,
  className: '',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  popupAnchor: [0, -14],
})

const grayIcon = L.divIcon({
  html: `<div style="background:#6b7280;width:24px;height:24px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>`,
  className: '',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  popupAnchor: [0, -14],
})

export interface PersonaMarker {
  id: string
  nombre: string
  apellido: string
  cedula: string | null
  estado: string
  lat: number
  lng: number
  ultimaUbicacion: string | null
}

export interface ZonaAfectada {
  id: string
  nombre: string
  lat: number
  lng: number
  radioKm: number | null
  severidad: string
}

interface MapProps {
  personas: PersonaMarker[]
  zonas?: ZonaAfectada[]
  onSelectPersona?: (id: string) => void
  className?: string
}

export default function Map({ personas, zonas = [], onSelectPersona, className }: MapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted || !mapRef.current || mapInstanceRef.current) return

    const map = L.map(mapRef.current).setView([8.0, -66.0], 7)
    mapInstanceRef.current = map

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(map)

    return () => {
      map.remove()
      mapInstanceRef.current = null
    }
  }, [mounted])

  // Update markers
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return

    // Clear existing markers
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker || layer instanceof L.Circle) {
        map.removeLayer(layer)
      }
    })

    // Add zona circles
    zonas.forEach((zona) => {
      const color: Record<string, string> = {
        critica: '#dc2626',
        alta: '#f97316',
        media: '#eab308',
        baja: '#22c55e',
      }
      L.circle([zona.lat, zona.lng], {
        radius: (zona.radioKm || 10) * 1000,
        color: color[zona.severidad] || '#6b7280',
        fillColor: color[zona.severidad] || '#6b7280',
        fillOpacity: 0.15,
        weight: 2,
      }).addTo(map).bindPopup(`<strong>${zona.nombre}</strong><br>Severidad: ${zona.severidad}`)
    })

    // Add persona markers
    const iconMap: Record<string, L.DivIcon> = {
      buscado: redIcon,
      encontrado: greenIcon,
      fallecido: grayIcon,
    }

    personas.forEach((p) => {
      const marker = L.marker([p.lat, p.lng], {
        icon: iconMap[p.estado] || defaultIcon,
      }).addTo(map)

      const statusLabel: Record<string, string> = {
        buscado: '🔴 Buscado/a',
        encontrado: '🟢 Encontrado/a',
        fallecido: '⚫ Fallecido/a',
      }

      marker.bindPopup(
        `<div style="min-width:180px">
          <div style="font-weight:600;font-size:14px">${p.nombre} ${p.apellido}</div>
          <div style="font-size:12px;color:#666;margin-top:4px">${statusLabel[p.estado] || p.estado}</div>
          ${p.cedula ? `<div style="font-size:12px;margin-top:2px">C.I.: ${p.cedula}</div>` : ''}
          ${p.ultimaUbicacion ? `<div style="font-size:12px;margin-top:2px">📍 ${p.ultimaUbicacion}</div>` : ''}
          <button onclick="window.__selectPersona('${p.id}')" style="margin-top:8px;background:#dc2626;color:white;border:none;padding:4px 12px;border-radius:6px;cursor:pointer;font-size:12px">Ver ficha</button>
        </div>`
      )

      marker.on('click', () => {
        onSelectPersona?.(p.id)
      })
    })

    // Fit bounds if there are markers
    const hasMarkers = personas.length > 0 || zonas.length > 0
    if (hasMarkers) {
      const bounds = L.latLngBounds([
        ...personas.filter(p => p.lat && p.lng).map(p => [p.lat, p.lng] as L.LatLngTuple),
        ...zonas.filter(z => z.lat && z.lng).map(z => [z.lat, z.lng] as L.LatLngTuple),
      ])
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [30, 30], maxZoom: 12 })
      }
    }
  }, [personas, zonas, onSelectPersona])

  if (!mounted) {
    return <div className={`bg-gray-200 animate-pulse rounded-xl ${className || 'map-container'}`} />
  }

  return (
    <div className="relative">
      <div ref={mapRef} className={className || 'map-container'} />
      {personas.length === 0 && zonas.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-xl pointer-events-none">
          <p className="text-gray-400 text-sm">Cargando mapa...</p>
        </div>
      )}
    </div>
  )
}
