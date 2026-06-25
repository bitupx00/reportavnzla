import { NextResponse } from 'next/server'
import { sqlRaw } from '@/db'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const SUPABASE_URL = 'https://jckifxsdlnsvbztxydes.supabase.co'
const SUPABASE_KEY = 'sb_publishable_i7iEDrCVZcSt0k3RGFrY4g_WrtZBB4w'

/**
 * Import buildings from terremotovenezuela.com Supabase API
 * GET  /api/v1/edificios/import   → import all buildings (one-time)
 * GET  /api/v1/edificios          → list buildings
 */
export async function GET() {
  try {
    const sql = sqlRaw()
    const result = await sql`SELECT count(*)::int AS c FROM edificios`
    const count = (result as Array<{ c: number }>)[0].c
    
    if (count > 0) {
      return NextResponse.json({ success: true, count, message: 'Buildings already imported' })
    }
    
    // Fetch all buildings from Supabase
    const headers: Record<string, string> = {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    }
    
    let all: any[] = []
    let offset = 0
    const limit = 500
    
    while (true) {
      const resp = await fetch(
        `${SUPABASE_URL}/rest/v1/buildings?select=*&order=created_at.desc&limit=${limit}&offset=${offset}`,
        { headers }
      )
      if (!resp.ok) break
      const page = await resp.json() as any[]
      if (!page.length) break
      all = all.concat(page)
      if (page.length < limit) break
      offset += limit
    }
    
    // Insert into our DB
    let inserted = 0
    for (const b of all) {
      try {
        await sql`
          INSERT INTO edificios (external_id, nombre, direccion, ciudad, zona, lat, lng, nivel_danio, estado, foto_url, fuente, notas, nombres_atrapados, tiene_desaparecidos)
          VALUES (
            ${`tvc-${b.id}`},
            ${b.name || ''},
            ${b.address || null},
            ${b.city || null},
            ${b.zone || null},
            ${b.lat || null},
            ${b.lng || null},
            ${b.damage_level || null},
            ${b.status || null},
            ${b.main_photo_url || null},
            ${'terremotovenezuela.com'},
            ${b.notes || b.casualties_notes || null},
            ${b.trapped_names || null},
            ${b.has_missing_persons || false}
          )
        `
        inserted++
      } catch (e: any) {
        if (!e.message?.includes('duplicate')) throw e
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      fetched: all.length, 
      inserted,
      message: `Imported ${inserted} buildings from terremotovenezuela.com`
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// POST to force re-import
export async function POST() {
  // Drop and re-create
  try {
    const sql = sqlRaw()
    await sql`DROP TABLE IF EXISTS edificios CASCADE`
    await sql`
      CREATE TABLE edificios (
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
    
    // Fetch all from Supabase
    const headers: Record<string, string> = {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    }
    
    let all: any[] = []
    let offset = 0
    const limit = 500
    
    while (true) {
      const resp = await fetch(
        `${SUPABASE_URL}/rest/v1/buildings?select=*&order=created_at.desc&limit=${limit}&offset=${offset}`,
        { headers }
      )
      if (!resp.ok) break
      const page = await resp.json() as any[]
      if (!page.length) break
      all = all.concat(page)
      if (page.length < limit) break
      offset += limit
    }
    
    let inserted = 0
    for (const b of all) {
      await sql`
        INSERT INTO edificios (external_id, nombre, direccion, ciudad, zona, lat, lng, nivel_danio, estado, foto_url, fuente, notas, nombres_atrapados, tiene_desaparecidos)
        VALUES (
          ${`tvc-${b.id}`},
          ${b.name || ''},
          ${b.address || null},
          ${b.city || null},
          ${b.zone || null},
          ${b.lat || null},
          ${b.lng || null},
          ${b.damage_level || null},
          ${b.status || null},
          ${b.main_photo_url || null},
          ${'terremotovenezuela.com'},
          ${b.notes || b.casualties_notes || null},
          ${b.trapped_names || null},
          ${b.has_missing_persons || false}
        )
      `
      inserted++
    }
    
    return NextResponse.json({ 
      success: true, 
      fetched: all.length, 
      inserted,
      message: `Re-imported ${inserted} buildings`
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
