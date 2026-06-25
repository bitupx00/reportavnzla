import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { personas } from '@/db/schema'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

// GET /api/personas/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const [result] = await db
      .select()
      .from(personas)
      .where(eq(personas.id, params.id))
      .limit(1)

    if (!result) {
      return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    }

    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
