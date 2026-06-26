import { NextRequest, NextResponse } from 'next/server'
import { sqlRaw } from '@/db'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Importa centros de acopio desde el Google Sheet público (gviz JSON).
// GET            -> dry-run: cuántas filas se leyeron + muestra.
// GET ?apply=1   -> reemplaza los centros con origen 'gsheet' por los del sheet.
const SHEET_ID = '1OTNQGMsK3nU2wqy00rtPPcwsSzAlorWeP-uIotWpkxM'

async function ensureSchema() {
  const sql = sqlRaw()
  await sql`
    CREATE TABLE IF NOT EXISTS recursos (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tipo varchar(20) NOT NULL, nombre varchar(160) NOT NULL, direccion text,
      lat real, lng real, recibe text, nivel_dano varchar(20), descripcion text,
      contacto varchar(120), activo boolean NOT NULL DEFAULT true, created_at timestamptz DEFAULT now()
    )`
  await sql`ALTER TABLE recursos ADD COLUMN IF NOT EXISTS origen varchar(20)`
}

interface Fila {
  nombre: string
  direccion: string | null
  lat: number | null
  lng: number | null
  recibe: string | null
  contacto: string | null
}

async function leerSheet(): Promise<Fila[]> {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json`
  const res = await fetch(url, { cache: 'no-store' })
  const text = await res.text()
  const json = JSON.parse(text.slice(text.indexOf('(') + 1, text.lastIndexOf(')')))
  const rows: any[] = json.table?.rows || []
  const val = (c: any) => (c && c.v != null ? String(c.v).trim() : '')
  const out: Fila[] = []
  for (const r of rows) {
    const c = r.c || []
    const nombre = val(c[1])
    if (!nombre || nombre.toLowerCase() === 'quién' || nombre.toLowerCase() === 'quien') continue
    const ciudad = val(c[4])
    const coords = val(c[3])
    let lat: number | null = null
    let lng: number | null = null
    const m = coords.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/)
    if (m) {
      lat = parseFloat(m[1])
      lng = parseFloat(m[2])
    }
    const dir = [val(c[2]), ciudad].filter(Boolean).join(', ')
    out.push({
      nombre: nombre.slice(0, 160),
      direccion: dir ? dir.slice(0, 500) : null,
      lat,
      lng,
      recibe: val(c[6]) ? val(c[6]).slice(0, 500) : null,
      contacto: val(c[7]) ? val(c[7]).slice(0, 120) : null,
    })
  }
  return out
}

export async function GET(request: NextRequest) {
  try {
    const apply = new URL(request.url).searchParams.get('apply') === '1'
    const filas = await leerSheet()
    if (!apply) {
      return NextResponse.json({ dryRun: true, filas: filas.length, conCoords: filas.filter((f) => f.lat).length, muestra: filas.slice(0, 5) })
    }
    await ensureSchema()
    const sql = sqlRaw()
    await sql`DELETE FROM recursos WHERE origen = 'gsheet'`
    let n = 0
    for (const f of filas) {
      await sql`
        INSERT INTO recursos (tipo, nombre, direccion, lat, lng, recibe, contacto, origen)
        VALUES ('centro_acopio', ${f.nombre}, ${f.direccion}, ${f.lat}, ${f.lng}, ${f.recibe}, ${f.contacto}, 'gsheet')`
      n++
    }
    return NextResponse.json({ applied: true, importados: n })
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}
