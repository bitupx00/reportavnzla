import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { personas } from '@/db/schema'
import { eq, ilike, or, and, sql, desc } from 'drizzle-orm'
import { motivoRechazo } from '@/lib/antispam'
import { rateLimit, getIp } from '@/lib/ratelimit'

export const dynamic = 'force-dynamic'

// GET /api/personas?q=...&estado=...&page=0&limit=24
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q') || ''
  const estado = searchParams.get('estado') || ''
  const page = parseInt(searchParams.get('page') || '0')
  const limit = Math.min(parseInt(searchParams.get('limit') || '24'), 100)
  const offset = page * limit

  const conditions = []
  if (q) {
    // If query has spaces, search each word across nombre + apellido
    const words = q.trim().split(/\s+/).filter(Boolean)
    if (words.length > 1) {
      const wordConditions = words.map(word =>
        or(
          ilike(personas.nombre, `%${word}%`),
          ilike(personas.apellido, `%${word}%`),
          ilike(personas.cedula, `%${word}%`)
        )
      )
      conditions.push(and(...wordConditions))
    } else {
      conditions.push(
        or(
          ilike(personas.nombre, `%${q}%`),
          ilike(personas.apellido, `%${q}%`),
          ilike(personas.cedula, `%${q}%`)
        )
      )
    }
  }
  if (estado) {
    conditions.push(eq(personas.estado, estado as any))
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined

  try {
    const [data, countResult] = await Promise.all([
      db().select().from(personas)
        .where(where)
        .orderBy(desc(personas.createdAt))
        .limit(limit)
        .offset(offset),
      db().select({ count: sql<number>`count(*)::int` })
        .from(personas)
        .where(where),
    ])

    const totalCount = countResult[0]?.count || 0

    return NextResponse.json({
      data,
      totalCount,
      page,
      totalPages: Math.ceil(totalCount / limit),
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/personas
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Honeypot: campo oculto que solo rellenan los bots
    if (body._hp) return NextResponse.json({ ok: true }, { status: 200 })

    const rl = await rateLimit(getIp(request))
    if (!rl.ok) return NextResponse.json({ error: 'Demasiadas solicitudes. Intenta de nuevo en unos minutos.' }, { status: 429 })

    const motivo = motivoRechazo({ ...body, source: request.headers.get('x-source') })
    if (motivo) return NextResponse.json({ error: motivo }, { status: 400 })

    const record = {
      nombre: body.nombre,
      apellido: body.apellido,
      cedula: body.cedula || null,
      edad: body.edad ? parseInt(body.edad) : null,
      genero: body.genero || null,
      ultimaUbicacion: body.ultimaUbicacion || null,
      descripcion: body.descripcion || null,
      fotoUrl: body.fotoUrl || null,
      estado: body.estado || 'buscado',
      lat: body.lat || null,
      lng: body.lng || null,
      reportadoPorNombre: body.reportadoPorNombre,
      reportadoPorTelefono: body.reportadoPorTelefono || null,
      reportadoPorEmail: body.reportadoPorEmail || null,
    }

    // Anti-duplicado en el momento del alta: si ya existe una persona con el mismo
    // nombre + apellido + última ubicación (normalizados), devolvemos esa en vez de
    // crear un duplicado. Por cédula también, si viene cédula.
    const n = (s: string | null | undefined) => (s || '').trim().toLowerCase()
    const dupConds = [
      and(
        sql`lower(trim(${personas.nombre})) = ${n(record.nombre)}`,
        sql`lower(trim(${personas.apellido})) = ${n(record.apellido)}`,
        sql`lower(trim(coalesce(${personas.ultimaUbicacion}, ''))) = ${n(record.ultimaUbicacion)}`
      ),
    ]
    if (record.cedula) {
      dupConds.push(sql`${personas.cedula} = ${record.cedula}`)
    }
    const [existente] = await db()
      .select()
      .from(personas)
      .where(or(...dupConds))
      .limit(1)

    if (existente) {
      return NextResponse.json({ ...existente, _duplicado: true }, { status: 200 })
    }

    const [result] = await db().insert(personas).values(record).returning()

    return NextResponse.json(result, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}

// PATCH /api/personas
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, estado, notas, fechaEncontrado, fotoUrl } = body

    if (!id) {
      return NextResponse.json({ error: 'id requerido' }, { status: 400 })
    }

    const updates: any = {}
    if (estado) updates.estado = estado
    if (notas !== undefined) updates.notas = notas
    if (fotoUrl !== undefined) updates.fotoUrl = fotoUrl
    if (fechaEncontrado || estado === 'encontrado') {
      updates.fechaEncontrado = fechaEncontrado ? new Date(fechaEncontrado) : new Date()
    }
    updates.updatedAt = new Date()

    const [result] = await db()
      .update(personas)
      .set(updates)
      .where(eq(personas.id, id))
      .returning()

    if (!result) {
      return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 })
    }

    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}
