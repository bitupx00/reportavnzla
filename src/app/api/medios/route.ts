import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { db } from '@/db'
import { medios } from '@/db/schema'

export const dynamic = 'force-dynamic'

// POST /api/medios — upload photo or video for a person
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const personaId = formData.get('personaId') as string
    const tipo = (formData.get('tipo') as string) || 'foto'
    const descripcion = formData.get('descripcion') as string | null
    const file = formData.get('file') as File | null

    if (!personaId || !file) {
      return NextResponse.json({ error: 'personaId y archivo requeridos' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const ext = file.name.split('.').pop()
    const filename = `${tipo}s/${personaId}/${Date.now()}.${ext}`

    const blob = await put(filename, bytes, {
      access: 'public',
      addRandomSuffix: true,
    })

    const [result] = await db.insert(medios).values({
      personaId,
      tipo: tipo as 'foto' | 'video',
      url: blob.url,
      descripcion: descripcion || null,
    }).returning()

    return NextResponse.json(result, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
