import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { personas, syncLog } from '@/db/schema'
import { eq, sql, desc } from 'drizzle-orm'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // Vercel max for hobby plan

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}

// ─── VTB API: venezuelatebusca.com ────────────────────────────
const VTB_API = 'https://venezuela-te-busca-app.hellogafaro.workers.dev/api/persons'

async function fetchAllVTB() {
  const all: any[] = []
  let cursor: string | undefined
  let page = 0

  while (true) {
    page++
    const url = cursor ? `${VTB_API}?limit=250&cursor=${encodeURIComponent(cursor)}` : `${VTB_API}?limit=250`
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } })
    if (!res.ok) throw new Error(`VTB API ${res.status} on page ${page}`)
    const data = await res.json()
    const items = data.persons || []
    if (items.length === 0) break

    all.push(...items)
    // Get cursor from last record
    const last = items[items.length - 1]
    cursor = last.created_at
    console.log(`  VTB page ${page}: +${items.length} (total: ${all.length})`)

    if (items.length < 250) break // last page
  }

  return all
}

// ─── DTV API: desaparecidosterremotovenezuela.com ────────────
const DTV_API = 'https://desaparecidos-terremoto-api.theempire.tech/api/personas'

async function fetchAllDTV() {
  const all: any[] = []
  let page = 1

  while (true) {
    const url = `${DTV_API}?page=${page}&pageSize=100`
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } })
    if (!res.ok) throw new Error(`DTV API ${res.status} on page ${page}`)
    const data = await res.json()
    const items = data.items || []
    if (items.length === 0) break

    all.push(...items)
    if (page % 50 === 0) console.log(`  DTV page ${page}: +${items.length} (total: ${all.length})`)

    page++
    if (items.length < 100) break
    // Rate limit: ~120 req/min for DTV
    await new Promise(r => setTimeout(r, 520))
  }

  return all
}

// ─── Map source statuses to our enum ─────────────────────────
type Estado = 'buscado' | 'encontrado' | 'fallecido'

function mapVtbStatus(status: string): Estado {
  if (status === 'found') return 'encontrado'
  return 'buscado'
}

function mapDtvStatus(estado: string): Estado {
  if (estado === 'localizado') return 'encontrado'
  return 'buscado'
}

// ─── Insert or update a single record ────────────────────────
async function upsertPersona(data: {
  externalId: string
  nombre: string
  apellido: string
  cedula?: string | null
  edad?: number | null
  genero?: string | null
  estado: Estado,
  ubicacion?: string | null
  descripcion?: string | null
  fotoUrl?: string | null
  reportadoPorNombre?: string | null
  reportadoPorTelefono?: string | null
}): Promise<{ action: 'inserted' | 'updated' | 'status_changed' | 'skipped', oldStatus?: string }> {
  // Check if exists by externalId
  const [existing] = await db()
    .select({ id: personas.id, estado: personas.estado })
    .from(personas)
    .where(eq(personas.externalId, data.externalId))
    .limit(1)

  if (existing) {
    // Check if status changed
    if (existing.estado !== data.estado) {
      await db()
        .update(personas)
        .set({
          estado: data.estado,
          updatedAt: new Date(),
          ...(data.ubicacion ? { ultimaUbicacion: data.ubicacion } : {}),
          ...(data.fotoUrl ? { fotoUrl: data.fotoUrl } : {}),
        })
        .where(eq(personas.id, existing.id))
      return { action: 'status_changed', oldStatus: existing.estado }
    }

    // Update other fields but skip if nothing changed
    const updates: any = { updatedAt: new Date() }
    if (data.ubicacion) updates.ultimaUbicacion = data.ubicacion
    if (data.fotoUrl && data.fotoUrl !== 'null') updates.fotoUrl = data.fotoUrl
    if (data.descripcion) updates.descripcion = data.descripcion

    await db()
      .update(personas)
      .set(updates)
      .where(eq(personas.id, existing.id))

    return { action: 'updated' }
  }

  // Insert new
  try {
    await db().insert(personas).values({
      externalId: data.externalId,
      nombre: data.nombre.slice(0, 100),
      apellido: data.apellido.slice(0, 100),
      cedula: data.cedula || null,
      edad: data.edad || null,
      genero: data.genero || null,
      estado: data.estado,
      ultimaUbicacion: data.ubicacion || null,
      descripcion: data.descripcion || null,
      fotoUrl: data.fotoUrl || null,
      reportadoPorNombre: data.reportadoPorNombre || null,
      reportadoPorTelefono: data.reportadoPorTelefono || null,
    })
    return { action: 'inserted' }
  } catch (e: any) {
    // Duplicate external_id race condition — skip
    if (e.message?.includes('duplicate') || e.message?.includes('unique')) {
      return { action: 'skipped' }
    }
    throw e
  }
}

