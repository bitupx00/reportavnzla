import { NextResponse } from 'next/server'
import { sqlRaw } from '@/db'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * One-time migration: ensure external_id column exists
 */
export async function POST() {
  try {
    const sql = sqlRaw()
    // Try to add the column if it doesn't exist
    try {
      await sql`ALTER TABLE personas ADD COLUMN IF NOT EXISTS external_id VARCHAR(100)`
      await sql`ALTER TABLE personas ADD COLUMN IF NOT EXISTS reportado_por_telefono VARCHAR(30)`
      await sql`ALTER TABLE personas ADD COLUMN IF NOT EXISTS reportado_por_email VARCHAR(150)`
      await sql`ALTER TABLE personas ADD COLUMN IF NOT EXISTS fecha_encontrado TIMESTAMPTZ`
      await sql`ALTER TABLE personas ADD COLUMN IF NOT EXISTS notas TEXT`
      await sql`ALTER TABLE personas ADD COLUMN IF NOT EXISTS fuente_id UUID`
      await sql`CREATE INDEX IF NOT EXISTS personas_external_id_idx ON personas(external_id)`
    } catch (e: any) {
      return NextResponse.json({ success: false, error: 'Migration error: ' + e.message }, { status: 500 })
    }
    
    // Verify
    const result = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'personas' ORDER BY ordinal_position`
    return NextResponse.json({ success: true, columns: result })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
