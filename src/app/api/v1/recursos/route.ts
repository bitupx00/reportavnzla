import { NextRequest, NextResponse } from 'next/server'
import { sqlRaw } from '@/db'
import { motivoRechazo } from '@/lib/antispam'
import { rateLimit, getIp } from '@/lib/ratelimit'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * API pública v1 — Recursos (bidireccional: GET recibir / POST enviar).
 *   tipo 'centro_acopio' -> tabla `recursos`
 *   tipo 'estructura'    -> tabla `edificios`
 *
 * GET  /api/v1/recursos?tipo=&since=<ms|ISO>&page=1&pageSize=200
 *      -> { success, tipo, page, pageSize, total, count, data:[...], nextPage }
 * POST /api/v1/recursos   (un objeto o { items:[...] })
 *      -> ingiere centros/estructuras de otros desarrolladores (anti-spam + rate-limit + idempotente por externalId)
 *
 * Asíncrono, sin estado, CORS abierto. Documentado en /desarrolladores.
 */
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Api-Source',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: cors })
}

function parseSince(v: string | null): Date | null {
  if (!v) return null
  const n = Number(v)
  if (!Number.isNaN(n) && v.trim() !== '') return new Date(n)
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

export async function GET(request: NextRequest) {
  try {
    const sp = new URL(request.url).searchParams
    const tipo = sp.get('tipo') // centro_acopio | estructura | null(ambos)
    const since = parseSince(sp.get('since'))
    const page = Math.max(1, parseInt(sp.get('page') || '1', 10) || 1)
    const pageSize = Math.min(Math.max(1, parseInt(sp.get('pageSize') || '200', 10) || 200), 1000)
    const offset = (page - 1) * pageSize
    const sql = sqlRaw()

    const out: { centros?: any[]; estructuras?: any[] } = {}
    let total = 0

    if (tipo !== 'estructura') {
      const rowsC = since
        ? await sql`SELECT id, 'centro_acopio' AS tipo, nombre, direccion, lat, lng, recibe, nivel_dano AS "nivelDano", descripcion, contacto, created_at AS "createdAt" FROM recursos WHERE activo = true AND tipo = 'centro_acopio' AND created_at > ${since.toISOString()} ORDER BY created_at DESC LIMIT ${pageSize} OFFSET ${offset}`
        : await sql`SELECT id, 'centro_acopio' AS tipo, nombre, direccion, lat, lng, recibe, nivel_dano AS "nivelDano", descripcion, contacto, created_at AS "createdAt" FROM recursos WHERE activo = true AND tipo = 'centro_acopio' ORDER BY created_at DESC LIMIT ${pageSize} OFFSET ${offset}`
      out.centros = rowsC as any[]
      const c = (await sql`SELECT count(*)::int c FROM recursos WHERE activo = true AND tipo = 'centro_acopio'`) as Array<{ c: number }>
      total += c[0].c
    }
    if (tipo !== 'centro_acopio') {
      const rowsE = since
        ? await sql`SELECT id, 'estructura' AS tipo, nombre, direccion, ciudad, lat, lng, nivel_danio AS "nivelDanio", estado, foto_url AS "fotoUrl", fuente, notas, nombres_atrapados AS "nombresAtrapados", tiene_desaparecidos AS "tieneDesaparecidos", created_at AS "createdAt" FROM edificios WHERE created_at > ${since.toISOString()} ORDER BY created_at DESC LIMIT ${pageSize} OFFSET ${offset}`
        : await sql`SELECT id, 'estructura' AS tipo, nombre, direccion, ciudad, lat, lng, nivel_danio AS "nivelDanio", estado, foto_url AS "fotoUrl", fuente, notas, nombres_atrapados AS "nombresAtrapados", tiene_desaparecidos AS "tieneDesaparecidos", created_at AS "createdAt" FROM edificios ORDER BY created_at DESC LIMIT ${pageSize} OFFSET ${offset}`
      out.estructuras = rowsE as any[]
      const c = (await sql`SELECT count(*)::int c FROM edificios`) as Array<{ c: number }>
      total += c[0].c
    }

    const data = tipo === 'centro_acopio' ? out.centros : tipo === 'estructura' ? out.estructuras : [...(out.centros || []), ...(out.estructuras || [])]
    return NextResponse.json(
      { success: true, tipo: tipo || 'todos', page, pageSize, total, count: data?.length || 0, data, nextPage: (data?.length || 0) === pageSize ? page + 1 : null },
      { headers: cors }
    )
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500, headers: cors })
  }
}

const NIVELES_EST = ['total', 'severo', 'parcial', 'leve']
const NIVELES_CENTRO = ['leve', 'moderado', 'severo', 'colapsado']

