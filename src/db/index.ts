import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'

type DbInstance = ReturnType<typeof drizzle<typeof schema>>

let _db: DbInstance | null = null

function createDb(): DbInstance {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('DATABASE_URL no configurada')
  }
  return drizzle(neon(databaseUrl), { schema })
}

// Lazy proxy — avoids calling neon() at module import time
export const db = new Proxy({} as DbInstance, {
  get(_target, prop, receiver) {
    if (!_db) _db = createDb()
    const value = Reflect.get(_db, prop, receiver)
    if (typeof value === 'function') {
      return value.bind(_db)
    }
    return value
  },
})
