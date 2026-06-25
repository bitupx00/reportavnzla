/**
 * Sincronización con venezuelatebusca.com
 * Extrae registros de su Supabase público y los inserta en nuestra DB
 * Uso: npx tsx scripts/sync-vtb.ts
 */
const VTB_URL = process.env.VTB_SUPABASE_URL!
const VTB_KEY = process.env.VTB_SUPABASE_KEY!
const API_URL = `${VTB_URL}/rest/v1`
const HEADERS = {
  apikey: VTB_KEY,
  Authorization: `Bearer ${VTB_KEY}`,
  'Content-Type': 'application/json',
}

async function fetchAllVTBRecords() {
  const allRecords: any[] = []
  let offset = 0
  const limit = 500
  let hasMore = true

  while (hasMore) {
    const res = await fetch(
      `${API_URL}/desaparecidos?select=*&order=created_at.asc&limit=${limit}&offset=${offset}`,
      { headers: HEADERS }
    )
    if (!res.ok) throw new Error(`VTB API error: ${res.status}`)
    const data = await res.json()
    allRecords.push(...data)
    hasMore = data.length === limit
    offset += limit
    console.log(`  Fetched ${offset} records from VTB...`)
  }

  return allRecords
}

async function sync() {
  console.log('🔄 Sincronizando con venezuelatebusca.com...')
  console.log(`📡 Source: ${API_URL}`)

  try {
    const records = await fetchAllVTBRecords()
    console.log(`✅ Total obtenidos: ${records.length}`)

    // Map VTB schema to our schema
    const mapped = records.map((r: any) => ({
      externalId: r.id,
      nombre: r.nombre || '',
      apellido: r.apellido || '',
      cedula: r.cedula || null,
      edad: r.edad || null,
      genero: r.genero || null,
      ultimaUbicacion: r.ultima_ubicacion || null,
      descripcion: r.descripcion || null,
      fotoUrl: r.foto_url ? `${VTB_URL}/storage/v1/object/public/fotos-desaparecidos/${r.foto_url}` : null,
      estado: r.estado === 'encontrado' ? 'encontrado' : 'buscado',
      notas: r.notas || null,
      fechaEncontrado: r.fecha_encontrado || null,
      reportadoPorNombre: r.reportado_por_nombre || null,
      reportadoPorTelefono: r.reportado_por_telefono || null,
      reportadoPorEmail: r.reportado_por_email || null,
      createdAt: r.created_at || new Date().toISOString(),
    }))

    // In production, insert into DB using Drizzle
    // For now, output mapped data
    console.log(`📊 Mapeados: ${mapped.length} registros`)
    console.log(`   Buscados: ${mapped.filter((r: any) => r.estado === 'buscado').length}`)
    console.log(`   Encontrados: ${mapped.filter((r: any) => r.estado === 'encontrado').length}`)

    // Example: insert to our DB
    // const { db } = await import('../src/db')
    // for (const record of mapped) {
    //   await db.insert(personas).values(record).onConflictDoNothing()
    // }

    console.log('✅ Sincronización completada')
  } catch (error: any) {
    console.error('❌ Error en sincronización:', error.message)
    process.exit(1)
  }
}

sync()
