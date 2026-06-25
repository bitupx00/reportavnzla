/**
 * import-vtb.ts — Import data from venezuelatebusca.com scrape into Neon DB
 * 
 * Usage: DATABASE_URL="..." npx tsx scripts/import-vtb.ts /tmp/venezuelatebusca_data.json
 * 
 * The scraped JSON should be an array of objects with fields matching our schema.
 * This script:
 * 1. Reads the scraped data
 * 2. Deduplicates by cedula
 * 3. Geocodes ubicaciones using Nominatim
 * 4. Inserts into Neon DB
 */

import { neon } from '@neondatabase/serverless'
import * as fs from 'fs'
import * as path from 'path'

const sql = neon(process.env.DATABASE_URL!)

interface ScrapedPerson {
  nombre: string
  apellido?: string
  cedula?: string
  edad?: number
  genero?: string
  estado: string  // 'Por localizar' | 'Localizada'
  ultimaUbicacion?: string
  descripcion?: string
  fotoUrl?: string
  reportadoPorNombre?: string
  reportadoPorTelefono?: string
  reportadoPorEmail?: string
}

// Map their status to ours
function mapEstado(estado: string): string {
  switch (estado.toLowerCase()) {
    case 'por localizar':
    case 'buscado':
      return 'buscado'
    case 'localizada':
    case 'encontrado':
      return 'encontrado'
    case 'fallecido':
      return 'fallecido'
    default:
      return 'buscado'
  }
}

// Parse full name into nombre + apellido
function parseName(fullName: string): { nombre: string; apellido: string } {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length === 1) return { nombre: parts[0], apellido: '' }
  // First word = nombre, rest = apellido
  return { nombre: parts[0], apellido: parts.slice(1).join(' ') }
}

// Geocode using Nominatim
async function geocode(ubicacion: string): Promise<{ lat: number; lng: number } | null> {
  if (!ubicacion || ubicacion.length < 3) return null
  try {
    const query = encodeURIComponent(ubicacion + ', Venezuela')
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${query}&countrycodes=ve&limit=1`,
      { headers: { 'Accept-Language': 'es' } }
    )
    const data = await res.json()
    if (data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
    }
  } catch (e) {
    console.error(`  Geocode error for "${ubicacion}":`, e)
  }
  return null
}

// Rate-limit geocoding
const geoCache = new Map<string, { lat: number; lng: number } | null>()

async function geocodeWithCache(ubicacion: string): Promise<{ lat: number; lng: number } | null> {
  if (geoCache.has(ubicacion)) return geoCache.get(ubicacion)!
  const result = await geocode(ubicacion)
  geoCache.set(ubicacion, result)
  // Nominatim rate limit: 1 req/sec
  await new Promise(r => setTimeout(r, 1100))
  return result
}

async function main() {
  const dataPath = process.argv[2]
  if (!dataPath) {
    console.error('Usage: npx tsx scripts/import-vtb.ts <path-to-json>')
    process.exit(1)
  }

  const raw = fs.readFileSync(path.resolve(dataPath), 'utf-8')
  const persons: ScrapedPerson[] = JSON.parse(raw)
  console.log(`📋 Loaded ${persons.length} persons from scrape`)

  // Deduplicate by cedula
  const seen = new Set<string>()
  const unique = persons.filter(p => {
    const key = p.cedula || `${p.nombre}-${p.ultimaUbicacion}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  console.log(`📋 After dedup: ${unique.length} persons`)

  // Geocode unique locations
  const locations = Array.from(new Set(unique.map(p => p.ultimaUbicacion).filter(Boolean))) as string[]
  console.log(`📍 Geocoding ${locations.length} unique locations...`)

  for (let i = 0; i < locations.length; i++) {
    const result = await geocodeWithCache(locations[i])
    if (result) {
      console.log(`  ✅ ${locations[i]} → ${result.lat}, ${result.lng}`)
    } else {
      console.log(`  ❌ ${locations[i]} → not found`)
    }
  }

  // Insert into DB
  let inserted = 0
  let skipped = 0
  let errors = 0

  for (const p of unique) {
    const { nombre, apellido } = parseName(p.nombre)
    const estado = mapEstado(p.estado)
    const geo = p.ultimaUbicacion ? geoCache.get(p.ultimaUbicacion) : null

    try {
      await sql`
        INSERT INTO personas (nombre, apellido, cedula, edad, genero, estado, ultima_ubicacion, descripcion, foto_url, reportado_por_nombre, reportado_por_telefono, reportado_por_email, lat, lng, fuente_datos)
        VALUES (
          ${nombre}, ${apellido || null}, ${p.cedula || null}, ${p.edad || null},
          ${p.genero || null}, ${estado}, ${p.ultimaUbicacion || null},
          ${p.descripcion || null}, ${p.fotoUrl || null},
          ${p.reportadoPorNombre || null}, ${p.reportadoPorTelefono || null}, ${p.reportadoPorEmail || null},
          ${geo?.lat || null}, ${geo?.lng || null}, 'venezuelatebusca.com'
        )
      `
      inserted++
    } catch (e: any) {
      if (e.message?.includes('duplicate')) {
        skipped++
      } else {
        errors++
        console.error(`  ❌ Error inserting "${nombre}": ${e.message}`)
      }
    }
  }

  console.log(`\n✅ Import complete!`)
  console.log(`  Inserted: ${inserted}`)
  console.log(`  Skipped (duplicates): ${skipped}`)
  console.log(`  Errors: ${errors}`)
}

main().catch(console.error)
