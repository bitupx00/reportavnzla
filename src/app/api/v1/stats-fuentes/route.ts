import { NextResponse } from 'next/server'
import { sqlRaw } from '@/db'

export const dynamic = 'force-dynamic'

/**
 * Stats by source (external_id prefix) and estado
 */
export async function GET() {
  try {
    const sql = sqlRaw()
    const bySource = (await sql`
      SELECT 
        CASE 
          WHEN external_id LIKE 'vtb-%' THEN 'vtb'
          WHEN external_id LIKE 'dtv-%' THEN 'dtv'
          WHEN external_id LIKE 'tve-%' THEN 'tve'
          WHEN external_id LIKE 'sos-%' THEN 'sos'
          WHEN external_id IS NOT NULL THEN 'otro'
          ELSE 'manual'
        END AS fuente,
        estado,
        count(*)::int AS cnt
      FROM personas
      GROUP BY 1, 2
      ORDER BY fuente, estado
    `) as Array<Record<string, unknown>>

    const byEstado = (await sql`
      SELECT estado, count(*)::int AS cnt
      FROM personas
      GROUP BY estado
      ORDER BY cnt DESC
    `) as Array<Record<string, unknown>>

    return NextResponse.json({ 
      success: true, 
      bySource, 
      byEstado,
      total: byEstado.reduce((s: number, r: any) => s + r.cnt, 0)
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