// ─── Sync a single source ────────────────────────────────────
async function syncSource(source: 'vtb' | 'dtv') {
  const startTime = Date.now()
  const stats = { totalFetched: 0, newInserted: 0, statusChanged: 0, updated: 0, errors: 0 }
  const changes: string[] = []

  // Create sync log entry
  const [log] = await db()
    .insert(syncLog)
    .values({ source, status: 'running', startedAt: new Date() })
    .returning()

  try {
    let records: any[]

    if (source === 'vtb') {
      records = await fetchAllVTB()
    } else {
      records = await fetchAllDTV()
    }

    stats.totalFetched = records.length

    // Process in batches of 20 (DB connections are limited)
    const BATCH = 20
    for (let i = 0; i < records.length; i += BATCH) {
      const batch = records.slice(i, i + BATCH)

      const results = await Promise.allSettled(
        batch.map(async (r) => {
          if (source === 'vtb') {
            // Map VTB fields
            const firstName = (r.first_name || '').trim()
            const lastName = (r.last_name || '').trim()
            if (!firstName || firstName.length < 2) return null

            return upsertPersona({
              externalId: `vtb-${r.id}`,
              nombre: firstName,
              apellido: lastName || ' ',
              cedula: r.national_id || null,
              edad: r.age ? parseInt(r.age) : null,
              genero: r.gender || null,
              estado: mapVtbStatus(r.status),
              ubicacion: r.last_seen_location || null,
              descripcion: r.description || r.found_notes || null,
              fotoUrl: r.photo_key ? `https://venezuela-te-busca-app.hellogafaro.workers.dev${r.photo_key}` : null,
              reportadoPorNombre: r.reporter_name || null,
              reportadoPorTelefono: r.reporter_phone || null,
            })
          } else {
            // Map DTV fields
            const nombre = (r.nombre || '').trim()
            if (!nombre || nombre.length < 2) return null

            const parts = nombre.split(' ')
            const firstName = parts[0]
            const lastName = parts.slice(1).join(' ') || ' '

            return upsertPersona({
              externalId: `dtv-${r.id}`,
              nombre: firstName.slice(0, 100),
              apellido: lastName.slice(0, 100),
              edad: r.edad ? parseInt(r.edad) : null,
              genero: null,
              estado: mapDtvStatus(r.estado),
              ubicacion: r.ubicacion || null,
              descripcion: r.descripcion || null,
              fotoUrl: r.foto || null,
              reportadoPorNombre: r.localizadoPor || null,
              reportadoPorTelefono: r.localizadoContacto || null,
            })
          }
        })
      )

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          const r = result.value
          if (r.action === 'inserted') stats.newInserted++
          else if (r.action === 'status_changed') {
            stats.statusChanged++
            changes.push(`${r.oldStatus}→${r.action}`)
          }
          else if (r.action === 'updated') stats.updated++
        } else if (result.status === 'rejected') {
          stats.errors++
        }
      }

      // Progress log every 1000 records
      if ((i + BATCH) % 1000 < BATCH) {
        console.log(`  ${source.toUpperCase()} progress: ${i + batch.length}/${records.length} ins=${stats.newInserted} chg=${stats.statusChanged} err=${stats.errors}`)
      }
    }

    const durationMs = Date.now() - startTime

    // Update sync log
    await db()
      .update(syncLog)
      .set({
        status: 'completed',
        totalFetched: stats.totalFetched,
        newInserted: stats.newInserted,
        statusChanged: stats.statusChanged,
        updated: stats.updated,
        errors: stats.errors,
        durationMs,
        details: JSON.stringify({ changes: changes.slice(0, 50) }),
        completedAt: new Date(),
      })
      .where(eq(syncLog.id, log.id))

    return { success: true, ...stats, durationMs, source }

  } catch (error: any) {
    const durationMs = Date.now() - startTime
    await db()
      .update(syncLog)
      .set({
        status: 'error',
        errors: stats.errors + 1,
        durationMs,
        details: JSON.stringify({ error: error.message, processedSoFar: stats.totalFetched }),
        completedAt: new Date(),
      })
      .where(eq(syncLog.id, log.id))

    return { success: false, error: error.message, ...stats, durationMs, source }
  }
}

// ─── POST /api/v1/sync/pull ─────────────────────────────────
// Triggers a full sync from both source APIs
// Body (optional): { sources: ['vtb', 'dtv'] } — defaults to both
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const sources: string[] = body.sources || ['vtb', 'dtv']

    const results: any[] = []

    for (const source of sources) {
      if (source === 'vtb' || source === 'dtv') {
        console.log(`\n🔄 Syncing ${source.toUpperCase()}...`)
        const result = await syncSource(source as 'vtb' | 'dtv')
        results.push(result)
        console.log(`✅ ${source.toUpperCase()}: ${JSON.stringify(result)}`)
      }
    }

    return NextResponse.json({
      success: true,
      syncedAt: new Date().toISOString(),
      results,
    }, { headers: corsHeaders })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500, headers: corsHeaders })
  }
}

// ─── GET /api/v1/sync/pull ──────────────────────────────────
// Returns sync history (last 20 runs)
export async function GET() {
  try {
    const logs = await db()
      .select()
      .from(syncLog)
      .orderBy(desc(syncLog.startedAt))
      .limit(20)

    return NextResponse.json({
      success: true,
      logs,
    }, { headers: corsHeaders })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500, headers: corsHeaders })
  }
}
