import { NextResponse } from 'next/server'
import { db } from '@/db'
import { personas } from '@/db/schema'
import { sql } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}

// GET /api/v1/stats — public stats endpoint
export async function GET() {
  try {
    const [total, buscados, encontrados, fallecidos] = await Promise.all([
      db().select({ count: sql<number>`count(*)::int` }).from(personas),
      db().select({ count: sql<number>`count(*)::int` }).from(personas)
        .where(sql`${personas.estado} = 'buscado'`),
      db().select({ count: sql<number>`count(*)::int` }).from(personas)
        .where(sql`${personas.estado} = 'encontrado'`),
      db().select({ count: sql<number>`count(*)::int` }).from(personas)
        .where(sql`${personas.estado} = 'fallecido'`),
    ])

    return NextResponse.json({
      success: true,
      data: {
        total: total[0]?.count || 0,
        buscados: buscados[0]?.count || 0,
        encontrados: encontrados[0]?.count || 0,
        fallecidos: fallecidos[0]?.count || 0,
      },
    }, { headers: corsHeaders })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500, headers: corsHeaders })
  }
}