async function ingestCentro(sql: any, b: any, source: string) {
  const nombre = String(b.nombre || '').trim()
  if (!nombre) return { ok: false, error: 'nombre requerido' }
  if (motivoRechazo({ nombre, descripcion: b.descripcion, ultimaUbicacion: b.direccion, reportadoPorNombre: b.contacto })) return { ok: false, error: 'rechazado por anti-spam' }
  const lat = b.lat != null && !Number.isNaN(parseFloat(b.lat)) ? parseFloat(b.lat) : null
  const lng = b.lng != null && !Number.isNaN(parseFloat(b.lng)) ? parseFloat(b.lng) : null
  const nivel = NIVELES_CENTRO.includes(b.nivelDano) ? b.nivelDano : null
  // dedup best-effort por nombre+direccion
  const dup = (await sql`SELECT id FROM recursos WHERE tipo='centro_acopio' AND lower(trim(nombre))=${nombre.toLowerCase()} AND lower(trim(coalesce(direccion,'')))=${String(b.direccion || '').trim().toLowerCase()} LIMIT 1`) as Array<{ id: string }>
  if (dup[0]) return { ok: true, id: dup[0].id, duplicado: true }
  const r = (await sql`INSERT INTO recursos (tipo, nombre, direccion, lat, lng, recibe, nivel_dano, descripcion, contacto)
    VALUES ('centro_acopio', ${nombre.slice(0, 160)}, ${b.direccion ? String(b.direccion).slice(0, 500) : null}, ${lat}, ${lng},
            ${b.recibe ? String(b.recibe).slice(0, 500) : null}, ${nivel}, ${b.descripcion ? String(b.descripcion).slice(0, 1000) : null},
            ${b.contacto ? String(b.contacto).slice(0, 120) : null}) RETURNING id`) as Array<{ id: string }>
  return { ok: true, id: r[0]?.id, source }
}

async function ingestEstructura(sql: any, b: any, source: string) {
  const nombre = String(b.nombre || '').trim()
  if (!nombre) return { ok: false, error: 'nombre requerido' }
  if (motivoRechazo({ nombre, descripcion: b.notas || b.descripcion, ultimaUbicacion: b.direccion })) return { ok: false, error: 'rechazado por anti-spam' }
  const lat = b.lat != null && !Number.isNaN(parseFloat(b.lat)) ? parseFloat(b.lat) : null
  const lng = b.lng != null && !Number.isNaN(parseFloat(b.lng)) ? parseFloat(b.lng) : null
  const nivel = NIVELES_EST.includes(b.nivelDanio) ? b.nivelDanio : null
  const notas = (b.notas || b.descripcion) ? String(b.notas || b.descripcion).slice(0, 1000) : null
  const extId = b.externalId ? String(b.externalId).slice(0, 200) : null
  // dedup por externalId o nombre+direccion
  const dup = extId
    ? ((await sql`SELECT id FROM edificios WHERE external_id = ${extId} LIMIT 1`) as Array<{ id: string }>)
    : ((await sql`SELECT id FROM edificios WHERE lower(trim(nombre))=${nombre.toLowerCase()} AND lower(trim(coalesce(direccion,'')))=${String(b.direccion || '').trim().toLowerCase()} LIMIT 1`) as Array<{ id: string }>)
  if (dup[0]) return { ok: true, id: dup[0].id, duplicado: true }
  const r = (await sql`INSERT INTO edificios (external_id, nombre, direccion, ciudad, lat, lng, nivel_danio, estado, fuente, notas)
    VALUES (${extId}, ${nombre.slice(0, 300)}, ${b.direccion ? String(b.direccion).slice(0, 1000) : null}, ${b.ciudad ? String(b.ciudad).slice(0, 100) : null},
            ${lat}, ${lng}, ${nivel}, ${'api'}, ${source.slice(0, 100)}, ${notas}) RETURNING id`) as Array<{ id: string }>
  return { ok: true, id: r[0]?.id, source }
}

export async function POST(request: NextRequest) {
  try {
    const rl = await rateLimit(getIp(request), 60)
    if (!rl.ok) return NextResponse.json({ success: false, error: 'Demasiadas solicitudes' }, { status: 429, headers: cors })

    const body = await request.json()
    const source = request.headers.get('x-api-source') || 'api-externa'
    const sql = sqlRaw()
    const items: any[] = Array.isArray(body?.items) ? body.items : [body]
    if (items.length > 500) return NextResponse.json({ success: false, error: 'máx 500 items por lote' }, { status: 400, headers: cors })

    const results = []
    for (const it of items) {
      const tipo = it.tipo === 'estructura' ? 'estructura' : 'centro_acopio'
      results.push(tipo === 'estructura' ? await ingestEstructura(sql, it, source) : await ingestCentro(sql, it, source))
    }
    const creados = results.filter((r) => r.ok && !('duplicado' in r && r.duplicado)).length
    const duplicados = results.filter((r: any) => r.duplicado).length
    const rechazados = results.filter((r) => !r.ok).length
    return NextResponse.json({ success: true, recibidos: items.length, creados, duplicados, rechazados, results }, { status: 201, headers: cors })
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500, headers: cors })
  }
}
