import { NextRequest, NextResponse } from 'next/server'
import { sqlRaw } from '@/db'
import { motivoRechazo } from '@/lib/antispam'
import { rateLimit, getIp } from '@/lib/ratelimit'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Estructuras / edificios afectados (tabla `edificios`).
 * Endpoint propio (la importación masiva vive en /api/v1/edificios y NO se toca aquí).
 *  - GET  /api/edificios?q=texto&limit=  -> lista para el sidebar.
 *  - POST /api/edificios                 -> añadir una estructura (comunidad).
 *  - PATCH /api/edificios  {id, fotoUrl} -> añadir/actualizar foto (data URI).
 */

const NIVELES = ['total', 'severo', 'parcial', 'leve']

// GET — lista con búsqueda opcional por ciudad/zona/nombre/dirección
export async function GET(request: NextRequest) {
  try {
    const sp = new URL(request.url).searchParams
    const q = (sp.get('q') || '').trim()
    const limit = Math.min(parseInt(sp.get('limit') || '600', 10) || 600, 1000)
    const sql = sqlRaw()
    const like = `%${q}%`
    const rows = q
      ? await sql`
          SELECT id, nombre, direccion, ciudad, zona, lat, lng,
                 nivel_danio AS "nivelDanio", estado, foto_url AS "fotoUrl",
                 fuente, notas, nombres_atrapados AS "nombresAtrapados",
                 tiene_desaparecidos AS "tieneDesaparecidos", created_at AS "createdAt"
          FROM edificios
          WHERE coalesce(nombre,'') ILIKE ${like} OR coalesce(direccion,'') ILIKE ${like}
             OR coalesce(ciudad,'') ILIKE ${like} OR coalesce(zona,'') ILIKE ${like}
          ORDER BY (foto_url IS NOT NULL) DESC, created_at DESC LIMIT ${limit}`
      : await sql`
          SELECT id, nombre, direccion, ciudad, zona, lat, lng,
                 nivel_danio AS "nivelDanio", estado, foto_url AS "fotoUrl",
                 fuente, notas, nombres_atrapados AS "nombresAtrapados",
                 tiene_desaparecidos AS "tieneDesaparecidos", created_at AS "createdAt"
          FROM edificios
          ORDER BY (foto_url IS NOT NULL) DESC, created_at DESC LIMIT ${limit}`
    return NextResponse.json({ data: rows })
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}

// POST — añadir una estructura afectada
export async function POST(request: NextRequest) {
  try {
    const b = await request.json()
    if (b._hp) return NextResponse.json({ ok: true }, { status: 200 }) // honeypot
    const nombre = String(b.nombre || '').trim()
    if (!nombre) return NextResponse.json({ error: 'nombre requerido' }, { status: 400 })

    const rl = await rateLimit(getIp(request))
    if (!rl.ok) return NextResponse.json({ error: 'Demasiadas solicitudes. Intenta en unos minutos.' }, { status: 429 })

    const motivo = motivoRechazo({
      nombre,
      descripcion: b.notas || b.descripcion,
      ultimaUbicacion: b.direccion,
    })
    if (motivo) return NextResponse.json({ error: motivo }, { status: 400 })

    const sql = sqlRaw()
    const lat = b.lat != null && !Number.isNaN(parseFloat(b.lat)) ? parseFloat(b.lat) : null
    const lng = b.lng != null && !Number.isNaN(parseFloat(b.lng)) ? parseFloat(b.lng) : null
    const nivel = NIVELES.includes(b.nivelDanio) ? b.nivelDanio : null
    const notas = (b.notas || b.descripcion) ? String(b.notas || b.descripcion).slice(0, 1000) : null

    const rows = (await sql`
      INSERT INTO edificios (nombre, direccion, ciudad, lat, lng, nivel_danio, estado, fuente, notas)
      VALUES (${nombre.slice(0, 300)}, ${b.direccion ? String(b.direccion).slice(0, 1000) : null},
              ${b.ciudad ? String(b.ciudad).slice(0, 100) : null}, ${lat}, ${lng},
              ${nivel}, ${'comunidad'}, ${'comunidad'}, ${notas})
      RETURNING id`) as Array<{ id: string }>
    return NextResponse.json({ ok: true, id: rows[0]?.id }, { status: 201 })
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}

// PATCH — añadir/actualizar la foto de una estructura (foto comprimida en data URI)
export async function PATCH(request: NextRequest) {
  try {
    const b = await request.json()
    const id = String(b.id || '').trim()
    const fotoUrl = String(b.fotoUrl || '')
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })
    // Solo aceptamos imágenes embebidas (data URI) para evitar enlaces/spam externos
    if (!fotoUrl.startsWith('data:image/')) {
      return NextResponse.json({ error: 'foto inválida' }, { status: 400 })
    }

    const rl = await rateLimit(getIp(request))
    if (!rl.ok) return NextResponse.json({ error: 'Demasiadas solicitudes. Intenta en unos minutos.' }, { status: 429 })

    const sql = sqlRaw()
    const rows = (await sql`
      UPDATE edificios SET foto_url = ${fotoUrl}, updated_at = now() WHERE id = ${id} RETURNING id`) as Array<{ id: string }>
    if (!rows[0]) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}
