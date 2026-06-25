import { NextResponse } from 'next/server'
import { db } from '@/db'
import { personas } from '@/db/schema'
import { sql } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

// GET /api/stats
export async function GET() {
  try {
    const [buscados, encontrados, fallecidos, total] = await Promise.all([
      db().select({ count: sql<number>`count(*)::int` }).from(personas)
        .where(sql`${personas.estado} = 'buscado'`),
      db().select({ count: sql<number>`count(*)::int` }).from(personas)
        .where(sql`${personas.estado} = 'encontrado'`),
      db().select({ count: sql<number>`count(*)::int` }).from(personas)
        .where(sql`${personas.estado} = 'fallecido'`),
      db().select({ count: sql<number>`count(*)::int` }).from(personas),
    ])

    return NextResponse.json({
      total: total[0]?.count || 0,
      buscados: buscados[0]?.count || 0,
      encontrados: encontrados[0]?.count || 0,
      fallecidos: fallecidos[0]?.count || 0,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
