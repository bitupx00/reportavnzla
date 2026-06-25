import { NextResponse } from 'next/server'
import { db } from '@/db'
import { personas } from '@/db/schema'
import { sql } from 'drizzle-orm'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// ─── Analyze duplicates in the database ─────────────────────
// POST /api/v1/dedup/analyze — returns full duplicate analysis
// POST /api/v1/dedup/analyze { action: "cleanup" } — actually removes duplicates
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const action = body.action || 'analyze'

  try {
    // ── 1. Overview ──
    const overview = await db().execute(sql`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE external_id IS NULL) as no_ext_id,
        COUNT(*) FILTER (WHERE external_id LIKE 'vtb-%') as vtb,
        COUNT(*) FILTER (WHERE external_id LIKE 'dtv-%') as dtv
      FROM personas
    `)
    const stats = overview.rows[0]

    // ── 2. Duplicates by external_id ──
    const dupByExtId = await db().execute(sql`
      SELECT external_id, COUNT(*) as cnt
      FROM personas
      WHERE external_id IS NOT NULL
      GROUP BY external_id
      HAVING COUNT(*) > 1
      ORDER BY cnt DESC
      LIMIT 50
    `)

    // ── 3. Duplicates by name similarity (same nombre+apellido, different id) ──
    const dupByName = await db().execute(sql`
      SELECT 
        LOWER(TRIM(nombre)) as nombre,
        LOWER(TRIM(apellido)) as apellido,
        COUNT(*) as cnt,
        array_agg(id ORDER BY created_at) as ids,
        array_agg(external_id ORDER BY created_at) as ext_ids,
        array_agg(estado ORDER BY created_at) as estados
      FROM personas
      WHERE nombre IS NOT NULL AND nombre != '' 
        AND apellido IS NOT NULL AND apellido != ''
      GROUP BY LOWER(TRIM(nombre)), LOWER(TRIM(apellido))
      HAVING COUNT(*) > 1
      ORDER BY cnt DESC
      LIMIT 100
    `)

    // ── 4. Duplicates by cédula ──
    const dupByCedula = await db().execute(sql`
      SELECT cedula, COUNT(*) as cnt,
        array_agg(id ORDER BY created_at) as ids
      FROM personas
      WHERE cedula IS NOT NULL AND TRIM(cedula) != ''
      GROUP BY cedula
      HAVING COUNT(*) > 1
      ORDER BY cnt DESC
      LIMIT 50
    `)

    // ── 5. Cross-source duplicates: same person from both VTB and DTV ──
    const crossSource = await db().execute(sql`
      SELECT 
        LOWER(TRIM(p1.nombre)) as nombre,
        LOWER(TRIM(p1.apellido)) as apellido,
        p1.cedula as cedula,
        p1.id as id1, p1.external_id as ext1, p1.estado as estado1,
        p2.id as id2, p2.external_id as ext2, p2.estado as estado2
      FROM personas p1
      JOIN personas p2 ON 
        LOWER(TRIM(p1.nombre)) = LOWER(TRIM(p2.nombre))
        AND LOWER(TRIM(p1.apellido)) = LOWER(TRIM(p2.apellido))
        AND p1.id < p2.id
        AND p1.external_id LIKE 'vtb-%' 
        AND p2.external_id LIKE 'dtv-%'
      LIMIT 50
    `)

    // ── 6. Records with no external_id at all ──
    const noExtId = await db().execute(sql`
      SELECT COUNT(*) as cnt FROM personas WHERE external_id IS NULL
    `)

    // ── 7. Same source duplicates (exact name match within same source) ──
    const sameSourceDup = await db().execute(sql`
      SELECT 
        CASE WHEN external_id LIKE 'vtb-%' THEN 'vtb' WHEN external_id LIKE 'dtv-%' THEN 'dtv' ELSE 'unknown' END as source,
        COUNT(*) as duplicate_groups,
        SUM(cnt - 1) as duplicate_records
      FROM (
        SELECT external_id, COUNT(*) as cnt
        FROM personas
        WHERE external_id IS NOT NULL
        GROUP BY external_id
        HAVING COUNT(*) > 1
      ) sub
      GROUP BY source
    `)

    // ── 8. Summary stats ──
    const totalByExtIdDup = await db().execute(sql`
      SELECT COUNT(*) as groups, SUM(cnt - 1) as removable
      FROM (
        SELECT external_id, COUNT(*) as cnt
        FROM personas
        WHERE external_id IS NOT NULL
        GROUP BY external_id
        HAVING COUNT(*) > 1
      ) sub
    `)

    const totalByNameDup = await db().execute(sql`
      SELECT COUNT(*) as groups, SUM(cnt - 1) as removable
      FROM (
        SELECT LOWER(TRIM(nombre)) as n, LOWER(TRIM(apellido)) as a, COUNT(*) as cnt
        FROM personas
        WHERE nombre IS NOT NULL AND nombre != '' AND apellido IS NOT NULL AND apellido != ''
        GROUP BY LOWER(TRIM(nombre)), LOWER(TRIM(apellido))
        HAVING COUNT(*) > 1
      ) sub
    `)

    if (action === 'cleanup') {
      // ── CLEANUP: remove duplicates ──
      // Strategy: keep the record with the most data (earliest created_at, has external_id, has photo)
      const results: any = {}

      // Step 1: Remove exact external_id duplicates (keep oldest)
      const removedExt = await db().execute(sql`
        DELETE FROM personas p1
        WHERE EXISTS (
          SELECT 1 FROM personas p2 
          WHERE p2.external_id = p1.external_id 
            AND p2.external_id IS NOT NULL
            AND p2.created_at < p1.created_at
        )
      `)
      results.removedByExternalId = removedExt.rowCount || 0

      // Step 2: Remove name duplicates within same source (keep oldest with external_id)
      const removedName = await db().execute(sql`
        DELETE FROM personas p1
        WHERE EXISTS (
          SELECT 1 FROM personas p2 
          WHERE LOWER(TRIM(p2.nombre)) = LOWER(TRIM(p1.nombre))
            AND LOWER(TRIM(p2.apellido)) = LOWER(TRIM(p1.apellido))
            AND p2.id < p1.id
            AND (
              (p1.external_id LIKE 'vtb-%' AND p2.external_id LIKE 'vtb-%')
              OR
              (p1.external_id LIKE 'dtv-%' AND p2.external_id LIKE 'dtv-%')
            )
        )
      `)
      results.removedByName = removedName.rowCount || 0

      // Step 3: Merge cross-source duplicates (keep the one with more data)
      const crossRemoved = await db().execute(sql`
        DELETE FROM personas p2
        WHERE EXISTS (
          SELECT 1 FROM personas p1 
          WHERE LOWER(TRIM(p1.nombre)) = LOWER(TRIM(p2.nombre))
            AND LOWER(TRIM(p1.apellido)) = LOWER(TRIM(p2.apellido))
            AND p1.id < p2.id
            AND p1.external_id LIKE 'vtb-%'
            AND p2.external_id LIKE 'dtv-%'
        )
      `)
      results.mergedCrossSource = crossRemoved.rowCount || 0

      // Final count
      const finalCount = await db().execute(sql`SELECT COUNT(*) as total FROM personas`)
      results.totalAfter = finalCount.rows[0].total
      results.totalRemoved = results.removedByExternalId + results.removedByName + results.mergedCrossSource

      return NextResponse.json({ success: true, action: 'cleanup', results })
    }

    return NextResponse.json({
      success: true,
      action: 'analyze',
      overview: stats,
      duplicates: {
        byExternalId: {
          groups: totalByExtIdDup.rows[0]?.groups || 0,
          removableRecords: totalByExtIdDup.rows[0]?.removable || 0,
          examples: dupByExtId.rows,
        },
        byName: {
          groups: (totalByNameDup.rows[0] as any)?.groups || 0,
          removableRecords: (totalByNameDup.rows[0] as any)?.removable || 0,
          examples: dupByName.rows.slice(0, 20) as any[],
        },
        byCedula: {
          groups: dupByCedula.rows.length,
          examples: dupByCedula.rows.slice(0, 10),
        },
        crossSource: {
          pairs: crossSource.rows.length,
          examples: crossSource.rows.slice(0, 10),
        },
      },
      sameSourceBreakdown: sameSourceDup.rows,
      noExternalId: noExtId.rows[0]?.cnt || 0,
      estimatedRemovable:
        (parseInt(String(totalByExtIdDup.rows[0]?.removable)) || 0) +
        (parseInt(String((totalByNameDup.rows[0] as any)?.removable)) || 0),
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
