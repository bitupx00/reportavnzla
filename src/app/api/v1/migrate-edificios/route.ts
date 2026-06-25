import { NextResponse } from 'next/server'
import { sqlRaw } from '@/db'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * One-time migration: create edificios table
 */
export async function POST() {
  try {
    const sql = sqlRaw()
    await sql`
      CREATE TABLE IF NOT EXISTS edificios (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        external_id VARCHAR(200),
        nombre VARCHAR(300) NOT NULL,
        direccion TEXT,
        ciudad VARCHAR(100),
        zona VARCHAR(200),
        lat REAL,
        lng REAL,
        nivel_danio VARCHAR(20),
        estado VARCHAR(50),
        foto_url TEXT,
        fuente VARCHAR(100),
        notas TEXT,
        nombres_atrapados TEXT,
        tiene_desaparecidos BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
      )
    `
    await sql`CREATE INDEX IF NOT EXISTS edificios_ciudad_idx ON edificios(ciudad)`
    await sql`CREATE INDEX IF NOT EXISTS edificios_danio_idx ON edificios(nivel_danio)`
    
    const count = (await sql`SELECT count(*)::int AS c FROM edificios`) as Array<{ c: number }>
    return NextResponse.json({ 
      success: true, 
      message: 'Tabla edificios creada', 
      count: count[0].c 
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
