import { neon, type NeonQueryFunction } from '@neondatabase/serverless'
import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http'
import * as schema from './schema'

type DbInstance = NeonHttpDatabase<typeof schema>

let _db: DbInstance | null = null

export function getDb(): DbInstance {
  if (!_db) {
    const databaseUrl = process.env.DATABASE_URL
    if (!databaseUrl) {
      throw new Error('DATABASE_URL no configurada')
    }
    _db = drizzle(neon(databaseUrl), { schema })
  }
  return _db
}

// Lazy proxy — avoids calling neon() at import time
export const db = new Proxy({} as DbInstance, {
  get(_target, prop, receiver) {
    const d = getDb()
    const value = Reflect.get(d, prop, receiver)
    if (typeof value === 'function') {
      return value.bind(d)
    }
    return value
  },
})
