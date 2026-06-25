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

export function severidadColor(severidad: string): string {
  const colors: Record<string, string> = {
    critica: '#dc2626',
    alta: '#f97316',
    media: '#eab308',
    baja: '#22c55e',
  }
  return colors[severidad] || '#6b7280'
}
