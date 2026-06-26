import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date, style: 'short' | 'long' | 'relative' = 'short'): string {
  const d = typeof date === 'string' ? new Date(date) : date
  if (style === 'relative') {
    return formatDistanceToNow(d, { addSuffix: true, locale: es })
  }
  if (style === 'long') {
    return format(d, "d 'de' MMMM 'de' yyyy, HH:mm", { locale: es })
  }
  return format(d, "d/MM/yyyy HH:mm")
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export function formatCedula(cedula: string | null): string {
  if (!cedula) return '—'
  return cedula.replace(/(\d{1,3})(?=(\d{3})+$)/g, '$1.')
}

export function statusLabel(estado: string): string {
  const labels: Record<string, string> = {
    buscado: '🔴 Buscado/a',
    encontrado: '🟢 Encontrado/a',
    fallecido: '⚫ Fallecido/a',
  }
  return labels[estado] || estado
}

export function statusColor(estado: string): string {
  const colors: Record<string, string> = {
    buscado: 'bg-red-100 text-red-800 border-red-200',
    encontrado: 'bg-green-100 text-green-800 border-green-200',
    fallecido: 'bg-gray-100 text-gray-800 border-gray-200',
  }
  return colors[estado] || 'bg-gray-100 text-gray-800'
}

/**
 * Avatar de respaldo (SVG data-URI) para cuando una foto no carga.
 * Genera un avatar con iniciales y color basado en el nombre.
 */
export function avatarFallback(nombre: string, apellido: string): string {
  const initials = ((nombre?.[0] || '') + (apellido?.[0] || '')).toUpperCase() || '?'
  // Deterministic color from name
  const name = (nombre || '') + (apellido || '')
  const hue = name.split('').reduce((h, c) => h + c.charCodeAt(0), 0) % 360
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">` +
    `<rect width="96" height="96" fill="hsl(${hue},60%,92%)"/>` +
    `<text x="48" y="56" text-anchor="middle" font-family="system-ui,sans-serif" font-size="36" font-weight="600" fill="hsl(${hue},50%,35%)">${initials}</text>` +
    `</svg>`
  )
}

/** Legacy data-URI fallback (generic gray silhouette) — kept for map markers */
export const AVATAR_FALLBACK =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" fill="#f1f5f9"/><circle cx="48" cy="38" r="18" fill="#cbd5e1"/><path d="M16 86c0-17.7 14.3-32 32-32s32 14.3 32 32" fill="#cbd5e1"/></svg>'
  )

/**
 * Repara URLs de foto malformadas guardadas por el scraper.
 *
 * Bug 1: falta el "/" entre el dominio y el path, p.ej.
 *   https://...workers.devphotos/migrated/x.webp
 *   → https://...workers.dev/photos/migrated/x.webp
 *
 * Bug 2: VTB movió sus imágenes de /UUID.webp a /media/photos/UUID.webp.
 *   https://...workers.dev/UUID.webp  (404)
 *   → https://...workers.dev/media/photos/UUID.webp  (200)
 *
 * Devuelve null si la URL es vacía/inválida.
 */
export function fixPhotoUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const raw = String(url).trim()
  if (!raw || raw === 'null' || raw === 'undefined') return null
  // Bug puntual del scraper VTB: falta "/" entre ".workers.dev" y el path
  let fixed = raw.replace(/(\.workers\.dev)(?=[A-Za-z0-9])/, '$1/')
  // VTB migration: /UUID.ext → /media/photos/UUID.ext
  fixed = fixed.replace(
    /(\.workers\.dev)\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.[a-z]+)$/i,
    '$1/media/photos/$2'
  )
  return fixed
}

/**
 * Geocodificación APROXIMADA por localidad (estado La Guaira/Vargas y Caracas),
 * para ubicar en el mapa a personas que solo tienen dirección en texto (sin
 * lat/lng). Devuelve coordenadas con un "jitter" determinista por id para que
 * los marcadores de una misma localidad no se apilen. NO es la posición real:
 * marcar siempre como aproximada en la UI.
 */
const LOCALIDADES: Array<[RegExp, number, number]> = [
  [/catia\s*la\s*mar/i, 10.602, -67.03],
  [/maiquet[ií]a/i, 10.601, -66.981],
  [/macuto/i, 10.613, -66.892],
  [/caraballeda|tanaguarena/i, 10.611, -66.851],
  [/naiguat[aá]/i, 10.62, -66.741],
  [/camur[ií]|car[ií]be/i, 10.612, -66.815],
  [/anare|los\s*caracas|osma|oricao|chichiriviche|chuspa/i, 10.62, -66.55],
  [/la\s*guaira|vargas/i, 10.601, -66.931],
  [/caracas|distrito\s*capital|libertador|chacao|sucre|baruta|petare/i, 10.491, -66.879],
]

export function approxCoords(
  ubicacion: string | null | undefined,
  id: string
): { lat: number; lng: number } | null {
  if (!ubicacion) return null
  const hit = LOCALIDADES.find(([re]) => re.test(ubicacion))
  if (!hit) return null
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  const jLat = (((h % 1000) / 1000) - 0.5) * 0.016 // ≈ ±0.9 km
  const jLng = ((((h >> 10) % 1000) / 1000) - 0.5) * 0.016
  return { lat: hit[1] + jLat, lng: hit[2] + jLng }
}

export function severidadColor(severidad: string): string {
  const colors: Record<string, string> = {
    critica: '#dc2626',
    alta: '#f97316',
    media: '#eab308',
    baja: '#22c55e',
  }
  return colors[severidad] || '#6b7280'
}
