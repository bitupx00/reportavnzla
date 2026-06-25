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
 * GET /api/v1/feed — feed para bots/integraciones (Telegram, etc.)
 * Parámetros:
 *   since=<ISO>   solo personas creadas/actualizadas después de esa fecha (polling)
 *   q=<texto>     búsqueda por nombre/apellido/cédula
 *   estado=buscado|encontrado|fallecido
 *   limit=<1..100>
 * Respuesta incluye `serverTime` (úsalo como próximo `since`) y `url` por persona.
 */
export async function GET(request: NextRequest) {
  try {
    const sp = new URL(request.url).searchParams
    const since = sp.get('since')
    const q = (sp.get('q') || '').trim()
    const estado = (sp.get('estado') || '').trim()
    const limit = Math.min(Math.max(parseInt(sp.get('limit') || '50'), 1), 100)

    const conds: string[] = []
    const params: unknown[] = []
    if (since && !Number.isNaN(Date.parse(since))) {
      params.push(new Date(since).toISOString())
      conds.push(`greatest(created_at, updated_at) > $${params.length}`)
    }
    if (estado) {
      params.push(estado)
      conds.push(`estado = $${params.length}`)
    }
    if (q) {
      params.push(`%${q}%`)
      conds.push(`(nombre ILIKE $${params.length} OR apellido ILIKE $${params.length} OR cedula ILIKE $${params.length})`)
    }
    params.push(limit)

    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : ''
    const sql = sqlRaw()
    const rows = (await sql.query(
      `SELECT id, nombre, apellido, cedula, edad, estado,
              ultima_ubicacion AS "ultimaUbicacion", descripcion,
              foto_url AS "fotoUrl", lat, lng,
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM personas ${where}
       ORDER BY greatest(created_at, updated_at) DESC
       LIMIT $${params.length}`,
      params
    )) as Array<Record<string, unknown>>

    const data = rows.map((r) => ({ ...r, url: `https://reportavnzla.com/persona/${r.id}` }))
    return NextResponse.json(
      { success: true, serverTime: new Date().toISOString(), count: data.length, data },
      { headers: cors }
    )
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500, headers: cors }
    )
  }
}
