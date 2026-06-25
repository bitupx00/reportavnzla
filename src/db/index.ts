import { neon } from '@neondatabase/serverless'
import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http'
import * as schema from './schema'

type Db = NeonHttpDatabase<typeof schema>

let _db: Db | null = null

function getDb(): Db {
  if (!_db) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL no configurada')
    _db = drizzle(neon(url), { schema })
  }
  return _db
}

// Export a simple getter instead of a Proxy — more reliable for method chaining
export function db() {
  return getDb()
}

// Re-export for convenience in route files that already import `db` as a value
export { getDb as dbInstance }
