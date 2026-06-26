import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { personas, fuentesDatos } from '@/db/schema'
import { eq, ilike, or, and, sql, desc, asc } from 'drizzle-orm'
import { motivoRechazo } from '@/lib/antispam'
import { rateLimit, getIp } from '@/lib/ratelimit'

export const dynamic = 'force-dynamic'

// CORS headers for public API
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
  'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}

// ── GET /api/v1/personas ──────────────────────────────────────
// Public read API with rich filtering
// Query params: q, estado, cedula, nombre, apellido, edad_min, edad_max,
//   genero, ubicacion, fuente, page, limit, sort, order
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  // Filters
  const q = searchParams.get('q') || ''
  const estado = searchParams.get('estado') || ''
  const cedula = searchParams.get('cedula') || ''
  const nombre = searchParams.get('nombre') || ''
  const apellido = searchParams.get('apellido') || ''
  const edadMin = searchParams.get('edad_min') ? parseInt(searchParams.get('edad_min')!) : null
  const edadMax = searchParams.get('edad_max') ? parseInt(searchParams.get('edad_max')!) : null
  const genero = searchParams.get('genero') || ''
  const ubicacion = searchParams.get('ubicacion') || ''
  const externalId = searchParams.get('external_id') || ''

  // Pagination
  const page = Math.max(0, parseInt(searchParams.get('page') || '0'))
  const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '50')), 200)
  const offset = page * limit

  // Sorting
  const sort = searchParams.get('sort') || 'created_at'
  const order = searchParams.get('order') === 'asc' ? asc : desc
  const sortColumn = {
    created_at: personas.createdAt,
    updated_at: personas.updatedAt,
    nombre: personas.nombre,
    apellido: personas.apellido,
    edad: personas.edad,
    estado: personas.estado,
  }[sort] || personas.createdAt

  // Build conditions
  const conditions = []
  if (q) {
    // If query has spaces, search each word across all text fields
    const words = q.trim().split(/\s+/).filter(Boolean)
    if (words.length > 1) {
      const wordConditions = words.map(word =>
        or(
          ilike(personas.nombre, `%${word}%`),
          ilike(personas.apellido, `%${word}%`),
          ilike(personas.cedula, `%${word}%`),
          ilike(personas.ultimaUbicacion, `%${word}%`),
          ilike(personas.descripcion, `%${word}%`),
        )
      )
      conditions.push(and(...wordConditions))
    } else {
      conditions.push(
        or(
          ilike(personas.nombre, `%${q}%`),
          ilike(personas.apellido, `%${q}%`),
          ilike(personas.cedula, `%${q}%`),
          ilike(personas.ultimaUbicacion, `%${q}%`),
          ilike(personas.descripcion, `%${q}%`),
        )
      )
    }
  }
  if (estado) conditions.push(eq(personas.estado, estado as any))
  if (cedula) conditions.push(ilike(personas.cedula, `%${cedula}%`))
  if (nombre) conditions.push(ilike(personas.nombre, `%${nombre}%`))
  if (apellido) conditions.push(ilike(personas.apellido, `%${apellido}%`))
  if (edadMin !== null) conditions.push(sql`${personas.edad} >= ${edadMin}`)
  if (edadMax !== null) conditions.push(sql`${personas.edad} <= ${edadMax}`)
  if (genero) conditions.push(eq(personas.genero, genero))
  if (ubicacion) conditions.push(ilike(personas.ultimaUbicacion, `%${ubicacion}%`))
  if (externalId) conditions.push(eq(personas.externalId, externalId))

  const where = conditions.length > 0 ? and(...conditions) : undefined

  try {
    const [data, countResult] = await Promise.all([
      db().select({
        id: personas.id,
        nombre: personas.nombre,
        apellido: personas.apellido,
        cedula: personas.cedula,
        edad: personas.edad,
        genero: personas.genero,
        estado: personas.estado,
        ultimaUbicacion: personas.ultimaUbicacion,
        descripcion: personas.descripcion,
        fotoUrl: personas.fotoUrl,
        lat: personas.lat,
        lng: personas.lng,
        externalId: personas.externalId,
        reportadoPorNombre: personas.reportadoPorNombre,
        createdAt: personas.createdAt,
        updatedAt: personas.updatedAt,
      }).from(personas)
        .where(where)
        .orderBy(order(sortColumn))
        .limit(limit)
        .offset(offset),
      db().select({ count: sql<number>`count(*)::int` })
        .from(personas)
        .where(where),
    ])

    const totalCount = countResult[0]?.count || 0

    return NextResponse.json({
      success: true,
      data,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
        hasNextPage: offset + limit < totalCount,
        hasPrevPage: page > 0,
      },
    }, { headers: corsHeaders })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500, headers: corsHeaders })
  }
}

