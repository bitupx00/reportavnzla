import { NextResponse } from 'next/server'
import { sqlRaw } from '@/db'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * Ultimate dedup v3 — batch delete approach (Neon-compatible).
 *
 * GET  /api/v1/dedup3?mode=ultimate  → dry-run
 * POST /api/v1/dedup3               → execute (batched DELETE)
 */

async function dryRun(sql: ReturnType<typeof sqlRaw>) {
  const total = (await sql`SELECT count(*)::int AS c FROM personas`) as Array<{ c: number }>

  const stats = (await sql`
    WITH normalized AS (
      SELECT id,
        (SELECT string_agg(w, ' ' ORDER BY w)
         FROM unnest(string_to_array(
           lower(trim(coalesce(nombre, ''))) || ' ' || lower(trim(coalesce(apellido, ''))),
           ' '
         )) AS w
         WHERE w <> '') AS fullnorm
      FROM personas
      WHERE (nombre IS NOT NULL AND trim(nombre) <> '')
         OR (apellido IS NOT NULL AND trim(apellido) <> '')
    )
    SELECT count(*)::int AS groups, (sum(cnt) - count(*))::int AS removable
    FROM (
      SELECT fullnorm, count(*)::int AS cnt
      FROM normalized
      WHERE fullnorm <> ''
      GROUP BY fullnorm
      HAVING count(*) > 1
    ) t
  `) as Array<{ groups: number; removable: number }>

  return {
    records_before: total[0].c,
    duplicate_groups: stats[0].groups,
    duplicates_would_remove: stats[0].removable,
  }
}

async function applyDedup(sql: ReturnType<typeof sqlRaw>) {
  const before = (await sql`SELECT count(*)::int AS c FROM personas`) as Array<{ c: number }>
  let totalDeleted = 0

  // Pass 1: Full name normalized — SELECT IDs first, then batch DELETE
  const idsToKeep = new Set<number>()

  // Get IDs to KEEP (rn = 1 per group)
  const keepRows = (await sql`
    WITH normalized AS (
      SELECT id,
        external_id, foto_url, cedula, edad, created_at,
        (SELECT string_agg(w, ' ' ORDER BY w)
         FROM unnest(string_to_array(
           lower(trim(coalesce(nombre, ''))) || ' ' || lower(trim(coalesce(apellido, ''))),
           ' '
         )) AS w
         WHERE w <> '') AS fullnorm
      FROM personas
      WHERE (nombre IS NOT NULL AND trim(nombre) <> '')
         OR (apellido IS NOT NULL AND trim(apellido) <> '')
    ),
    ranked AS (
      SELECT id, ROW_NUMBER() OVER (
        PARTITION BY fullnorm
        ORDER BY
          (external_id IS NOT NULL)::int DESC,
          (foto_url IS NOT NULL)::int DESC,
          (cedula IS NOT NULL AND cedula <> '')::int DESC,
          (edad IS NOT NULL)::int DESC,
          created_at DESC
      ) AS rn
      FROM normalized
      WHERE fullnorm <> ''
    )
    SELECT id FROM ranked WHERE rn = 1
  `) as Array<{ id: number }>

  // Now get ALL IDs that have a duplicate fullnorm
  const dupIds = (await sql`
    WITH normalized AS (
      SELECT id,
        (SELECT string_agg(w, ' ' ORDER BY w)
         FROM unnest(string_to_array(
           lower(trim(coalesce(nombre, ''))) || ' ' || lower(trim(coalesce(apellido, ''))),
           ' '
         )) AS w
         WHERE w <> '') AS fullnorm
      FROM personas
      WHERE (nombre IS NOT NULL AND trim(nombre) <> '')
         OR (apellido IS NOT NULL AND trim(apellido) <> '')
    ),
    dupes AS (
      SELECT fullnorm
      FROM normalized
      WHERE fullnorm <> ''
      GROUP BY fullnorm
      HAVING count(*) > 1
    )
    SELECT n.id
    FROM normalized n
    JOIN dupes d ON n.fullnorm = d.fullnorm
  `) as Array<{ id: number }>

  const keepSet = new Set(keepRows.map(r => r.id))
  const dupSet = new Set(dupIds.map(r => r.id))

  const toDelete: number[] = Array.from(dupSet).filter(id => !keepSet.has(id))

  // Batch DELETE in chunks of 500
  const BATCH = 500
  for (let i = 0; i < toDelete.length; i += BATCH) {
    const chunk = toDelete.slice(i, i + BATCH)
    const result: any = await sql`DELETE FROM personas WHERE id = ANY(${chunk}::int[])`
    totalDeleted += result.count ?? chunk.length
  }

  // Pass 2: Traditional nombre+apellido exact dedup
  const keepRows2 = (await sql`
    WITH ranked AS (
      SELECT id, ROW_NUMBER() OVER (
        PARTITION BY lower(trim(nombre)), lower(trim(apellido))
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
    SELECT id FROM ranked WHERE rn = 1
  `) as Array<{ id: number }>

  const dupIds2 = (await sql`
    WITH dupes AS (
      SELECT lower(trim(nombre)) AS n, lower(trim(apellido)) AS a
      FROM personas
      WHERE nombre IS NOT NULL AND trim(nombre) <> ''
        AND apellido IS NOT NULL AND trim(apellido) <> ''
      GROUP BY lower(trim(nombre)), lower(trim(apellido))
      HAVING count(*) > 1
    )
    SELECT p.id
    FROM personas p
    JOIN dupes d ON lower(trim(p.nombre)) = d.n AND lower(trim(p.apellido)) = d.a
  `) as Array<{ id: number }>

  const keepSet2 = new Set(keepRows2.map(r => r.id))
  const dupSet2 = new Set(dupIds2.map(r => r.id))

  const toDelete2: number[] = Array.from(dupSet2).filter(id => !keepSet2.has(id))

  for (let i = 0; i < toDelete2.length; i += BATCH) {
    const chunk = toDelete2.slice(i, i + BATCH)
    const result: any = await sql`DELETE FROM personas WHERE id = ANY(${chunk}::int[])`
    totalDeleted += result.count ?? chunk.length
  }

  const after = (await sql`SELECT count(*)::int AS c FROM personas`) as Array<{ c: number }>

  return {
    records_before: before[0].c,
    duplicates_removed: totalDeleted,
    records_remaining: after[0].c,
  }
}

export async function GET(request: Request) {
  try {
    const sql = sqlRaw()
    const result = await dryRun(sql)
    return NextResponse.json({ success: true, action: 'dry_run_ultimate_v3', ...result })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const secret = body.secret
    const validSecret = process.env.DEDUP_SECRET || 'DEDUP_VNZLA_2026'
    if (secret !== validSecret) {
      return NextResponse.json({ success: false, error: 'secret inválido' }, { status: 403 })
    }
    const sql = sqlRaw()
    const result = await applyDedup(sql)
    return NextResponse.json({ success: true, action: 'dedup_ultimate_v3', ...result })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
