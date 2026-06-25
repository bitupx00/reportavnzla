import { NextRequest, NextResponse } from 'next/server'
import { sqlRaw } from '@/db'

export const dynamic = 'force-dynamic'

/**
 * Localiza/elimina registros inyectados por una fuente (spam).
 *  GET ?q=texto            -> dry-run: cuántos coinciden + ejemplos.
 *  GET ?q=texto&apply=1     -> elimina los que coincidan.
 * Busca el texto en remitente (nombre/teléfono/email), external_id, descripción,
 * ubicación, nombre y apellido.
 */
function buildWhere(): string {
  const cols = [
    'reportado_por_nombre',
    'reportado_por_email',
    'reportado_por_telefono',
    'external_id',
    'descripcion',
    'ultima_ubicacion',
    'nombre',
    'apellido',
    'foto_url',
  ]
  return cols.map((c) => `coalesce(${c},'') ILIKE $1`).join(' OR ')
}

export async function GET(request: NextRequest) {
  try {
    const sp = new URL(request.url).searchParams

    // Borrado puntual por id (apply=1)
    const id = sp.get('id')
    if (id) {
      if (sp.get('apply') !== '1') return NextResponse.json({ error: 'usa apply=1 para borrar por id' }, { status: 400 })
      const sqlx = sqlRaw()
      const del = (await sqlx`DELETE FROM personas WHERE id = ${id} RETURNING id`) as Array<{ id: string }>
      return NextResponse.json({ applied: true, eliminados: del.length })
    }

    const q = (sp.get('q') || '').trim()
    if (!q || q.length < 3) return NextResponse.json({ error: 'q (>=3 chars) requerido' }, { status: 400 })
    const apply = sp.get('apply') === '1'
    const sql = sqlRaw()
    const where = buildWhere()
    const param = [`%${q}%`]

    const cnt = (await sql.query(`SELECT count(*)::int c FROM personas WHERE ${where}`, param)) as Array<{ c: number }>
    if (apply) {
      const del = (await sql.query(`DELETE FROM personas WHERE ${where} RETURNING id`, param)) as Array<{ id: string }>
      return NextResponse.json({ applied: true, q, eliminados: del.length })
    }
    const ej = (await sql.query(
      `SELECT id, nombre, apellido, reportado_por_nombre AS "rep", reportado_por_email AS "email"
       FROM personas WHERE ${where} ORDER BY created_at DESC LIMIT 15`,
      param
    )) as Array<Record<string, unknown>>
    return NextResponse.json({ dryRun: true, q, coincidencias: cnt[0].c, ejemplos: ej })
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}
