const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);

async function test() {
  const cols = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'personas' ORDER BY ordinal_position`;
  console.log('=== PERSONAS columns ===');
  cols.forEach(c => console.log(' ', c.column_name, c.data_type));

  const zCols = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'zonas_afectadas' ORDER BY ordinal_position`;
  console.log('\n=== ZONAS_AFFECTADAS columns ===');
  zCols.forEach(c => console.log(' ', c.column_name, c.data_type));

  const p = await sql`SELECT * FROM personas LIMIT 1`;
  console.log('\n=== Sample persona ===');
  console.log(JSON.stringify(p[0], null, 2));
  
  const z = await sql`SELECT * FROM zonas_afectadas LIMIT 1`;
  console.log('\n=== Sample zona ===');
  console.log(JSON.stringify(z[0], null, 2));
}

test().catch(e => console.error('ERR:', e.message));
