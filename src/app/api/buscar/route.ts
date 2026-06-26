import { NextRequest, NextResponse } from 'next/server'
import { sqlRaw } from '@/db'
import { approxCoords } from '@/lib/utils'

export const dynamic = 'force-dynamic'

/**
 * Búsqueda unificada y predictiva para el mapa:
 * personas, estructuras (edificios), centros de acopio y lugares/ciudades.
 * GET /api/buscar?q=texto  -> { personas, estructuras, centros, lugares }
 * Cada resultado trae { label, sublabel, lat, lng, tipo, id? } listo para el mapa.
 */

// Ciudades / localidades de Venezuela con coordenadas para "volar" directo
const LUGARES: Array<{ label: string; lat: number; lng: number }> = [
  { label: 'Catia La Mar', lat: 10.602, lng: -67.03 },
  { label: 'Maiquetía', lat: 10.601, lng: -66.981 },
  { label: 'Macuto', lat: 10.613, lng: -66.892 },
  { label: 'Caraballeda', lat: 10.611, lng: -66.851 },
  { label: 'Tanaguarena', lat: 10.611, lng: -66.851 },
  { label: 'Naiguatá', lat: 10.62, lng: -66.741 },
  { label: 'Camurí', lat: 10.612, lng: -66.815 },
  { label: 'La Guaira (Vargas)', lat: 10.601, lng: -66.931 },
  { label: 'Caracas', lat: 10.491, lng: -66.879 },
  { label: 'Chacao', lat: 10.497, lng: -66.853 },
  { label: 'Petare', lat: 10.476, lng: -66.808 },
  { label: 'Baruta', lat: 10.433, lng: -66.876 },
  { label: 'El Hatillo', lat: 10.42, lng: -66.82 },
  { label: 'Los Teques', lat: 10.344, lng: -67.041 },
  { label: 'Maracay', lat: 10.247, lng: -67.596 },
  { label: 'Valencia', lat: 10.162, lng: -68.008 },
  { label: 'Maracaibo', lat: 10.654, lng: -71.64 },
  { label: 'Barquisimeto', lat: 10.073, lng: -69.322 },
  { label: 'Mérida', lat: 8.594, lng: -71.144 },
  { label: 'San Cristóbal', lat: 7.767, lng: -72.225 },
  { label: 'Barcelona', lat: 10.135, lng: -64.683 },
  { label: 'Puerto La Cruz', lat: 10.214, lng: -64.633 },
  { label: 'Maturín', lat: 9.745, lng: -63.176 },
  { label: 'Ciudad Guayana', lat: 8.353, lng: -62.652 },
  { label: 'Cumaná', lat: 10.454, lng: -64.177 },
  { label: 'Coro', lat: 11.402, lng: -69.673 },
  { label: 'Punto Fijo', lat: 11.71, lng: -70.205 },
  { label: 'Valera', lat: 9.318, lng: -70.604 },
  { label: 'Acarigua', lat: 9.557, lng: -69.202 },
]

export async function GET(request: NextRequest) {
  try {
    const q = (new URL(request.url).searchParams.get('q') || '').trim()
    if (q.length < 2) return NextResponse.json({ personas: [], estructuras: [], centros: [], lugares: [] })
    const like = `%${q}%`
    const sql = sqlRaw()

    const [personasRows, edifRows, centroRows] = await Promise.all([
      sql`
        SELECT id, nombre, apellido, estado, ultima_ubicacion AS "ultimaUbicacion", lat, lng
        FROM personas
        WHERE coalesce(sin_identificar,false) = false
          AND (nombre ILIKE ${like} OR apellido ILIKE ${like}
               OR (nombre || ' ' || apellido) ILIKE ${like}
               OR coalesce(ultima_ubicacion,'') ILIKE ${like})
        ORDER BY (foto_url IS NOT NULL) DESC, (estado = 'buscado') DESC
        LIMIT 8` as Promise<Array<Record<string, any>>>,
      sql`
        SELECT id, nombre, direccion, ciudad, lat, lng, nivel_danio AS "nivelDanio"
        FROM edificios
        WHERE nombre ILIKE ${like} OR coalesce(direccion,'') ILIKE ${like} OR coalesce(ciudad,'') ILIKE ${like}
        ORDER BY (lat IS NOT NULL) DESC
        LIMIT 8` as Promise<Array<Record<string, any>>>,
      sql`
        SELECT id, nombre, direccion, lat, lng, recibe
        FROM recursos
        WHERE activo = true AND tipo = 'centro_acopio'
          AND (nombre ILIKE ${like} OR coalesce(direccion,'') ILIKE ${like})
        ORDER BY (lat IS NOT NULL) DESC
        LIMIT 6` as Promise<Array<Record<string, any>>>,
    ])

    const personas = personasRows
      .map((p) => {
        const c = p.lat != null && p.lng != null ? { lat: p.lat, lng: p.lng } : approxCoords(p.ultimaUbicacion, p.id)
        if (!c) return null
        return {
          tipo: 'persona',
          id: p.id,
          label: `${p.nombre} ${p.apellido}`.trim(),
          sublabel: p.ultimaUbicacion || (p.estado === 'buscado' ? 'Buscado/a' : p.estado),
          estado: p.estado,
          lat: c.lat,
          lng: c.lng,
        }
      })
      .filter(Boolean)

    const estructuras = edifRows
      .filter((e) => e.lat != null && e.lng != null)
      .map((e) => ({
        tipo: 'estructura',
        id: e.id,
        label: e.nombre,
        sublabel: [e.direccion, e.ciudad].filter(Boolean).join(', ') || (e.nivelDanio ? `Daño: ${e.nivelDanio}` : ''),
        lat: e.lat,
        lng: e.lng,
      }))

    const centros = centroRows
      .filter((c) => c.lat != null && c.lng != null)
      .map((c) => ({
        tipo: 'centro',
        id: c.id,
        label: c.nombre,
        sublabel: c.direccion || (c.recibe ? `Recibe: ${c.recibe}` : ''),
        lat: c.lat,
        lng: c.lng,
      }))

    const ql = q.toLowerCase()
    const lugares = LUGARES.filter((l) => l.label.toLowerCase().includes(ql))
      .slice(0, 6)
      .map((l) => ({ tipo: 'lugar', label: l.label, sublabel: 'Ciudad / localidad', lat: l.lat, lng: l.lng }))

    return NextResponse.json({ personas, estructuras, centros, lugares })
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}
