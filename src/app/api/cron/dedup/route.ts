import { NextRequest, NextResponse } from 'next/server'
import { sqlRaw } from '@/db'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Dedup AUTOMÁTICO (cron diario). Solo operaciones SEGURAS:
 *   1) elimina re-importaciones exactas (mismo external_id), conserva 1.
 *   2) crea un índice único parcial sobre external_id para impedir que se
 *      vuelvan a duplicar a nivel de base de datos.
 *   3) elimina duplicados por nombre+apellido+ubicación usando foto/external_id
 *      como discriminador (NO colapsa personas distintas con nombre genérico).
 *
 * Protección: si CRON_SECRET está configurado, exige Authorization: Bearer <secret>
 * (Vercel Cron lo envía automáticamente). Si no está configurado, queda abierto
 * pero solo realiza borrados de duplicados inequívocos.
 */
const DISC = `coalesce(nullif(foto_url, ''), nullif(external_id, ''), id::text)`

export async function GET(request: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET
    if (secret) {
      const auth = request.headers.get('authorization') || ''
      const url = new URL(request.url)
      if (auth !== `Bearer ${secret}` && url.searchParams.get('secret') !== secret) {
        return NextResponse.json({ error: 'no autorizado' }, { status: 401 })
      }
    }

    const sql = sqlRaw()
    const out: Record<string, unknown> = {}

    // 1) Re-importaciones exactas (mismo external_id)
    const extDel = (await sql`
      DELETE FROM personas p
      WHERE p.external_id IS NOT NULL AND p.external_id <> ''
      AND p.id NOT IN (
        SELECT DISTINCT ON (external_id) id FROM personas
        WHERE external_id IS NOT NULL AND external_id <> ''
        ORDER BY external_id, (foto_url IS NOT NULL) DESC, created_at ASC
      )
      RETURNING p.id`) as Array<{ id: string }>
    out.eliminadosPorExternalId = extDel.length

    // 2) Índice único parcial — impide re-duplicar por external_id (idempotente)
    try {
      await sql`CREATE UNIQUE INDEX IF NOT EXISTS personas_external_id_uniq ON personas (external_id) WHERE external_id IS NOT NULL AND external_id <> ''`
      out.indiceUnicoExternalId = 'ok'
    } catch (e: unknown) {
      out.indiceUnicoExternalId = e instanceof Error ? e.message : String(e)
    }

    // 3) Duplicados por nombre+apellido+ubicación + discriminador (foto/external_id)
    const nameDel = (await sql.query(`
      DELETE FROM personas p
      WHERE coalesce(p.sin_identificar, false) = false
      AND p.id NOT IN (
        SELECT DISTINCT ON (lower(trim(nombre)), lower(trim(apellido)),
                            lower(trim(coalesce(ultima_ubicacion,''))), ${DISC})
               id FROM personas
        WHERE coalesce(sin_identificar, false) = false
        ORDER BY lower(trim(nombre)), lower(trim(apellido)),
                 lower(trim(coalesce(ultima_ubicacion,''))), ${DISC},
                 (cedula IS NOT NULL) DESC, created_at ASC
      )
      RETURNING p.id`)) as Array<{ id: string }>
    out.eliminadosPorNombreUbicacionFoto = nameDel.length

    const total = (await sql`SELECT count(*)::int c FROM personas`) as Array<{ c: number }>
    out.totalFinal = total[0].c
    out.ok = true
    return NextResponse.json(out)
  } catch (error: unknown) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}
