import { db } from '@/db'
import { personas, zonasAfectadas } from '@/db/schema'
import { sql, desc } from 'drizzle-orm'
import HomeClient from './HomeClient'

export const dynamic = 'force-dynamic'

const emptyStats = { total: 0, buscados: 0, encontrados: 0, fallecidos: 0 }

async function getInitialStats() {
  try {
    const result = await db
      .select({
        total: sql<number>`count(*)::int`,
        buscados: sql<number>`count(*)::int FILTER (WHERE ${personas.estado} = 'buscado')`,
        encontrados: sql<number>`count(*)::int FILTER (WHERE ${personas.estado} = 'encontrado')`,
        fallecidos: sql<number>`count(*)::int FILTER (WHERE ${personas.estado} = 'fallecido')`,
      })
      .from(personas)
    return result[0] || emptyStats
  } catch {
    return emptyStats
  }
}

async function getInitialPersonas() {
  try {
    const rows = await db
      .select()
      .from(personas)
      .orderBy(desc(personas.createdAt))
      .limit(24)
    return rows.map(r => ({
      ...r,
      fechaEncontrado: r.fechaEncontrado ? String(r.fechaEncontrado) : null,
      createdAt: String(r.createdAt),
      updatedAt: String(r.updatedAt),
    }))
  } catch {
    return []
  }
}

async function getZonasAfectadas() {
  try {
    const rows = await db.select().from(zonasAfectadas)
    return rows.map(z => ({
      id: z.id,
      nombre: z.nombre,
      lat: z.lat,
      lng: z.lng,
      radioKm: z.radioKm,
      severidad: z.severidad,
    }))
  } catch {
    return []
  }
}

export default async function HomePage() {
  const [stats, initialPersonas, initialZonas] = await Promise.all([
    getInitialStats(),
    getInitialPersonas(),
    getZonasAfectadas(),
  ])

  return <HomeClient initialStats={stats} initialPersonas={initialPersonas} initialZonas={initialZonas} />
}