// ── POST /api/v1/personas ─────────────────────────────────────
// Public write API — allows other platforms to submit persons
// Supports single or batch (array) inserts
export async function POST(request: NextRequest) {
  try {
    let body = await request.json()
    const isBatch = Array.isArray(body)

    // Rate-limit por IP (bypass con x-sync-secret para imports internos)
    const syncSecret = request.headers.get('x-sync-secret')
    if (syncSecret !== 'DEDUP_VNZLA_2026') {
      const rl = await rateLimit(getIp(request), 40)
      if (!rl.ok) {
        return NextResponse.json({ success: false, error: 'Rate limit: demasiadas solicitudes' }, { status: 429, headers: corsHeaders })
      }
    }

    // Anti-spam: bloquear fuente/enlaces inyectados
    const xsrc = request.headers.get('x-source')
    const esSpam = (r: any) => !!motivoRechazo({ ...r, source: xsrc })
    if (isBatch) {
      body = body.filter((r: any) => !esSpam(r))
      if (body.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Registros rechazados (spam, enlaces o fuente bloqueada)' },
          { status: 400, headers: corsHeaders }
        )
      }
    } else {
      const m = motivoRechazo({ ...body, source: xsrc })
      if (m) return NextResponse.json({ success: false, error: m }, { status: 400, headers: corsHeaders })
    }

    if (isBatch) {
      if (body.length > 100) {
        return NextResponse.json({
          success: false,
          error: 'Batch limit: 100 records per request',
        }, { status: 400, headers: corsHeaders })
      }
      const records = body.map((item: any) => ({
        nombre: item.nombre,
        apellido: item.apellido || '',
        cedula: item.cedula || null,
        edad: item.edad ? parseInt(item.edad) : null,
        genero: item.genero || null,
        ultimaUbicacion: item.ultimaUbicacion || null,
        descripcion: item.descripcion || null,
        fotoUrl: item.foto_url || item.fotoUrl || null,
        estado: item.estado || 'buscado',
        lat: item.lat || null,
        lng: item.lng || null,
        externalId: item.external_id || item.externalId || null,
        reportadoPorNombre: item.reportado_por_nombre || item.reportadoPorNombre || null,
        reportadoPorTelefono: item.reportado_por_telefono || item.reportadoPorTelefono || null,
        reportadoPorEmail: item.reportado_por_email || item.reportadoPorEmail || null,
      }))

      // Upsert: insert new, skip existing (by external_id)
      const results = []
      for (const record of records) {
        if (record.externalId) {
          const existing = await db().select({ id: personas.id }).from(personas)
            .where(eq(personas.externalId, record.externalId)).limit(1)
          if (existing.length > 0) {
            results.push({ ...record, _skipped: true })
            continue
          }
        }
        try {
          const [inserted] = await db().insert(personas).values(record).returning()
          results.push(inserted)
        } catch (e: any) {
          // If unique constraint violation, skip
          if (e?.message?.includes('duplicate') || e?.message?.includes('unique')) {
            results.push({ ...record, _skipped: true })
          } else {
            results.push({ ...record, _error: e.message })
          }
        }
      }
      const inserted = results.filter((r: any) => !r._skipped && !r._error)
      const skipped = results.filter((r: any) => r._skipped)

      return NextResponse.json({
        success: true,
        inserted: inserted.length,
        skipped: skipped.length,
        total: results.length,
      }, { status: 201, headers: corsHeaders })
    }

    // Single insert
    const record = {
      nombre: body.nombre,
      apellido: body.apellido || '',
      cedula: body.cedula || null,
      edad: body.edad ? parseInt(body.edad) : null,
      genero: body.genero || null,
      ultimaUbicacion: body.ultima_ubicacion || body.ultimaUbicacion || null,
      descripcion: body.descripcion || null,
      fotoUrl: body.foto_url || body.fotoUrl || null,
      estado: body.estado || 'buscado',
      lat: body.lat || null,
      lng: body.lng || null,
      externalId: body.external_id || body.externalId || null,
      reportadoPorNombre: body.reportado_por_nombre || body.reportadoPorNombre || null,
      reportadoPorTelefono: body.reportado_por_telefono || body.reportadoPorTelefono || null,
      reportadoPorEmail: body.reportado_por_email || body.reportadoPorEmail || null,
    }

    const [result] = await db().insert(personas).values(record).returning()

    return NextResponse.json({
      success: true,
      data: result,
    }, { status: 201, headers: corsHeaders })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 400, headers: corsHeaders })
  }
}

// ── PATCH /api/v1/personas ────────────────────────────────────
// Update person status or info
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, estado, notas, fecha_encontrado, ...otherUpdates } = body

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'id requerido',
      }, { status: 400, headers: corsHeaders })
    }

    const updates: any = {
      updatedAt: new Date(),
    }
    if (estado) updates.estado = estado
    if (notas) updates.notas = notas
    if (fecha_encontrado || estado === 'encontrado') {
      updates.fechaEncontrado = fecha_encontrado || new Date()
    }
    // Allow updating other fields too
    if (otherUpdates.nombre) updates.nombre = otherUpdates.nombre
    if (otherUpdates.apellido) updates.apellido = otherUpdates.apellido
    if (otherUpdates.ultima_ubicacion || otherUpdates.ultimaUbicacion) {
      updates.ultimaUbicacion = otherUpdates.ultima_ubicacion || otherUpdates.ultimaUbicacion
    }
    if (otherUpdates.lat !== undefined) updates.lat = otherUpdates.lat
    if (otherUpdates.lng !== undefined) updates.lng = otherUpdates.lng
    if (otherUpdates.external_id || otherUpdates.externalId) {
      updates.externalId = otherUpdates.external_id || otherUpdates.externalId
    }

    const [result] = await db()
      .update(personas)
      .set(updates)
      .where(eq(personas.id, id))
      .returning()

    if (!result) {
      return NextResponse.json({
        success: false,
        error: 'Registro no encontrado',
      }, { status: 404, headers: corsHeaders })
    }

    return NextResponse.json({
      success: true,
      data: result,
    }, { headers: corsHeaders })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 400, headers: corsHeaders })
  }
}
