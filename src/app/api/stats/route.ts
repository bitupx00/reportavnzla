import { NextResponse } from 'next/server'
import { db } from '@/db'
import { personas } from '@/db/schema'
import { sql } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

// GET /api/stats
export async function GET() {
  try {
    const result = await db
      .select({
        buscados: sql<number>`count(*)::int FILTER (WHERE ${personas.estado} = 'buscado')`,
        encontrados: sql<number>`count(*)::int FILTER (WHERE ${personas.estado} = 'encontrado')`,
        fallecidos: sql<number>`count(*)::int FILTER (WHERE ${personas.estado} = 'fallecido')`,
        total: sql<number>`count(*)::int`,
      })
      .from(personas)

    const stats = result[0] || { total: 0, buscados: 0, encontrados: 0, fallecidos: 0 }
    return NextResponse.json(stats)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
