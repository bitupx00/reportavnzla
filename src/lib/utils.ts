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
 * Evita un request extra y nunca falla.
 */
export const AVATAR_FALLBACK =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" fill="#f1f5f9"/><circle cx="48" cy="38" r="18" fill="#cbd5e1"/><path d="M16 86c0-17.7 14.3-32 32-32s32 14.3 32 32" fill="#cbd5e1"/></svg>'
  )

/**
 * Repara URLs de foto malformadas guardadas por el scraper.
 *
 * Bug en producción: falta el "/" entre el dominio y el path, p.ej.
 *   https://...workers.devphotos/migrated/x.webp
 *   → https://...workers.dev/photos/migrated/x.webp
 * Inserta la barra que falta tras el dominio; no toca URLs ya correctas.
 * Devuelve null si la URL es vacía/inválida.
 */
export function fixPhotoUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const raw = String(url).trim()
  if (!raw || raw === 'null' || raw === 'undefined') return null
  // Bug puntual del scraper VTB: falta "/" entre ".workers.dev" y el path
  // (ej: ...workers.devphotos/x.webp). Reparamos SOLO ese caso; cualquier otro
  // host (S3 .com, supabase, etc.) se deja intacto para no corromper URLs válidas.
  return raw.replace(/(\.workers\.dev)(?=[A-Za-z0-9])/, '$1/')
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
