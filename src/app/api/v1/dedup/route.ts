import { NextResponse } from 'next/server'
import { sqlRaw } from '@/db'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * One-time dedup endpoint.
 *
 * GET  /api/v1/dedup          → dry-run: report duplicate counts (no changes)
 * POST /api/v1/dedup          → actually delete duplicates (requires DEDUP_SECRET)
 *
 * Strategy: match on LOWER(TRIM(nombre)) + LOWER(TRIM(apellido)) + LOWER(TRIM(COALESCE(ultima_ubicacion,'')))
 * Keep the BEST record per group:
 *   1. Has external_id   >  no external_id
 *   2. Has foto_url      >  no foto_url
 *   3. Newer created_at  >  older created_at
 */

async function dryRun(sql: ReturnType<typeof sqlRaw>) {
  const total = (await sql`SELECT count(*)::int AS c FROM personas`) as Array<{ c: number }>
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

  const examples = (await sql`
    SELECT lower(trim(nombre)) || ' ' || lower(trim(apellido)) AS persona,
           coalesce(ultima_ubicacion, '(sin ubicación)') AS ubicacion,
           count(*)::int AS veces
    FROM personas
    WHERE nombre IS NOT NULL AND trim(nombre) <> ''
      AND apellido IS NOT NULL AND trim(apellido) <> ''
    GROUP BY 1, 2
    HAVING count(*) > 1
    ORDER BY 3 DESC
    LIMIT 15
  `) as Array<Record<string, unknown>>

  return {
    action: 'dry_run',
    records_before: total[0].c,
    duplicate_groups: stats[0].groups,
    duplicates_would_remove: stats[0].removable,
    records_would_remain: total[0].c - stats[0].removable,
    top_duplicates: examples,
  }
}

async function applyDedup(sql: ReturnType<typeof sqlRaw>) {
  const before = (await sql`SELECT count(*)::int AS c FROM personas`) as Array<{ c: number }>

  // Get duplicate group stats before deleting
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

  // Delete duplicates using ROW_NUMBER: rank within each group, keep rank=1
  const result = await sql`
    WITH ranked AS (
      SELECT id,
        ROW_NUMBER() OVER (
          PARTITION BY
            lower(trim(nombre)),
            lower(trim(apellido)),
            lower(trim(coalesce(ultima_ubicacion, '')))
          ORDER BY
            (external_id IS NOT NULL)::int DESC,
            (foto_url IS NOT NULL)::int DESC,
            created_at DESC
        ) AS rn
      FROM personas
      WHERE nombre IS NOT NULL AND trim(nombre) <> ''
        AND apellido IS NOT NULL AND trim(apellido) <> ''
    )
    DELETE FROM personas
    WHERE id IN (SELECT id FROM ranked WHERE rn > 1)
  `

  // neon returns count for write operations
  const deletedCount = typeof result === 'number' ? result : (result as any).count ?? 0

  const after = (await sql`SELECT count(*)::int AS c FROM personas`) as Array<{ c: number }>

  return {
    action: 'dedup_applied',
    records_before: before[0].c,
    total_groups: groupCount,
    expected_removals: stats[0].removable,
    duplicates_removed: deletedCount,
    records_remaining: after[0].c,
  }
}

// GET = dry-run (safe, no changes)
export async function GET() {
  try {
    const sql = sqlRaw()
    const result = await dryRun(sql)
    return NextResponse.json({ success: true, ...result })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}

// POST = actually delete duplicates (requires secret)
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const secret = body.secret

    if (!process.env.DEDUP_SECRET || secret !== process.env.DEDUP_SECRET) {
      return NextResponse.json(
        { success: false, error: 'secret inválido o DEDUP_SECRET no configurado' },
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
