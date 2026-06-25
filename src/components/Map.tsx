'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// ── Custom markers: Red (buscado), Yellow (posible avistamiento), Green (encontrado), Gray (fallecido) ──
function createIcon(color: string, emoji: string) {
  return L.divIcon({
    html: `<div style="background:${color};width:28px;height:28px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;font-size:14px;line-height:1">${emoji}</div>`,
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16],
  })
}

const icons: Record<string, L.DivIcon> = {
  buscado: createIcon('#dc2626', '🔴'),
  encontrado: createIcon('#16a34a', '✅'),
  fallecido: createIcon('#6b7280', '⚫'),
  'posible-avistamiento': createIcon('#eab308', '⚠️'),
}

const defaultIcon = createIcon('#dc2626', '🔴')

// ── Severity colors for zones ──
const severityColors: Record<string, { border: string; fill: string }> = {
  critica: { border: '#dc2626', fill: 'rgba(220,38,38,0.18)' },
  alta: { border: '#f97316', fill: 'rgba(249,115,22,0.15)' },
  media: { border: '#eab308', fill: 'rgba(234,179,8,0.12)' },
  baja: { border: '#22c55e', fill: 'rgba(34,197,94,0.10)' },
}

const severityLabels: Record<string, string> = {
  critica: '🔴 Crítica',
  alta: '🟠 Alta',
  media: '🟡 Media',
  baja: '🟢 Baja',
}

export interface PersonaMarker {
  id: string
  nombre: string
  apellido: string
  cedula: string | null
  edad: number | null
  estado: string
  lat: number
  lng: number
  ultimaUbicacion: string | null
  descripcion: string | null
  fotoUrl: string | null
  createdAt: string
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
  onAddLocation?: (lat: number, lng: number) => void
  addingLocation?: boolean
  className?: string
}

