import { NextRequest, NextResponse } from 'next/server'
import { sqlRaw } from '@/db'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Dedup de personas.
 *  - GET (sin apply)            -> DRY-RUN: reporta cuántos duplicados hay.
 *  - GET ?apply=external        -> ELIMINA re-importaciones exactas (mismo external_id). MUY SEGURO.
 *  - GET ?apply=cedula&secret=  -> ELIMINA duplicados por cédula (conserva 1).
 *  - GET ?apply=nombre          -> ELIMINA duplicados por nombre+apellido+ubicación,
 *                                  PERO usando foto/external_id como discriminador para
 *                                  NO colapsar personas distintas que comparten un nombre
 *                                  genérico (p.ej. "Menor Reportado" sin ubicación).
 *
 * Regla de seguridad clave: dos filas con el MISMO nombre+ubicación pero DISTINTA foto
 * (o distinto external_id cuando no hay foto) son PERSONAS DISTINTAS y se conservan ambas.
 * Solo se consideran duplicados los que comparten foto, o (sin foto) el external_id, o cédula.
 */

// Discriminador que evita colapsar personas distintas con nombre genérico:
// usa la foto; si no hay, el external_id; si tampoco, el id (único → nunca colapsa).
const DISC = `coalesce(nullif(foto_url, ''), nullif(external_id, ''), id::text)`

export async function GET(request: NextRequest) {
  try {
    const sp = new URL(request.url).searchParams
    const apply = sp.get('apply')
    const secret = sp.get('secret')
    const sql = sqlRaw()

    const total = (await sql`SELECT count(*)::int c FROM personas`) as Array<{ c: number }>
    const conCedula = (await sql`SELECT count(*)::int c FROM personas WHERE cedula IS NOT NULL AND cedula <> ''`) as Array<{ c: number }>

    // Re-importaciones exactas (mismo external_id) — duplicados inequívocos
    const extDups = (await sql`
      SELECT count(*)::int c FROM personas p
      WHERE p.external_id IS NOT NULL AND p.external_id <> ''
      AND p.id NOT IN (
        SELECT DISTINCT ON (external_id) id FROM personas
        WHERE external_id IS NOT NULL AND external_id <> ''
        ORDER BY external_id, (foto_url IS NOT NULL) DESC, created_at ASC
      )`) as Array<{ c: number }>

    // Duplicados por cédula (filas que sobran)
    const cedulaDups = (await sql`
      SELECT count(*)::int c FROM personas p
      WHERE p.cedula IS NOT NULL AND p.cedula <> ''
      AND p.id NOT IN (
        SELECT DISTINCT ON (cedula) id FROM personas
        WHERE cedula IS NOT NULL AND cedula <> ''
        ORDER BY cedula, (foto_url IS NOT NULL) DESC, created_at ASC
      )`) as Array<{ c: number }>

    // Duplicados por nombre+apellido+ubicación + DISCRIMINADOR (foto/external_id) — solo reporte
    const nameDups = (await sql.query(`
      SELECT count(*)::int c FROM (
        SELECT lower(trim(nombre)) n, lower(trim(apellido)) a,
               lower(trim(coalesce(ultima_ubicacion,''))) u, ${DISC} d
        FROM personas
        GROUP BY 1,2,3,4 HAVING count(*) > 1
      ) t`)) as Array<{ c: number }>

    const ejemplos = (await sql.query(`
      SELECT lower(trim(nombre))||' '||lower(trim(apellido)) AS persona,
             coalesce(ultima_ubicacion,'(sin ubicación)') AS ubicacion, count(*)::int veces
      FROM personas
      GROUP BY 1,2, ${DISC} HAVING count(*) > 1
      ORDER BY 3 DESC LIMIT 10`)) as Array<Record<string, unknown>>

    const report = {
      total: total[0].c,
      conCedula: conCedula[0].c,
      reimportacionesPorExternalId: extDups[0].c,
      duplicadosPorCedula: cedulaDups[0].c,
      gruposDuplicadosPorNombreUbicacionFoto: nameDups[0].c,
      ejemplosTop: ejemplos,
    }

    // ── Aplicar: re-importaciones exactas (mismo external_id). Seguro, sin secreto. ──
    if (apply === 'external') {
      const deleted = (await sql`
        DELETE FROM personas p
        WHERE p.external_id IS NOT NULL AND p.external_id <> ''
        AND p.id NOT IN (
          SELECT DISTINCT ON (external_id) id FROM personas
          WHERE external_id IS NOT NULL AND external_id <> ''
          ORDER BY external_id, (foto_url IS NOT NULL) DESC, created_at ASC
        )
        RETURNING p.id`) as Array<{ id: string }>
      return NextResponse.json({ applied: true, modo: 'external_id', eliminados: deleted.length, report })
    }

    // ── Aplicar borrado por cédula (con secreto) ──
    if (apply === 'cedula') {
      if (!process.env.DEDUP_SECRET || secret !== process.env.DEDUP_SECRET) {
        return NextResponse.json({ error: 'secret inválido o DEDUP_SECRET no configurado', report }, { status: 403 })
      }
      const deleted = (await sql`
        DELETE FROM personas p
        WHERE p.cedula IS NOT NULL AND p.cedula <> ''
        AND p.id NOT IN (
          SELECT DISTINCT ON (cedula) id FROM personas
          WHERE cedula IS NOT NULL AND cedula <> ''
          ORDER BY cedula, (foto_url IS NOT NULL) DESC, created_at ASC
        )
        RETURNING p.id`) as Array<{ id: string }>
      return NextResponse.json({ applied: true, modo: 'cedula', eliminados: deleted.length, report })
    }

    // ── Aplicar borrado por NOMBRE+APELLIDO+UBICACIÓN+DISCRIMINADOR (conserva 1 por grupo) ──
    // El discriminador (foto/external_id) evita colapsar personas distintas con nombre genérico.
    if (apply === 'nombre') {
      const deleted = (await sql.query(`
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
      return NextResponse.json({ applied: true, modo: 'nombre+apellido+ubicacion+foto', eliminados: deleted.length, report })
    }

    return NextResponse.json({ dryRun: true, ...report })
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}
