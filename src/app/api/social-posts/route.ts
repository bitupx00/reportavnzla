import { NextRequest, NextResponse } from 'next/server'
import { sqlRaw } from '@/db'

export const dynamic = 'force-dynamic'

async function ensureSchema() {
  const sql = sqlRaw()
  await sql`
    CREATE TABLE IF NOT EXISTS social_posts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      url text NOT NULL UNIQUE,
      plataforma varchar(20),
      created_at timestamptz DEFAULT now()
    )`
}

function detectarPlataforma(url: string): string | null {
  if (/(?:twitter\.com|x\.com)\/.+\/status\/\d+/i.test(url)) return 'x'
  if (/instagram\.com\/(p|reel|tv)\//i.test(url)) return 'instagram'
  if (/facebook\.com\//i.test(url)) return 'facebook'
  return null
}

// GET /api/social-posts — publicaciones agregadas por la comunidad
export async function GET() {
  try {
    await ensureSchema()
    const sql = sqlRaw()
    const rows = await sql`
      SELECT id, url, plataforma, created_at AS "createdAt"
      FROM social_posts ORDER BY created_at DESC LIMIT 60`
    return NextResponse.json({ data: rows })
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}

// POST /api/social-posts — cualquiera puede agregar el link de una publicación
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const url = String(body.url || '').trim()
    if (!url || !/^https?:\/\//i.test(url) || url.length > 500) {
      return NextResponse.json({ error: 'URL inválida' }, { status: 400 })
    }
    const plataforma = detectarPlataforma(url)
    if (!plataforma) {
      return NextResponse.json({ error: 'Solo se aceptan enlaces de X (con /status/), Instagram (post/reel) o Facebook' }, { status: 400 })
    }
    await ensureSchema()
    const sql = sqlRaw()
    const rows = (await sql`
      INSERT INTO social_posts (url, plataforma) VALUES (${url}, ${plataforma})
      ON CONFLICT (url) DO NOTHING
      RETURNING id, url, plataforma, created_at AS "createdAt"`) as Array<Record<string, unknown>>
    return NextResponse.json({ ok: true, post: rows[0] || null }, { status: 201 })
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}
