import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { personas } from '@/db/schema'
import { eq, sql } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}

// POST /api/v1/sync — receive batch data from another platform
// Body: { source: string, url: string, persons: Array<PersonRecord> }
// Each person should include external_id for deduplication
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { source, url, persons: records } = body

    if (!source) {
      return NextResponse.json({
        success: false,
        error: 'source (nombre de plataforma) es requerido',
      }, { status: 400, headers: corsHeaders })
    }

    if (!records || !Array.isArray(records) || records.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'persons array es requerido y no puede estar vacío',
      }, { status: 400, headers: corsHeaders })
    }

    if (records.length > 500) {
      return NextResponse.json({
        success: false,
        error: 'Límite: 500 registros por solicitud. Divide en batches.',
      }, { status: 400, headers: corsHeaders })
    }

    let inserted = 0
    let updated = 0
    let skipped = 0
    const errors: string[] = []

    for (const record of records) {
      try {
        const externalId = record.external_id || record.externalId

        // Check for existing record by external_id
        if (externalId) {
          const [existing] = await db()
            .select({ id: personas.id })
            .from(personas)
            .where(eq(personas.externalId, externalId))
            .limit(1)

          if (existing) {
            // Update existing record
            const updates: any = { updatedAt: new Date() }
            if (record.estado) updates.estado = record.estado
            if (record.notas) updates.notas = record.notas
            if (record.fecha_encontrado) updates.fechaEncontrado = new Date(record.fecha_encontrado)
            if (record.ultima_ubicacion || record.ultimaUbicacion) {
              updates.ultimaUbicacion = record.ultima_ubicacion || record.ultimaUbicacion
            }
            if (record.lat !== undefined) updates.lat = record.lat
            if (record.lng !== undefined) updates.lng = record.lng

            await db()
              .update(personas)
              .set(updates)
              .where(eq(personas.id, existing.id))

            updated++
            continue
          }
        }

        // Insert new record
        await db().insert(personas).values({
          nombre: record.nombre || 'Sin nombre',
          apellido: record.apellido || '',
          cedula: record.cedula || null,
          edad: record.edad ? parseInt(record.edad) : null,
          genero: record.genero || null,
          estado: record.estado || 'buscado',
          ultimaUbicacion: record.ultima_ubicacion || record.ultimaUbicacion || null,
          descripcion: record.descripcion || null,
          fotoUrl: record.foto_url || record.fotoUrl || null,
          lat: record.lat || null,
          lng: record.lng || null,
          externalId: externalId || null,
          reportadoPorNombre: record.reportado_por_nombre || record.reportadoPorNombre || null,
          reportadoPorTelefono: record.reportado_por_telefono || record.reportadoPorTelefono || null,
          reportadoPorEmail: record.reportado_por_email || record.reportadoPorEmail || null,
        })

        inserted++
      } catch (e: any) {
        skipped++
        if (errors.length < 10) {
          errors.push(`${record.nombre || '?'}: ${e.message}`)
        }
      }
    }

    return NextResponse.json({
      success: true,
      source,
      syncResult: {
        inserted,
        updated,
        skipped,
        totalProcessed: records.length,
        errors: errors.length > 0 ? errors : undefined,
      },
    }, { headers: corsHeaders })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 400, headers: corsHeaders })
  }
}

// GET /api/v1/sync — export data for other platforms
// Query params: since=ISO_date, estado, limit (max 1000)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const since = searchParams.get('since') || ''
  const estado = searchParams.get('estado') || ''
  const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 1000)

  const conditions = []
  if (since) {
    conditions.push(sql`${personas.updatedAt} >= ${new Date(since).toISOString()}`)
  }
  if (estado) {
    conditions.push(sql`${personas.estado} = ${estado}`)
  }

  try {
    const data = await db()
      .select({
        id: personas.id,
        nombre: personas.nombre,
        apellido: personas.apellido,
        cedula: personas.cedula,
        edad: personas.edad,
        genero: personas.genero,
        estado: personas.estado,
        ultima_ubicacion: personas.ultimaUbicacion,
        descripcion: personas.descripcion,
        foto_url: personas.fotoUrl,
        lat: personas.lat,
        lng: personas.lng,
        external_id: personas.externalId,
        reportado_por_nombre: personas.reportadoPorNombre,
        updated_at: personas.updatedAt,
      })
      .from(personas)
      .where(conditions.length > 0 ? sql`${conditions.join(' AND ')}` : undefined)
      .orderBy(sql`${personas.updatedAt} DESC`)
      .limit(limit)

    return NextResponse.json({
      success: true,
      data,
      exportedAt: new Date().toISOString(),
      count: data.length,
    }, { headers: corsHeaders })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500, headers: corsHeaders })
  }
}
