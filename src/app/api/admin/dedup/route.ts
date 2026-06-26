import { NextRequest, NextResponse } from 'next/server'
import { sqlRaw } from '@/db'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Dedup de personas.
 *  - GET (sin secreto)         -> DRY-RUN: reporta cuántos duplicados hay.
 *  - GET ?apply=cedula&secret= -> ELIMINA duplicados por cédula (conserva 1).
 *
 * Estrategia conservadora: solo borra por CÉDULA exacta (misma cédula = misma
 * persona). Conserva, por cédula, la fila con foto y más antigua. Los duplicados
 * por nombre+ubicación (sin cédula) solo se REPORTAN (requieren revisión).
 * El borrado exige `secret` === process.env.DEDUP_SECRET (si no está, deshabilitado).
 */
export async function GET(request: NextRequest) {
  try {
    const sp = new URL(request.url).searchParams
    const apply = sp.get('apply')
    const secret = sp.get('secret')
    const sql = sqlRaw()

    const total = (await sql`SELECT count(*)::int c FROM personas`) as Array<{ c: number }>
    const conCedula = (await sql`SELECT count(*)::int c FROM personas WHERE cedula IS NOT NULL AND cedula <> ''`) as Array<{ c: number }>

    // Duplicados por cédula (filas que sobran)
    const cedulaDups = (await sql`
      SELECT count(*)::int c FROM personas p
      WHERE p.cedula IS NOT NULL AND p.cedula <> ''
      AND p.id NOT IN (
        SELECT DISTINCT ON (cedula) id FROM personas
        WHERE cedula IS NOT NULL AND cedula <> ''
        ORDER BY cedula, (foto_url IS NOT NULL) DESC, created_at ASC
      )`) as Array<{ c: number }>

    // Duplicados por nombre+apellido+ubicación normalizados (solo reporte)
    const nameDups = (await sql`
      SELECT count(*)::int c FROM (
        SELECT lower(trim(nombre)) n, lower(trim(apellido)) a, lower(trim(coalesce(ultima_ubicacion,''))) u
        FROM personas
        GROUP BY 1,2,3 HAVING count(*) > 1
      ) t`) as Array<{ c: number }>

    const ejemplos = (await sql`
      SELECT lower(trim(nombre))||' '||lower(trim(apellido)) AS persona,
             coalesce(ultima_ubicacion,'(sin ubicación)') AS ubicacion, count(*)::int veces
      FROM personas
      GROUP BY 1,2 HAVING count(*) > 1
      ORDER BY 3 DESC LIMIT 10`) as Array<Record<string, unknown>>

    const report = {
      total: total[0].c,
      conCedula: conCedula[0].c,
      duplicadosPorCedula: cedulaDups[0].c,
      gruposDuplicadosPorNombreUbicacion: nameDups[0].c,
      ejemplosTop: ejemplos,
    }

    // ── Aplicar borrado (solo por cédula, con secreto) ──
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
      return NextResponse.json({ applied: true, eliminados: deleted.length, report })
    }

    // ── Aplicar borrado por NOMBRE+APELLIDO+UBICACIÓN (conserva 1 por grupo) ──
    // Conserva, por grupo, la fila con foto y más antigua. Excluye 'por identificar'.
    if (apply === 'nombre') {
      const deleted = (await sql`
        DELETE FROM personas p
        WHERE coalesce(p.sin_identificar, false) = false
        AND p.id NOT IN (
          SELECT DISTINCT ON (lower(trim(nombre)), lower(trim(apellido)), lower(trim(coalesce(ultima_ubicacion,''))))
                 id FROM personas
          WHERE coalesce(sin_identificar, false) = false
          ORDER BY lower(trim(nombre)), lower(trim(apellido)), lower(trim(coalesce(ultima_ubicacion,''))),
                   (foto_url IS NOT NULL) DESC, (cedula IS NOT NULL) DESC, created_at ASC
        )
        RETURNING p.id`) as Array<{ id: string }>
      return NextResponse.json({ applied: true, modo: 'nombre+apellido+ubicacion', eliminados: deleted.length, report })
    }

    return NextResponse.json({ dryRun: true, ...report })
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}
