'use client'

import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import { fixPhotoUrl, AVATAR_FALLBACK } from '@/lib/utils'

// ── Custom markers: Red (buscado), Yellow (posible avistamiento), Green (encontrado), Gray (fallecido) ──
function createIcon(color: string, emoji: string, pulse = false) {
  const pulseStyle = pulse
    ? `<div style="position:absolute;top:-6px;left:-6px;width:40px;height:40px;border-radius:50%;border:2px solid ${color};animation:pulse-ring 2s ease-out infinite;opacity:0.6"></div>`
    : ''
  return L.divIcon({
    html: `<div style="position:relative">
      <div style="background:${color};width:28px;height:28px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;font-size:14px;line-height:1">${emoji}</div>
      ${pulseStyle}
    </div>`,
    className: '',
    iconSize: pulse ? [40, 40] : [28, 28],
    iconAnchor: pulse ? [20, 20] : [14, 14],
    popupAnchor: [0, pulse ? -22 : -16],
  })
}

const icons: Record<string, L.DivIcon> = {
  buscado: createIcon('#dc2626', '', true),
  encontrado: createIcon('#16a34a', ''),
  fallecido: createIcon('#6b7280', ''),
  'posible-avistamiento': createIcon('#eab308', ''),
}

const defaultIcon = createIcon('#dc2626', '', true)

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
  aproximada?: boolean
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
  focus?: { lat: number; lng: number; key?: number } | null
}

