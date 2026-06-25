/**
 * Anti-spam para los endpoints públicos de alta.
 * - Bloquea fuentes/términos vetados (inyección de datos).
 * - Rechaza enlaces (URLs) en campos que no deben tenerlos (nombre, apellido,
 *   descripción, ubicación) — vector típico de spam.
 */

// Términos bloqueados (fuente o contenido). Ampliable.
const BLOQUEADOS = [
  'infinityhotel.it',
  'trustedf57',
  'casino',
  'viagra',
  'porn',
  'sex',
  'bet365',
  'crypto',
  'bitcoin',
  't.me/',
  'whatsapp.com/channel',
]

const URL_RE = /(https?:\/\/|www\.|t\.me\/|\b[a-z0-9-]+\.(com|net|org|it|ru|xyz|info|biz|top|click|shop)\b)/i

interface Campos {
  nombre?: string | null
  apellido?: string | null
  descripcion?: string | null
  ultimaUbicacion?: string | null
  reportadoPorNombre?: string | null
  reportadoPorEmail?: string | null
  source?: string | null
}

/** Devuelve un motivo (string) si debe rechazarse, o null si está OK. */
export function motivoRechazo(c: Campos): string | null {
  const blob = [
    c.nombre,
    c.apellido,
    c.descripcion,
    c.ultimaUbicacion,
    c.reportadoPorNombre,
    c.reportadoPorEmail,
    c.source,
  ]
    .filter(Boolean)
    .join(' \n ')
    .toLowerCase()

  for (const t of BLOQUEADOS) {
    if (blob.includes(t)) return 'Contenido o fuente no permitida'
  }

  // No se permiten enlaces en estos campos
  for (const v of [c.nombre, c.apellido, c.descripcion, c.ultimaUbicacion]) {
    if (v && URL_RE.test(v)) return 'No se permiten enlaces en el nombre, apellido, descripción ni ubicación'
  }
  return null
}