export default function Map({
  personas,
  zonas = [],
  onSelectPersona,
  onAddLocation,
  addingLocation = false,
  className,
}: MapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const layersRef = useRef<L.LayerGroup>(L.layerGroup())
  const [mounted, setMounted] = useState(false)
  const [cursorLat, setCursorLat] = useState<number | null>(null)
  const [cursorLng, setCursorLng] = useState<number | null>(null)

  // Init map
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted || !mapRef.current || mapInstanceRef.current) return

    const map = L.map(mapRef.current, {
      center: [9.5, -66.5],
      zoom: 7,
      zoomControl: true,
    })
    mapInstanceRef.current = map

    // Tile layer — CartoDB Positron (clean, professional)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://openstreetmap.org">OSM</a> &copy; <a href="https://carto.com">CARTO</a>',
      maxZoom: 19,
    }).addTo(map)

    // Add layer group
    layersRef.current.addTo(map)

    // Click handler for adding locations
    map.on('click', (e: L.LeafletMouseEvent) => {
      if (addingLocation && onAddLocation) {
        onAddLocation(e.latlng.lat, e.latlng.lng)
      }
    })

    // Mouse move for coordinates display
    map.on('mousemove', (e: L.LeafletMouseEvent) => {
      setCursorLat(e.latlng.lat)
      setCursorLng(e.latlng.lng)
    })

    return () => {
      map.remove()
      mapInstanceRef.current = null
    }
  }, [mounted])

  // Update markers and zones
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return

    layersRef.current.clearLayers()

    // ── ZONA CIRCLES ──
    zonas.forEach((zona) => {
      const colors = severityColors[zona.severidad] || severityColors.media
      const circle = L.circle([zona.lat, zona.lng], {
        radius: (zona.radioKm || 15) * 1000,
        color: colors.border,
        fillColor: colors.fill,
        fillOpacity: 1,
        weight: 2,
        dashArray: zona.severidad === 'critica' ? undefined : '6 4',
      })

      circle.bindPopup(`
        <div style="min-width:200px;font-family:system-ui">
          <div style="font-weight:700;font-size:14px">${zona.nombre}</div>
          <div style="font-size:12px;margin-top:4px">${severityLabels[zona.severidad] || zona.severidad}</div>
          <div style="font-size:11px;color:#666;margin-top:2px">Radio: ${zona.radioKm || 15} km</div>
        </div>
      `)

      layersRef.current.addLayer(circle)

      // Center marker for zone
      const zoneIcon = L.divIcon({
        html: `<div style="background:${colors.border};width:16px;height:16px;border-radius:50%;border:2px solid white;opacity:0.7"></div>`,
        className: '',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      })
      const zoneMarker = L.marker([zona.lat, zona.lng], { icon: zoneIcon, interactive: false })
      layersRef.current.addLayer(zoneMarker)
    })

    // ── PERSON MARKERS ──
    personas.forEach((p) => {
      const icon = icons[p.estado] || defaultIcon

      const marker = L.marker([p.lat, p.lng], { icon })

      const statusLabels: Record<string, string> = {
        buscado: '🔴 Buscado/a',
        encontrado: '✅ Encontrado/a vivo/a',
        fallecido: '⚫ Fallecido/a',
        'posible-avistamiento': '⚠️ Posible avistamiento',
      }

      const popup = `
        <div style="min-width:220px;font-family:system-ui">
          ${p.fotoUrl ? `<img src="${p.fotoUrl}" style="width:60px;height:60px;border-radius:8px;object-fit:cover;float:left;margin-right:10px" />` : ''}
          <div style="font-weight:700;font-size:15px">${p.nombre} ${p.apellido}</div>
          <div style="font-size:12px;margin-top:4px;font-weight:600;color:${p.estado === 'buscado' ? '#dc2626' : p.estado === 'encontrado' ? '#16a34a' : '#6b7280'}">${statusLabels[p.estado] || p.estado}</div>
          ${p.cedula ? `<div style="font-size:12px;margin-top:3px">📄 C.I.: <strong>${p.cedula}</strong></div>` : ''}
          ${p.edad ? `<div style="font-size:12px">👤 Edad: ${p.edad} años</div>` : ''}
          ${p.ultimaUbicacion ? `<div style="font-size:12px;margin-top:3px">📍 Última ubicación: <strong>${p.ultimaUbicacion}</strong></div>` : ''}
          ${p.descripcion ? `<div style="font-size:11px;color:#555;margin-top:4px;line-height:1.4">${p.descripcion.substring(0, 120)}${p.descripcion.length > 120 ? '...' : ''}</div>` : ''}
          <div style="margin-top:8px">
            <button onclick="window.__selectPersona('${p.id}')" style="background:#dc2626;color:white;border:none;padding:6px 16px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;width:100%">Ver ficha completa</button>
          </div>
        </div>
      `

      marker.bindPopup(popup, { maxWidth: 300 })
      marker.on('click', () => onSelectPersona?.(p.id))

      // Pulsing animation for "buscado" markers
      if (p.estado === 'buscado') {
        const pulseIcon = L.divIcon({
          html: `<div style="position:relative">
            <div style="background:#dc2626;width:28px;height:28px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.35)"></div>
            <div style="position:absolute;top:-6px;left:-6px;width:40px;height:40px;border-radius:50%;border:2px solid #dc2626;animation:pulse-ring 2s ease-out infinite;opacity:0.6"></div>
          </div>`,
          className: '',
          iconSize: [40, 40],
          iconAnchor: [20, 20],
          popupAnchor: [0, -22],
        })
        marker.setIcon(pulseIcon)
      }

      layersRef.current.addLayer(marker)
    })

    // Fit bounds
    const allPoints: L.LatLngTuple[] = [
      ...personas.filter(p => p.lat && p.lng).map(p => [p.lat, p.lng] as L.LatLngTuple),
      ...zonas.filter(z => z.lat && z.lng).map(z => [z.lat, z.lng] as L.LatLngTuple),
    ]
    if (allPoints.length > 0) {
      const bounds = L.latLngBounds(allPoints)
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 })
      }
    }
  }, [personas, zonas, onSelectPersona])

  // Expose selectPersona to window for popup buttons
  useEffect(() => {
    ;(window as any).__selectPersona = onSelectPersona
    return () => { delete (window as any).__selectPersona }
  }, [onSelectPersona])

  if (!mounted) {
    return <div className={`bg-gray-200 animate-pulse rounded-xl ${className || 'map-container'}`} />
  }

  return (
    <div className="relative">
      <div ref={mapRef} className={className || 'map-container'} />

      {/* Coordinates display */}
      {cursorLat !== null && (
        <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded z-[1000] pointer-events-none">
          📍 {cursorLat.toFixed(4)}, {cursorLng?.toFixed(4)}
        </div>
      )}

      {/* Adding location mode indicator */}
      {addingLocation && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-yellow-500 text-black font-bold text-sm px-4 py-2 rounded-full z-[1000] shadow-lg animate-bounce">
          📍 Haz clic en el mapa para marcar la ubicación
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-2 right-2 bg-white/90 backdrop-blur-sm rounded-lg p-2 z-[1000] shadow-sm border border-gray-200">
        <div className="text-[10px] font-semibold text-gray-600 mb-1">LEYENDA</div>
        <div className="space-y-1 text-[10px]">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-red-600 inline-block"></span>
            <span>Buscado</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-yellow-500 inline-block"></span>
            <span>Posible avistamiento</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-green-600 inline-block"></span>
            <span>Encontrado</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-gray-500 inline-block"></span>
            <span>Fallecido</span>
          </div>
          <hr className="border-gray-200 my-1" />
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full border-2 border-red-600 bg-red-600/20 inline-block"></span>
            <span>Zona crítica</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full border-2 border-orange-500 bg-orange-500/15 inline-block"></span>
            <span>Zona alta</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full border-2 border-yellow-500 bg-yellow-500/10 inline-block"></span>
            <span>Zona media</span>
          </div>
        </div>
      </div>
    </div>
  )
}
