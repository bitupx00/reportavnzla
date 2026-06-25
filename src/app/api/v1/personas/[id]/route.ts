import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { personas } from '@/db/schema'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}

// GET /api/v1/personas/[id] — get single person
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const [person] = await db()
      .select()
      .from(personas)
      .where(eq(personas.id, id))
      .limit(1)

    if (!person) {
      return NextResponse.json({
        success: false,
        error: 'Registro no encontrado',
      }, { status: 404, headers: corsHeaders })
    }

    return NextResponse.json({
      success: true,
      data: person,
    }, { headers: corsHeaders })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500, headers: corsHeaders })
  }
}

// PATCH /api/v1/personas/[id] — update single person
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const body = await request.json()
    const updates: any = { updatedAt: new Date() }

    const allowedFields = [
      'nombre', 'apellido', 'cedula', 'edad', 'genero',
      'estado', 'ultimaUbicacion', 'descripcion', 'fotoUrl',
      'lat', 'lng', 'notas', 'fechaEncontrado', 'externalId',
      'reportadoPorNombre', 'reportadoPorTelefono', 'reportadoPorEmail',
    ]

    for (const [key, value] of Object.entries(body)) {
      const fieldKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
      if (allowedFields.includes(fieldKey) && value !== undefined) {
        updates[fieldKey] = value
      }
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
