import { neon } from '@neondatabase/serverless'
import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http'
import * as schema from './schema'
import { sql } from 'drizzle-orm'

type Db = NeonHttpDatabase<typeof schema>

let _db: Db | null = null
let _sql: ReturnType<typeof neon> | null = null

function getDb(): Db {
  if (!_db) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL no configurada')
    _sql = neon(url, { fetchOptions: { cache: 'no-store' } })
    _db = drizzle(_sql, { schema })
  }
  return _db
}

/** Get the raw neon sql function for queries that bypass ORM mapping */
function getSql() {
  if (!_sql) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL no configurada')
    _sql = neon(url, { fetchOptions: { cache: 'no-store' } })
  }
  return _sql
}

export { getDb as db, getSql as sqlRaw }
