require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);

async function test() {
  // Check if fuentes_datos exists
  const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`;
  console.log('=== TABLES ===');
  tables.forEach(t => console.log(' ', t.table_name));

  // Test drizzle-style query
  const { drizzle } = require('drizzle-orm/neon-http');
  const schema = require('./src/db/schema');
  
  const db = drizzle(sql, { schema });
  
  try {
    const p = await db.select().from(schema.personas).limit(1);
    console.log('\n=== Drizzle personas OK ===');
    console.log(JSON.stringify(p[0], null, 2));
  } catch(e) {
    console.error('\n=== Drizzle personas FAILED ===');
    console.error(e.message);
  }

  try {
    const z = await db.select().from(schema.zonasAfectadas).limit(1);
    console.log('\n=== Drizzle zonas OK ===');
    console.log(JSON.stringify(z[0], null, 2));
  } catch(e) {
    console.error('\n=== Drizzle zonas FAILED ===');
    console.error(e.message);
  }
}

test().catch(e => console.error('ERR:', e.message));
