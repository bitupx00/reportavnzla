import { NextResponse } from 'next/server'
import { sqlRaw } from '@/db'

export const dynamic = 'force-dynamic'

// Datos livianos para el mapa: muchas personas que tengan ubicación (texto o coords)
export async function GET() {
  try {
    const sql = sqlRaw()
    const rows = await sql`
      SELECT id, nombre, apellido, estado,
             foto_url AS "fotoUrl",
             ultima_ubicacion AS "ultimaUbicacion",
             lat, lng
      FROM personas
      WHERE (ultima_ubicacion IS NOT NULL AND ultima_ubicacion <> '')
         OR (lat IS NOT NULL AND lng IS NOT NULL)
      ORDER BY created_at DESC
      LIMIT 3000`
    return NextResponse.json({ data: rows })
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}
