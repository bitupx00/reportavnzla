import { NextResponse } from 'next/server'
import { db } from '@/db'
import { personas } from '@/db/schema'
import { sql } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

// GET /api/stats
export async function GET() {
  try {
    // Single query with CASE WHEN — avoids stale cache from separate queries
    const [row] = await db()
      .select({
        total: sql<number>`count(*)::int`,
        buscados: sql<number>`count(*)::int FILTER (WHERE ${personas.estado} = 'buscado')`,
        encontrados: sql<number>`count(*)::int FILTER (WHERE ${personas.estado} = 'encontrado')`,
        fallecidos: sql<number>`count(*)::int FILTER (WHERE ${personas.estado} = 'fallecido')`,
      })
      .from(personas)

    return NextResponse.json({
      total: row?.total || 0,
      buscados: row?.buscados || 0,
      encontrados: row?.encontrados || 0,
      fallecidos: row?.fallecidos || 0,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
