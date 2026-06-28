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
    // Un solo query con agregación condicional (count FILTER) en vez de 4
    // queries separadas: menos viajes a la BD y menos transferencia de datos.
    const rows = await db()
      .select({
        total: sql<number>`count(*)::int`,
        buscados: sql<number>`(count(*) filter (where ${personas.estado} = 'buscado'))::int`,
        encontrados: sql<number>`(count(*) filter (where ${personas.estado} = 'encontrado'))::int`,
        fallecidos: sql<number>`(count(*) filter (where ${personas.estado} = 'fallecido'))::int`,
      })
      .from(personas)

    const r = rows[0]
    return NextResponse.json({
      success: true,
      data: {
        total: r?.total ?? 0,
        buscados: r?.buscados ?? 0,
        encontrados: r?.encontrados ?? 0,
        fallecidos: r?.fallecidos ?? 0,
      },
    }, { headers: corsHeaders })
  } catch (error: any) {
    // No exponer el detalle de la BD/SQL al cliente (info disclosure); se loguea
    // server-side para diagnóstico.
    console.error('[GET /api/v1/stats] error:', error?.message || error)
    return NextResponse.json({
      success: false,
      error: 'No se pudieron obtener las estadísticas en este momento.',
    }, { status: 500, headers: corsHeaders })
  }
}
