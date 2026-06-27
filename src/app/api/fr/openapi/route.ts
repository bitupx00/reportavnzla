import { NextResponse } from 'next/server'

// Proxy server-side al esquema OpenAPI del FR-API (reconocimiento facial).
// /openapi.json es PÚBLICO en el FR-API, así que no requiere API key. Lo
// reexponemos same-origin (HTTPS) para evitar mixed-content y para que el
// navegador pueda descargarlo como adjunto sin tocar el host HTTP del FR-API.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Tolerante: si FR_API_URL viene sin esquema (p. ej. "host:8808"), le
// anteponemos http:// para evitar el error "unknown scheme" de fetch. Quita
// los slashes finales para no duplicar "/".
const FR_RAW = process.env.FR_API_URL || ''
const FR = (/^https?:\/\//i.test(FR_RAW) ? FR_RAW : `http://${FR_RAW}`).replace(/\/+$/, '')

export async function GET() {
  try {
    const r = await fetch(`${FR}/openapi.json`, { cache: 'no-store' })
    if (!r.ok) {
      return NextResponse.json(
        { ok: false, error: `El FR-API respondió ${r.status} al pedir el OpenAPI.` },
        { status: 502 },
      )
    }
    const body = await r.text()
    return new NextResponse(body, {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'content-disposition': 'attachment; filename="fr-api-openapi.json"',
        'cache-control': 'no-store',
      },
    })
  } catch {
    return NextResponse.json(
      { ok: false, error: 'No se pudo conectar con el FR-API para obtener el OpenAPI.' },
      { status: 502 },
    )
  }
}
