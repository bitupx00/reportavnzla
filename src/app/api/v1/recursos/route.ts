import { NextRequest, NextResponse } from 'next/server'
import { sqlRaw } from '@/db'

export const dynamic = 'force-dynamic'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: cors })
}

/**
 * GET /api/v1/recursos?tipo=centro_acopio|estructura
 * API pública para desarrolladores/bots: centros de acopio y estructuras
 * afectadas, con coordenadas para integrar en mapas u otros sistemas.
 */
export async function GET(request: NextRequest) {
  try {
    const tipo = new URL(request.url).searchParams.get('tipo')
    const sql = sqlRaw()
    const rows = tipo
      ? await sql`SELECT id, tipo, nombre, direccion, lat, lng, recibe, nivel_dano AS "nivelDano", descripcion, contacto, created_at AS "createdAt" FROM recursos WHERE activo = true AND tipo = ${tipo} ORDER BY created_at DESC LIMIT 1000`
      : await sql`SELECT id, tipo, nombre, direccion, lat, lng, recibe, nivel_dano AS "nivelDano", descripcion, contacto, created_at AS "createdAt" FROM recursos WHERE activo = true ORDER BY created_at DESC LIMIT 1000`
    return NextResponse.json({ success: true, count: (rows as any[]).length, data: rows }, { headers: cors })
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500, headers: cors })
  }
}
