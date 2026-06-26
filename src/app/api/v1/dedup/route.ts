import { NextResponse } from 'next/server'
import { sqlRaw } from '@/db'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * Ultimate dedup: normalize full name (concat nombre+apellido, 
 * split into words, sort alphabetically, join back) and match.
 * This catches cases where names are split differently across sources.
 */

async function dryRun(sql: ReturnType<typeof sqlRaw>) {
  const total = (await sql`SELECT count(*)::int AS c FROM personas`) as Array<{ c: number }>

  // Normalize full name: concat nombre + apellido, split words, sort, rejoin
  // This catches "juan carlos perez" + "gonzalez" == "juan carlos" + "perez gonzalez"
  const stats = (await sql`
    WITH normalized AS (
      SELECT id,
        array_to_string(array_sort(string_to_array(
          lower(trim(coalesce(nombre, ''))) || ' ' || lower(trim(coalesce(apellido, ''))),
          ' '
        )), ' ') AS fullnorm
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

  const examples = (await sql`
    WITH normalized AS (
      SELECT id,
        nombre, apellido,
        array_to_string(array_sort(string_to_array(
          lower(trim(coalesce(nombre, ''))) || ' ' || lower(trim(coalesce(apellido, ''))),
          ' '
        )), ' ') AS fullnorm
      FROM personas
      WHERE (nombre IS NOT NULL AND trim(nombre) <> '')
         OR (apellido IS NOT NULL AND trim(apellido) <> '')
    )
    SELECT fullnorm AS persona_norm,
           count(*)::int AS veces,
           string_agg(DISTINCT nombre || ' ' || apellido, ' | ') AS nombres_originales,
           string_agg(DISTINCT coalesce(external_id, '(sin id)'), ', ') AS ids
    FROM normalized
    WHERE fullnorm <> ''
    GROUP BY fullnorm
    HAVING count(*) > 1
    ORDER BY count(*) DESC
    LIMIT 20
  `) as Array<Record<string, unknown>>

  return {
    action: 'dry_run_ultimate',
    strategy: 'full name normalizado (nombre+apellido concatenados, palabras ordenadas)',
    records_before: total[0].c,
    duplicate_groups: stats[0].groups,
    duplicates_would_remove: stats[0].removable,
    records_would_remain: total[0].c - (stats[0].removable || 0),
    top_duplicates: examples,
  }
}

async function applyDedup(sql: ReturnType<typeof sqlRaw>) {
  const before = (await sql`SELECT count(*)::int AS c FROM personas`) as Array<{ c: number }>

  // Delete duplicates: keep best record per normalized full name group
  const result = (await sql`
    WITH normalized AS (
      SELECT id,
        external_id,
        foto_url,
        cedula,
        edad,
        created_at,
        array_to_string(array_sort(string_to_array(
          lower(trim(coalesce(nombre, ''))) || ' ' || lower(trim(coalesce(apellido, ''))),
          ' '
        )), ' ') AS fullnorm
      FROM personas
      WHERE (nombre IS NOT NULL AND trim(nombre) <> '')
         OR (apellido IS NOT NULL AND trim(apellido) <> '')
    ),
    ranked AS (
      SELECT id,
        ROW_NUMBER() OVER (
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
    DELETE FROM personas
    WHERE id IN (SELECT id FROM ranked WHERE rn > 1)
    RETURNING count(*)::int AS deleted
  `) as Array<{ deleted: number }>

  const after = (await sql`SELECT count(*)::int AS c FROM personas`) as Array<{ c: number }>

  // Also run traditional nombre+apellido dedup to catch edge cases
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

  const final = (await sql`SELECT count(*)::int AS c FROM personas`) as Array<{ c: number }>

  return {
    action: 'dedup_ultimate',
    strategy: 'full name normalizado + nombre+apellido exacto (doble pasada)',
    records_before: before[0].c,
    duplicates_removed: before[0].c - final[0].c,
    records_remaining: final[0].c,
  }
}

// GET = dry-run
export async function GET(request: Request) {
  try {
    const sql = sqlRaw()
    const url = new URL(request.url)
    const mode = url.searchParams.get('mode') || 'ultimate'
    if (mode === 'ultimate') {
      const result = await dryRun(sql)
      return NextResponse.json({ success: true, ...result })
    }
    // Legacy modes
    if (mode === 'hard') {
      const total = (await sql`SELECT count(*)::int AS c FROM personas`) as Array<{ c: number }>
      const stats = (await sql`
        SELECT count(*)::int AS groups, (sum(cnt) - count(*))::int AS removable
        FROM (
          SELECT lower(trim(nombre)) AS n, lower(trim(apellido)) AS a, count(*) AS cnt
          FROM personas
          WHERE nombre IS NOT NULL AND trim(nombre) <> ''
            AND apellido IS NOT NULL AND trim(apellido) <> ''
          GROUP BY n, a HAVING count(*) > 1
        ) t
      `) as Array<{ groups: number; removable: number }>
      return NextResponse.json({
        success: true, action: 'dry_run_hard', mode: 'hard',
        records_before: total[0].c, duplicate_groups: stats[0].groups,
        duplicates_would_remove: stats[0].removable,
        records_would_remain: total[0].c - stats[0].removable,
      })
    }
    // Soft
    const total = (await sql`SELECT count(*)::int AS c FROM personas`) as Array<{ c: number }>
    const stats = (await sql`
      SELECT count(*)::int AS groups, (sum(cnt) - count(*))::int AS removable
      FROM (
        SELECT lower(trim(nombre)) AS n, lower(trim(apellido)) AS a,
               lower(trim(coalesce(ultima_ubicacion, ''))) AS u, count(*) AS cnt
        FROM personas
        WHERE nombre IS NOT NULL AND trim(nombre) <> ''
          AND apellido IS NOT NULL AND trim(apellido) <> ''
        GROUP BY n, a, u HAVING count(*) > 1
      ) t
    `) as Array<{ groups: number; removable: number }>
    return NextResponse.json({
      success: true, action: 'dry_run_soft', mode: 'soft',
      records_before: total[0].c, duplicate_groups: stats[0].groups,
      duplicates_would_remove: stats[0].removable,
      records_would_remain: total[0].c - stats[0].removable,
    })
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