export default function Map({
  personas,
  zonas = [],
  onSelectPersona,
  className,
  focus,
}: MapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const layersRef = useRef<L.LayerGroup>(L.layerGroup())
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null)
  const didFitRef = useRef(false)
  const [legendOpen, setLegendOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [cursorLat, setCursorLat] = useState<number | null>(null)
  const [cursorLng, setCursorLng] = useState<number | null>(null)

  // Init map
  useEffect(() => {
    setMounted(true)
  }, [])

  // Centrar el mapa cuando se pide enfocar una persona
  useEffect(() => {
    if (focus && mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([focus.lat, focus.lng], 16, { duration: 0.8 })
    }
  }, [focus])

  useEffect(() => {
    if (!mounted || !mapRef.current || mapInstanceRef.current) return

    // Límites de Venezuela: el mapa no se puede arrastrar ni alejar fuera del país
    const VEN_BOUNDS = L.latLngBounds([0.6, -73.4], [12.3, -59.8])
    const map = L.map(mapRef.current, {
      center: [10.56, -66.92], // La Guaira / Vargas — epicentro del sismo y de los reportes
      zoom: 11,
      minZoom: 6,
      zoomControl: false,
      maxBounds: VEN_BOUNDS,
      maxBoundsViscosity: 1.0,
    })
    mapInstanceRef.current = map

    // Zoom control on the right
    L.control.zoom({ position: 'topright' }).addTo(map)

    // Tile layer — CartoDB Positron (clean, professional)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://openstreetmap.org">OSM</a> &copy; <a href="https://carto.com">CARTO</a>',
      maxZoom: 19,
    }).addTo(map)

    // Capa de zonas + grupo de clustering para personas
    layersRef.current.addTo(map)
    const cluster = L.markerClusterGroup({
      maxClusterRadius: 55,
      showCoverageOnHover: false,
      chunkedLoading: true,
      spiderfyOnMaxZoom: true,
    })
    clusterRef.current = cluster
    map.addLayer(cluster)

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
    clusterRef.current?.clearLayers()

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

    // ── PERSON MARKERS (agrupados por ubicación) ──
    const statusLabels: Record<string, string> = {
      buscado: '🔴 Buscado/a',
      encontrado: '✅ Encontrado/a vivo/a',
      fallecido: '⚫ Fallecido/a',
      'posible-avistamiento': '⚠️ Posible avistamiento',
    }
    const colorEstado = (e: string) => (e === 'buscado' ? '#dc2626' : e === 'encontrado' ? '#16a34a' : '#6b7280')

    // Agrupar por coordenada (misma ubicación → mismo punto)
    const grupos: Record<string, PersonaMarker[]> = {}
    personas.forEach((p) => {
      const key = `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`
      if (!grupos[key]) grupos[key] = []
      grupos[key].push(p)
    })

    Object.values(grupos).forEach((grupo) => {
      const first = grupo[0]

      if (grupo.length === 1) {
        const p = first
        const marker = L.marker([p.lat, p.lng], { icon: icons[p.estado] || defaultIcon })
        const popup = `
          <div style="min-width:220px;font-family:system-ui">
            ${fixPhotoUrl(p.fotoUrl) ? `<img src="${fixPhotoUrl(p.fotoUrl)}" onerror="this.onerror=null;this.src='${AVATAR_FALLBACK}'" style="width:60px;height:60px;border-radius:8px;object-fit:cover;float:left;margin-right:10px" />` : ''}
            <div style="font-weight:700;font-size:15px">${p.nombre} ${p.apellido}</div>
            <div style="font-size:12px;margin-top:4px;font-weight:600;color:${colorEstado(p.estado)}">${statusLabels[p.estado] || p.estado}</div>
            ${p.ultimaUbicacion ? `<div style="font-size:12px;margin-top:3px">📍 <strong>${p.ultimaUbicacion}</strong></div>` : ''}
            ${p.aproximada ? `<div style="font-size:11px;margin-top:3px;color:#b45309">⚠️ Posición aproximada por localidad</div>` : ''}
            <div style="margin-top:8px;clear:both">
              <button onclick="window.__selectPersona('${p.id}')" style="background:#dc2626;color:white;border:none;padding:6px 16px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;width:100%">Ver ficha completa</button>
            </div>
          </div>`
        marker.bindPopup(popup, { maxWidth: 300 })
        marker.on('click', () => onSelectPersona?.(p.id))
        clusterRef.current?.addLayer(marker)
      } else {
        // Varias personas en el mismo lugar → marcador con conteo + lista seleccionable
        const color = colorEstado(first.estado)
        const clusterIcon = L.divIcon({
          html: `<div style="background:${color};color:#fff;min-width:34px;height:34px;padding:0 6px;border-radius:17px;border:3px solid #fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;box-shadow:0 1px 5px rgba(0,0,0,.45)">${grupo.length}</div>`,
          className: '',
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        })
        const marker = L.marker([first.lat, first.lng], { icon: clusterIcon })
        const lista = grupo
          .slice(0, 60)
          .map(
            (p) => `
            <button onclick="window.__selectPersona('${p.id}')" style="display:flex;gap:8px;width:100%;text-align:left;align-items:center;border:none;background:#fff;border-bottom:1px solid #f0f0f0;padding:6px;cursor:pointer">
              ${fixPhotoUrl(p.fotoUrl) ? `<img src="${fixPhotoUrl(p.fotoUrl)}" onerror="this.onerror=null;this.src='${AVATAR_FALLBACK}'" style="width:38px;height:38px;border-radius:6px;object-fit:cover;flex-shrink:0"/>` : `<div style="width:38px;height:38px;border-radius:6px;background:#eee;flex-shrink:0"></div>`}
              <span style="min-width:0"><span style="font-weight:600;font-size:13px;display:block;color:#111">${p.nombre} ${p.apellido}</span><span style="font-size:11px;color:${colorEstado(p.estado)}">${statusLabels[p.estado] || p.estado}</span></span>
            </button>`
          )
          .join('')
        const popup = `
          <div style="width:250px;font-family:system-ui">
            <div style="font-weight:700;font-size:12px;padding:8px;background:#f8f8f8;border-radius:6px 6px 0 0">${grupo.length} personas en ${first.ultimaUbicacion || 'esta zona'} — selecciona:</div>
            <div style="max-height:280px;overflow-y:auto">${lista}</div>
            ${grupo.length > 60 ? `<div style="padding:6px;font-size:11px;color:#888">y ${grupo.length - 60} más… (acércate para separar)</div>` : ''}
          </div>`
        marker.bindPopup(popup, { maxWidth: 280, minWidth: 250 })
        clusterRef.current?.addLayer(marker)
      }
    })

    // Fit bounds
    const allPoints: L.LatLngTuple[] = [
      ...personas.filter(p => p.lat && p.lng).map(p => [p.lat, p.lng] as L.LatLngTuple),
      ...zonas.filter(z => z.lat && z.lng).map(z => [z.lat, z.lng] as L.LatLngTuple),
    ]
    // Ajustar la vista SOLO la primera vez que llegan datos (no en cada cambio,
    // para que al cerrar una ficha el mapa NO se aleje a todo el país).
    if (allPoints.length > 0 && !didFitRef.current) {
      const bounds = L.latLngBounds(allPoints)
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 })
        didFitRef.current = true
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
        <div className="absolute bottom-3 left-3 bg-black/70 text-white text-xs px-2 py-1 rounded z-[400] pointer-events-none">
          📍 {cursorLat.toFixed(4)}, {cursorLng?.toFixed(4)}
        </div>
      )}

      {/* Leyenda minimizable (abajo-derecha, fuera del control de zoom) */}
      <div className="absolute bottom-3 right-3 z-[400]">
        <button
          type="button"
          onClick={() => setLegendOpen((o) => !o)}
          aria-expanded={legendOpen}
          className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white/95 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-gray-600 shadow-md hover:bg-white"
        >
          Leyenda <span className="text-gray-400">{legendOpen ? '▾' : '▸'}</span>
        </button>
        {legendOpen && (
          <div className="mt-1 space-y-1.5 rounded-lg border border-gray-200 bg-white/95 px-3 py-2 text-[11px] shadow-md backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-full bg-red-600 inline-block shrink-0"></span>
              <span>Buscado</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-full bg-green-600 inline-block shrink-0"></span>
              <span>Encontrado</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-full bg-gray-500 inline-block shrink-0"></span>
              <span>Fallecido</span>
            </div>
            <div className="border-t border-gray-100 pt-1.5">
              <div className="text-[10px] text-gray-400 mb-1">Zonas afectadas</div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full border-2 border-red-600 bg-red-600/20 inline-block shrink-0"></span>
                <span>Crítica</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full border-2 border-orange-500 bg-orange-500/15 inline-block shrink-0"></span>
                <span>Alta</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full border-2 border-yellow-500 bg-yellow-500/10 inline-block shrink-0"></span>
                <span>Media</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
