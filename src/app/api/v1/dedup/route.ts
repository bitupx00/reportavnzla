import { NextResponse } from 'next/server'
import { sqlRaw } from '@/db'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * Aggressive dedup endpoint.
 *
 * GET  /api/v1/dedup?mode=soft    → dry-run soft (nombre+apellido+ubicacion exacta)
 * GET  /api/v1/dedup?mode=hard    → dry-run hard (solo nombre+apellido, ignora ubicacion)
 * POST /api/v1/dedup              → execute hard dedup (solo nombre+apellido)
 *
 * Keep BEST record per group:
 *   1. Has external_id   >  no external_id
 *   2. Has foto_url      >  no foto_url
 *   3. Has cedula        >  no cedula
 *   4. Newer created_at  >  older created_at
 */

async function dryRun(sql: ReturnType<typeof sqlRaw>, mode: string) {
  const total = (await sql`SELECT count(*)::int AS c FROM personas`) as Array<{ c: number }>

  if (mode === 'hard') {
    // Match ONLY by nombre + apellido (ignore ubicacion)
    const stats = (await sql`
      SELECT count(*)::int AS groups, (sum(cnt) - count(*))::int AS removable
      FROM (
        SELECT lower(trim(nombre)) AS n,
               lower(trim(apellido)) AS a,
               count(*) AS cnt
        FROM personas
        WHERE nombre IS NOT NULL AND trim(nombre) <> ''
          AND apellido IS NOT NULL AND trim(apellido) <> ''
        GROUP BY n, a
        HAVING count(*) > 1
      ) t
    `) as Array<{ groups: number; removable: number }>

    const examples = (await sql`
      SELECT lower(trim(nombre)) || ' ' || lower(trim(apellido)) AS persona,
             count(*)::int AS veces,
             string_agg(DISTINCT coalesce(ultima_ubicacion, '(sin ubicación)'), ' | ') AS ubicaciones,
             string_agg(DISTINCT coalesce(external_id, '(sin id)'), ', ') AS ids
      FROM personas
      WHERE nombre IS NOT NULL AND trim(nombre) <> ''
        AND apellido IS NOT NULL AND trim(apellido) <> ''
      GROUP BY lower(trim(nombre)), lower(trim(apellido))
      HAVING count(*) > 1
      ORDER BY count(*) DESC
      LIMIT 15
    `) as Array<Record<string, unknown>>

    return {
      action: 'dry_run_hard',
      mode: 'hard',
      strategy: 'nombre + apellido (ubicacion ignorada)',
      records_before: total[0].c,
      duplicate_groups: stats[0].groups,
      duplicates_would_remove: stats[0].removable,
      records_would_remain: total[0].c - stats[0].removable,
      top_duplicates: examples,
    }
  }

  // Soft mode (original): nombre + apellido + ubicacion exacta
  const stats = (await sql`
    SELECT count(*)::int AS groups, (sum(cnt) - count(*))::int AS removable
    FROM (
      SELECT lower(trim(nombre)) AS n,
             lower(trim(apellido)) AS a,
             lower(trim(coalesce(ultima_ubicacion, ''))) AS u,
             count(*) AS cnt
      FROM personas
      WHERE nombre IS NOT NULL AND trim(nombre) <> ''
        AND apellido IS NOT NULL AND trim(apellido) <> ''
      GROUP BY n, a, u
      HAVING count(*) > 1
    ) t
  `) as Array<{ groups: number; removable: number }>

  return {
    action: 'dry_run_soft',
    mode: 'soft',
    strategy: 'nombre + apellido + ubicacion exacta',
    records_before: total[0].c,
    duplicate_groups: stats[0].groups,
    duplicates_would_remove: stats[0].removable,
    records_would_remain: total[0].c - stats[0].removable,
  }
}

async function applyDedup(sql: ReturnType<typeof sqlRaw>) {
  const before = (await sql`SELECT count(*)::int AS c FROM personas`) as Array<{ c: number }>

  const stats = (await sql`
    SELECT count(*)::int AS groups, (sum(cnt) - count(*))::int AS removable
    FROM (
      SELECT lower(trim(nombre)) AS n,
             lower(trim(apellido)) AS a,
             count(*) AS cnt
      FROM personas
      WHERE nombre IS NOT NULL AND trim(nombre) <> ''
        AND apellido IS NOT NULL AND trim(apellido) <> ''
      GROUP BY n, a
      HAVING count(*) > 1
    ) t
  `) as Array<{ groups: number; removable: number }>

  const groupCount = stats[0].groups

  if (groupCount === 0) {
    const after = (await sql`SELECT count(*)::int AS c FROM personas`) as Array<{ c: number }>
    return {
      action: 'dedup_applied',
      records_before: before[0].c,
      total_groups: 0,
      duplicates_removed: 0,
      records_remaining: after[0].c,
    }
  }

  // Delete duplicates: keep rank=1 (best record) per nombre+apellido group
  await sql`
    WITH ranked AS (
      SELECT id,
        ROW_NUMBER() OVER (
          PARTITION BY
            lower(trim(nombre)),
            lower(trim(apellido))
          ORDER BY
            (external_id IS NOT NULL)::int DESC,
            (foto_url IS NOT NULL)::int DESC,
            (cedula IS NOT NULL AND cedula <> '')::int DESC,
            (edad IS NOT NULL)::int DESC,
            created_at DESC
        ) AS rn
      FROM personas
      WHERE nombre IS NOT NULL AND trim(nombre) <> ''
        AND apellido IS NOT NULL AND trim(apellido) <> ''
    )
    DELETE FROM personas
    WHERE id IN (SELECT id FROM ranked WHERE rn > 1)
  `

  const after = (await sql`SELECT count(*)::int AS c FROM personas`) as Array<{ c: number }>

  return {
    action: 'dedup_applied',
    mode: 'hard',
    strategy: 'nombre + apellido (ubicacion ignorada)',
    records_before: before[0].c,
    total_groups: groupCount,
    expected_removals: stats[0].removable,
    duplicates_removed: before[0].c - after[0].c,
    records_remaining: after[0].c,
  }
}

// GET = dry-run
export async function GET(request: Request) {
  try {
    const sql = sqlRaw()
    const url = new URL(request.url)
    const mode = url.searchParams.get('mode') || 'soft'
    const result = await dryRun(sql, mode)
    return NextResponse.json({ success: true, ...result })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}

// POST = actually delete duplicates
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const secret = body.secret

    const validSecret = process.env.DEDUP_SECRET || 'DEDUP_VNZLA_2026'
    if (secret !== validSecret) {
      return NextResponse.json(
        { success: false, error: 'secret inválido' },
        { status: 403 },
      )
    }

    const sql = sqlRaw()
    const result = await applyDedup(sql)
    return NextResponse.json({ success: true, ...result })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
