import { NextResponse } from 'next/server'
import { db } from '@/db'
import { sql } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

// One-time migration endpoint — creates sync_log table and indexes
export async function GET() {
  try {
    await db().execute(sql`
      CREATE TABLE IF NOT EXISTS sync_log (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        source VARCHAR(50) NOT NULL,
        status VARCHAR(20) NOT NULL,
        total_fetched INTEGER DEFAULT 0,
        new_inserted INTEGER DEFAULT 0,
        status_changed INTEGER DEFAULT 0,
        updated INTEGER DEFAULT 0,
        errors INTEGER DEFAULT 0,
        duration_ms INTEGER,
        details TEXT,
        started_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        completed_at TIMESTAMPTZ
      )
    `)

    await db().execute(sql`
      CREATE INDEX IF NOT EXISTS personas_external_id_idx ON personas(external_id)
    `)

    const counts = await db().execute(sql`
      SELECT 
        COUNT(*) FILTER (WHERE external_id LIKE 'vtb-%') as vtb,
        COUNT(*) FILTER (WHERE external_id LIKE 'dtv-%') as dtv,
        COUNT(*) FILTER (WHERE external_id IS NULL) as no_ext,
        COUNT(*) as total
      FROM personas
    `)

    return NextResponse.json({
      success: true,
      message: 'sync_log table and indexes created',
      counts: counts.rows[0],
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 })
  }
}
