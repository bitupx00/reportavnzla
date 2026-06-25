import { NextRequest, NextResponse } from 'next/server'
import { sqlRaw } from '@/db'

export const dynamic = 'force-dynamic'

// Personas encontradas SIN datos (foto tomada en sitio) para que su familia las
// reconozca. Se marcan con la columna `sin_identificar` (idempotente).
async function ensureSchema() {
  const sql = sqlRaw()
  await sql`ALTER TABLE personas ADD COLUMN IF NOT EXISTS sin_identificar boolean DEFAULT false`
}

// GET /api/por-identificar — lista de personas por identificar
export async function GET() {
  try {
    await ensureSchema()
    const sql = sqlRaw()
    const rows = await sql`
      SELECT id, foto_url AS "fotoUrl", estado,
             ultima_ubicacion AS "ultimaUbicacion", created_at AS "createdAt"
      FROM personas
      WHERE sin_identificar = true
      ORDER BY created_at DESC
      LIMIT 200`
    return NextResponse.json({ data: rows })
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}

// POST /api/por-identificar — registra una persona por identificar (solo foto)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { fotoUrl, estado, ultimaUbicacion, descripcion } = body
    if (!fotoUrl) {
      return NextResponse.json({ error: 'fotoUrl requerido' }, { status: 400 })
    }
    await ensureSchema()
    const sql = sqlRaw()
    const est = estado === 'fallecido' ? 'fallecido' : 'encontrado'
    const rows = (await sql`
      INSERT INTO personas (nombre, apellido, estado, foto_url, ultima_ubicacion, descripcion, sin_identificar)
      VALUES ('Por identificar', '', ${est}, ${fotoUrl}, ${ultimaUbicacion || null}, ${descripcion || null}, true)
      RETURNING id`) as Array<{ id: string }>
    return NextResponse.json({ ok: true, id: rows[0]?.id }, { status: 201 })
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}
