import { db } from '@/db'
import { personas, zonasAfectadas } from '@/db/schema'
import { sql, desc, eq } from 'drizzle-orm'
import HomeClient from './HomeClient'

export const dynamic = 'force-dynamic'

async function getInitialStats() {
  try {
    const [buscados, encontrados, fallecidos, total] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(personas)
        .where(sql`${personas.estado} = 'buscado'`),
      db.select({ count: sql<number>`count(*)::int` }).from(personas)
        .where(sql`${personas.estado} = 'encontrado'`),
      db.select({ count: sql<number>`count(*)::int` }).from(personas)
        .where(sql`${personas.estado} = 'fallecido'`),
      db.select({ count: sql<number>`count(*)::int` }).from(personas),
    ])
    return {
      total: total[0]?.count || 0,
      buscados: buscados[0]?.count || 0,
      encontrados: encontrados[0]?.count || 0,
      fallecidos: fallecidos[0]?.count || 0,
    }
  } catch {
    return { total: 0, buscados: 0, encontrados: 0, fallecidos: 0 }
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
