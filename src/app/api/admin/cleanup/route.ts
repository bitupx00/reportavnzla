import { NextRequest, NextResponse } from 'next/server'
import { sqlRaw } from '@/db'

export const dynamic = 'force-dynamic'

/**
 * Limpieza de registros de PRUEBA.
 *  GET            -> dry-run: cuántos coinciden.
 *  GET ?apply=1   -> elimina personas cuyo nombre empieza por "prueba" o "test".
 * Solo afecta nombres claramente de prueba (ningún reporte real se llama así).
 */
const WHERE =
  `(lower(trim(nombre)) LIKE 'prueba%' OR lower(trim(nombre)) LIKE 'test%' OR lower(trim(nombre)) IN ('aaa','aaaa','asd','asdf','qwe','qwerty'))`

export async function GET(request: NextRequest) {
  try {
    const apply = new URL(request.url).searchParams.get('apply') === '1'
    const sql = sqlRaw()
    const muestra = (await sql.query(
      `SELECT id, nombre, apellido, estado FROM personas WHERE ${WHERE} ORDER BY created_at DESC LIMIT 20`,
      []
    )) as Array<Record<string, unknown>>
    const cnt = (await sql.query(`SELECT count(*)::int c FROM personas WHERE ${WHERE}`, [])) as Array<{ c: number }>

    if (apply) {
      const del = (await sql.query(`DELETE FROM personas WHERE ${WHERE} RETURNING id`, [])) as Array<{ id: string }>
      return NextResponse.json({ applied: true, eliminados: del.length })
    }
    return NextResponse.json({ dryRun: true, coincidencias: cnt[0].c, ejemplos: muestra })
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}
