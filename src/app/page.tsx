import { sqlRaw } from '@/db'
import { db } from '@/db'
import { personas } from '@/db/schema'
import { sql, desc, eq } from 'drizzle-orm'
import HomeClient from './HomeClient'

export const dynamic = 'force-dynamic'

async function getInitialStats() {
  try {
    const [buscados, encontrados, fallecidos, total] = await Promise.all([
      db().select({ count: sql<number>`count(*)::int` }).from(personas)
        .where(sql`${personas.estado} = 'buscado'`),
      db().select({ count: sql<number>`count(*)::int` }).from(personas)
        .where(sql`${personas.estado} = 'encontrado'`),
      db().select({ count: sql<number>`count(*)::int` }).from(personas)
        .where(sql`${personas.estado} = 'fallecido'`),
      db().select({ count: sql<number>`count(*)::int` }).from(personas),
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
    const query = sqlRaw()
    const rows = await query`
      SELECT id, nombre, apellido, cedula, edad, genero, 
             ultima_ubicacion as "ultimaUbicacion", descripcion,
             foto_url as "fotoUrl", estado, lat, lng,
             fecha_encontrado as "fechaEncontrado",
             reportado_por_nombre as "reportadoPorNombre",
             reportado_por_telefono as "reportadoPorTelefono",
             reportado_por_email as "reportadoPorEmail",
             created_at as "createdAt", updated_at as "updatedAt"
      FROM personas 
      ORDER BY created_at DESC 
      LIMIT 24
    `
    return (rows as Record<string, unknown>[]).map((r) => ({
      ...r,
      fechaEncontrado: r.fechaEncontrado ? String(r.fechaEncontrado) : null,
      createdAt: String(r.createdAt),
      updatedAt: String(r.updatedAt),
    }))
  } catch (e) {
    console.error('getInitialPersonas error:', e)
    return []
  }
}

async function getZonasAfectadas() {
  try {
    const query = sqlRaw()
    const rows = await query`
      SELECT id, nombre, lat, lng, radio_km as "radioKm", severidad, descripcion
      FROM zonas_afectadas
    `
    return rows
  } catch (e) {
    console.error('getZonasAfectadas error:', e)
    return []
  }
}

export default async function HomePage() {
  const [stats, initialPersonas, initialZonas] = await Promise.all([
    getInitialStats(),
    getInitialPersonas(),
    getZonasAfectadas(),
  ])

  return <HomeClient initialStats={stats} initialPersonas={initialPersonas as any[]} initialZonas={initialZonas as any[]} />
}
