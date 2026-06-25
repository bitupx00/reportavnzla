import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { personas, syncLog } from '@/db/schema'
import { eq, sql, desc, inArray } from 'drizzle-orm'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}

type Estado = 'buscado' | 'encontrado' | 'fallecido'

const VTB_API = 'https://venezuela-te-busca-app.hellogafaro.workers.dev/api/persons'
const DTV_API = 'https://desaparecidos-terremoto-api.theempire.tech/api/personas'
const TVE_API = 'https://terremotovenezuela.app/api/missing'
const SOS_API = 'https://sosvenezuela2026.com/api/persons/list'

async function fetchRecentTVE(limit = 500) {
  const all: any[] = []
  for (const status of ['active', 'found']) {
    let page = 1
    const maxPages = Math.ceil(limit / 100) + 2
    while (page <= maxPages && all.length < limit) {
      try {
        const resp = await fetch(`${TVE_API}?status=${status}&page=${page}&pageSize=100`)
        if (!resp.ok) break
        const data = await resp.json()
        const people = data.people || data.data || []
        if (!people.length) break
        for (const r of people) { r._tve_status = status; all.push(r) }
        if (data.totalPages && page >= data.totalPages) break
        page++
      } catch { break }
    }
  }
  return all.slice(0, limit)
}

async function fetchRecentSOS(limit = 500) {
  try {
    // SOS API returns newest first, so offset=0 gets the most recent
    const resp = await fetch(`${SOS_API}?offset=0&limit=${limit}`)
    if (!resp.ok) return []
    const data = await resp.json()
    return Array.isArray(data) ? data.slice(0, limit) : (data.data || data.persons || data.items || []).slice(0, limit)
  } catch { return [] }
}

async function fetchRecentVTB(limit = 500) {
  const all: any[] = []
  let cursor: string | undefined
  while (all.length < limit) {
    const url = cursor
      ? `${VTB_API}?limit=250&cursor=${encodeURIComponent(cursor)}`
      : `${VTB_API}?limit=250`
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } })
    if (!res.ok) throw new Error(`VTB ${res.status}`)
    const data = await res.json()
    const items: any[] = data.persons || []
    if (!items.length) break
    all.push(...items)
    cursor = items[items.length - 1].created_at
    if (items.length < 250) break
  }
  return all.slice(0, limit)
}

async function fetchRecentDTV(limit = 500) {
  const all: any[] = []
  for (let page = 1; all.length < limit; page++) {
    const res = await fetch(`${DTV_API}?page=${page}&pageSize=100`, {
      headers: { 'Accept': 'application/json' },
    })
    if (!res.ok) throw new Error(`DTV ${res.status}`)
    const data = await res.json()
    const items: any[] = data.items || []
    if (!items.length) break
    all.push(...items)
    if (items.length < 100) break
    if (page < 6) await new Promise(r => setTimeout(r, 520))
  }
  return all.slice(0, limit)
}

// ─── Sync: batch lookup + diff ──────────────────────────────
async function syncSource(source: 'vtb' | 'dtv' | 'tve' | 'sos', limit: number) {
  const t0 = Date.now()
  const stats = { totalFetched: 0, newInserted: 0, statusChanged: 0, updated: 0, errors: 0 }
  const changes: string[] = []

  const [log] = await db()
    .insert(syncLog).values({ source, status: 'running', startedAt: new Date() }).returning()

  try {
    const raw = source === 'vtb' ? await fetchRecentVTB(limit)
      : source === 'dtv' ? await fetchRecentDTV(limit)
      : source === 'tve' ? await fetchRecentTVE(limit)
      : await fetchRecentSOS(limit)
    stats.totalFetched = raw.length

    // Parse all records into our format
    const parsed = raw.map((r: any) => {
      if (source === 'vtb') {
        const nombre = (r.first_name || '').trim()
        const apellido = (r.last_name || '').trim()
        if (!nombre || nombre.length < 2) return null
        return {
          externalId: `vtb-${r.id}`,
          nombre: nombre.slice(0, 100),
          apellido: apellido.slice(0, 100),
          cedula: r.national_id || null,
          edad: r.age ? parseInt(r.age) : null,
          estado: (r.status === 'found' ? 'encontrado' : 'buscado') as Estado,
          ubicacion: r.last_seen_location || null,
          descripcion: r.description || null,
          fotoUrl: r.photo_key ? `https://venezuela-te-busca-app.hellogafaro.workers.dev${r.photo_key}` : null,
          reportadoPorNombre: r.reporter_name || null,
        }
      } else if (source === 'dtv') {
        const nombre = (r.nombre || '').trim()
        if (!nombre || nombre.length < 2) return null
        const parts = nombre.split(' ')
        return {
          externalId: `dtv-${r.id}`,
          nombre: parts[0].slice(0, 100),
          apellido: (parts.slice(1).join(' ') || ' ').slice(0, 100),
          edad: r.edad ? parseInt(r.edad) : null,
          estado: (r.estado === 'localizado' ? 'encontrado' : 'buscado') as Estado,
          ubicacion: r.ubicacion || null,
          descripcion: r.descripcion || null,
          fotoUrl: r.foto || null,
          reportadoPorNombre: r.localizadoPor || null,
        }
      } else if (source === 'tve') {
        const nombre = (r.name || '').trim()
        if (!nombre || nombre.length < 2) return null
        const parts = nombre.split(' ')
        return {
          externalId: `tve-${r.id}`,
          nombre: parts[0].slice(0, 100),
          apellido: (parts.slice(1).join(' ') || ' ').slice(0, 100),
          cedula: r.ciPassport || null,
          edad: r.age ? parseInt(r.age) : null,
          estado: (r._tve_status === 'found' || r.status === 'found' ? 'encontrado' : 'buscado') as Estado,
          ubicacion: r.location || null,
          descripcion: r.description || null,
          fotoUrl: r.photoUrl || null,
          reportadoPorNombre: null,
        }
      } else {
        // SOS
        const nombre = (r.display_name || '').trim()
        if (!nombre || nombre.length < 2) return null
        const parts = nombre.split(' ')
        return {
          externalId: `sos-${r.id}`,
          nombre: parts[0].slice(0, 100),
          apellido: (parts.slice(1).join(' ') || ' ').slice(0, 100),
          cedula: r.cedula_masked || null,
          edad: null,
          estado: (r.status === 'found_alive' ? 'encontrado' : 'buscado') as Estado,
          ubicacion: r.parroquia || r.municipio || null,
          descripcion: null,
          fotoUrl: r.photo_path || null,
          reportadoPorNombre: null,
        }
      }
    }).filter(Boolean) as any[]

    // Batch lookup: get all existing records by external_id
    const externalIds = parsed.map(p => p.externalId)
    const existingMap = new Map<string, { id: string; estado: string }>()

    // Query in chunks of 200 (PostgreSQL IN clause limit)
    for (let i = 0; i < externalIds.length; i += 200) {
      const chunk = externalIds.slice(i, i + 200)
      const rows = await db()
        .select({ id: personas.id, estado: personas.estado, externalId: personas.externalId })
        .from(personas)
        .where(inArray(personas.externalId, chunk))
      for (const row of rows) {
        if (row.externalId) existingMap.set(row.externalId, row)
      }
    }

    // Diff: categorize into new / status_changed / unchanged
    const newRecords: any[] = []
    const statusUpdates: any[] = []

    for (const p of parsed) {
      const existing = existingMap.get(p.externalId)
      if (!existing) {
        newRecords.push(p)
      } else if (existing.estado !== p.estado) {
        statusUpdates.push({ ...p, existingId: existing.id, oldEstado: existing.estado })
      } else {
        stats.updated++
      }
    }

    // Batch insert new records (chunks of 50)
    for (let i = 0; i < newRecords.length; i += 50) {
      const chunk = newRecords.slice(i, i + 50)
      try {
        await db().insert(personas).values(chunk.map(r => ({
          externalId: r.externalId,
          nombre: r.nombre,
          apellido: r.apellido,
          cedula: r.cedula,
          edad: r.edad,
          estado: r.estado,
          ultimaUbicacion: r.ubicacion,
          descripcion: r.descripcion,
          fotoUrl: r.fotoUrl,
          reportadoPorNombre: r.reportadoPorNombre,
        })))
        stats.newInserted += chunk.length
      } catch (e: any) {
        // If batch fails, insert one by one to find the problem
        for (const r of chunk) {
          try {
            await db().insert(personas).values({
              externalId: r.externalId, nombre: r.nombre, apellido: r.apellido,
              cedula: r.cedula, edad: r.edad, estado: r.estado,
              ultimaUbicacion: r.ubicacion, descripcion: r.descripcion,
              fotoUrl: r.fotoUrl, reportadoPorNombre: r.reportadoPorNombre,
            })
            stats.newInserted++
          } catch (e2: any) {
            stats.errors++
          }
        }
      }
    }

    // Batch update status changes
    for (const u of statusUpdates) {
      try {
        await db()
          .update(personas)
          .set({ estado: u.estado, updatedAt: new Date() })
          .where(eq(personas.id, u.existingId))
        stats.statusChanged++
        changes.push(`${u.nombre} ${u.apellido}: ${u.oldEstado} → ${u.estado}`)
      } catch (e: any) {
        stats.errors++
      }
    }

    const durationMs = Date.now() - t0
    await db()
      .update(syncLog)
      .set({
        status: 'completed', totalFetched: stats.totalFetched,
        newInserted: stats.newInserted, statusChanged: stats.statusChanged,
        updated: stats.updated, errors: stats.errors, durationMs,
        details: JSON.stringify({ changes: changes.slice(0, 30) }),
        completedAt: new Date(),
      })
      .where(eq(syncLog.id, log.id))

    return { success: true, ...stats, durationMs, source, changes: changes.slice(0, 10) }
  } catch (error: any) {
    await db()
      .update(syncLog)
      .set({ status: 'error', errors: 1, durationMs: Date.now() - t0, details: error.message, completedAt: new Date() })
      .where(eq(syncLog.id, log.id))
    return { success: false, error: error.message, ...stats, durationMs: Date.now() - t0, source }
  }
}

// POST /api/v1/sync/pull — trigger incremental sync
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const sources: string[] = body.sources || ['vtb', 'dtv', 'tve', 'sos']
    const limit = Math.min(body.limit || 500, 2000)
    const results: any[] = []
    for (const s of sources) {
      if (['vtb', 'dtv', 'tve', 'sos'].includes(s)) {
        results.push(await syncSource(s as 'vtb' | 'dtv' | 'tve' | 'sos', limit))
      }
    }
    return NextResponse.json({ success: true, syncedAt: new Date().toISOString(), results }, { headers: corsHeaders })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500, headers: corsHeaders })
  }
}

// GET /api/v1/sync/pull — sync history
export async function GET() {
  try {
    const logs = await db().select().from(syncLog).orderBy(desc(syncLog.startedAt)).limit(20)
    return NextResponse.json({ success: true, logs }, { headers: corsHeaders })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500, headers: corsHeaders })
  }
}
