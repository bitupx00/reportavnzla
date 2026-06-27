/* eslint-disable @next/next/no-img-element, @typescript-eslint/no-explicit-any */
'use client'

import { useState } from 'react'

type Mode = 'registro' | 'busqueda' | 'duplicados' | 'ingesta' | 'conciliacion'

const TABS: { id: Mode; label: string; desc: string }[] = [
  { id: 'registro', label: '1 · Registro', desc: 'Sube una foto → ¿ya está registrada?' },
  { id: 'busqueda', label: '2 · Búsqueda', desc: 'Sube una foto → personas parecidas' },
  { id: 'duplicados', label: '3 · Duplicados', desc: 'Cruza la base y lista duplicados' },
  { id: 'ingesta', label: '4 · Ingesta', desc: 'Indexa un registro nuevo' },
  { id: 'conciliacion', label: '5 · Conciliación', desc: 'Misma persona en varias bases' },
]

function pct(s: number) { return Math.round((s || 0) * 100) }

export default function FRTestPage() {
  const [mode, setMode] = useState<Mode>('registro')
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">Reconocimiento facial — pruebas</h1>
      <p className="mt-1 text-sm text-gray-500">Demo de los 4 modos del FR-API (asistivo · requiere verificación humana).</p>

      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setMode(t.id)}
            className={`rounded-xl border px-3 py-2 text-left transition ${mode === t.id ? 'border-red-500 bg-red-50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
            <div className="text-sm font-semibold text-gray-900">{t.label}</div>
            <div className="text-[11px] leading-tight text-gray-500">{t.desc}</div>
          </button>
        ))}
      </div>

      <div className="mt-6">
        {mode === 'registro' && <FotoMode endpoint="/api/fr/check-duplicate" cta="Verificar duplicado" kind="check" />}
        {mode === 'busqueda' && <FotoMode endpoint="/api/fr/search" cta="Buscar parecidos" kind="search" />}
        {mode === 'duplicados' && <Duplicados />}
        {mode === 'ingesta' && <Ingesta />}
        {mode === 'conciliacion' && <Conciliacion />}
      </div>
    </main>
  )
}

/* Modos 1 y 2: subir una foto y mostrar candidatos/resultados */
function FotoMode({ endpoint, cta, kind }: { endpoint: string; cta: string; kind: 'check' | 'search' }) {
  const [preview, setPreview] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [res, setRes] = useState<any>(null)
  const [err, setErr] = useState<string | null>(null)

  function onFile(f: File | undefined) {
    if (!f) return
    setFile(f); setRes(null); setErr(null)
    const r = new FileReader(); r.onload = (e) => setPreview(e.target?.result as string); r.readAsDataURL(f)
  }
  async function run() {
    if (!file) return
    setLoading(true); setErr(null); setRes(null)
    try {
      const fd = new FormData(); fd.append('file', file)
      const r = await fetch(endpoint, { method: 'POST', body: fd })
      const d = await r.json()
      if (!r.ok || d.ok === false) setErr(d.error || (r.status === 422 ? 'No se detectó rostro.' : 'Error.'))
      else setRes(d)
    } catch { setErr('No se pudo conectar.') } finally { setLoading(false) }
  }

  const items = kind === 'check' ? res?.candidates : res?.results

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5">
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex h-28 w-28 cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-gray-300 hover:border-red-300">
          {preview ? <img src={preview} alt="" className="h-full w-full object-cover" /> : <span className="text-center text-xs text-gray-400">📷<br />Subir foto</span>}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
        <button onClick={run} disabled={!file || loading}
          className="rounded-xl bg-red-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-600 disabled:opacity-50">
          {loading ? 'Procesando…' : cta}
        </button>
      </div>

      {err && <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">{err}</p>}

      {res && kind === 'check' && (
        <p className={`mt-4 text-sm font-medium ${res.possible_duplicate ? 'text-red-600' : 'text-green-600'}`}>
          {res.possible_duplicate ? '⚠️ Posible duplicado — ' + res.message : '✓ Sin coincidencias relevantes.'}
        </p>
      )}

      {Array.isArray(items) && items.length > 0 && (
        <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {items.map((c: any, i: number) => (
            <li key={i} className="flex gap-3 rounded-xl border border-gray-200 p-2.5">
              {c.image_url && <img src={c.image_url} alt="" className="h-16 w-16 rounded-lg object-cover" />}
              <div className="min-w-0 text-sm">
                <div className="truncate font-medium text-gray-900">{c.person_name || 'Sin nombre'}</div>
                {c.last_seen_location && <div className="truncate text-xs text-gray-500">{c.last_seen_location}</div>}
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${c.band === 'alta' ? 'bg-green-100 text-green-700' : c.band === 'media' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>{pct(c.score)}%</span>
                  {c.source && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] text-blue-600">{c.source}</span>}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {res && Array.isArray(items) && items.length === 0 && <p className="mt-4 text-sm text-gray-500">Sin resultados.</p>}
    </section>
  )
}

/* Modo 3: duplicados dentro de la base de reportavnzla */
function Duplicados() {
  const [min, setMin] = useState('0.7')
  const [loading, setLoading] = useState(false)
  const [res, setRes] = useState<any>(null)
  const [err, setErr] = useState<string | null>(null)
  async function run() {
    setLoading(true); setErr(null); setRes(null)
    try {
      const r = await fetch(`/api/fr/duplicates?min_score=${min}&limit=300`)
      const d = await r.json()
      if (!r.ok || d.ok === false) setErr(d.error || 'Error.'); else setRes(d)
    } catch { setErr('No se pudo conectar.') } finally { setLoading(false) }
  }
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-gray-600">Similitud mínima
          <input type="number" step="0.05" min="0.3" max="1" value={min} onChange={(e) => setMin(e.target.value)}
            className="ml-2 w-20 rounded-lg border border-gray-300 px-2 py-1 text-sm" />
        </label>
        <button onClick={run} disabled={loading}
          className="rounded-xl bg-red-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50">
          {loading ? 'Cruzando base…' : 'Buscar duplicados'}
        </button>
      </div>
      {err && <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">{err}</p>}
      {res && (
        <>
          <p className="mt-4 text-sm text-gray-600">Revisados <b>{res.checked}</b> · pares duplicados: <b>{res.duplicates?.length || 0}</b></p>
          <ul className="mt-3 space-y-2">
            {(res.duplicates || []).map((p: any, i: number) => (
              <li key={i} className="flex items-center gap-3 rounded-xl border border-gray-200 p-2.5">
                {p.a_image && <img src={p.a_image} alt="" className="h-12 w-12 rounded-lg object-cover" />}
                <span className="text-sm text-gray-700">{p.a_name || '—'} <span className="text-gray-400">↔</span> {p.b_name || '—'}</span>
                {p.b_image && <img src={p.b_image} alt="" className="h-12 w-12 rounded-lg object-cover" />}
                <span className="ml-auto rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">{pct(p.score)}%</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

/* Modo 5: conciliación entre bases distintas (misma persona en varias plataformas) */
function Conciliacion() {
  const [min, setMin] = useState('0.55')
  const [loading, setLoading] = useState(false)
  const [res, setRes] = useState<any>(null)
  const [err, setErr] = useState<string | null>(null)
  async function run() {
    setLoading(true); setErr(null); setRes(null)
    try {
      const r = await fetch(`/api/fr/reconcile?min_score=${min}&limit=800`)
      const d = await r.json()
      if (!r.ok || d.ok === false) setErr(d.error || 'Error.'); else setRes(d)
    } catch { setErr('No se pudo conectar.') } finally { setLoading(false) }
  }
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5">
      <p className="text-sm text-gray-600">Encuentra a la <b>misma persona</b> reportada en bases distintas (p. ej. Azure ↔ reportavnzla) y trae <b>sus imágenes de cada base</b>.</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="text-sm text-gray-600">Similitud mínima
          <input type="number" step="0.05" min="0.3" max="1" value={min} onChange={(e) => setMin(e.target.value)}
            className="ml-2 w-20 rounded-lg border border-gray-300 px-2 py-1 text-sm" />
        </label>
        <button onClick={run} disabled={loading}
          className="rounded-xl bg-red-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50">
          {loading ? 'Conciliando bases…' : 'Conciliar bases'}
        </button>
      </div>
      {err && <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">{err}</p>}
      {res && (
        <>
          <p className="mt-4 text-sm text-gray-600">Revisados <b>{res.checked}</b> · identidades conciliadas (≥2 bases): <b>{res.groups?.length || 0}</b></p>
          <ul className="mt-3 space-y-3">
            {(res.groups || []).map((g: any, i: number) => (
              <li key={i} className="rounded-xl border border-gray-200 p-3">
                <div className="mb-2 flex items-center gap-2 text-xs">
                  {(g.sources || []).map((s: string) => <span key={s} className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-600">{s}</span>)}
                  <span className="ml-auto rounded-full bg-green-100 px-2 py-0.5 font-semibold text-green-700">{pct(g.score)}%</span>
                </div>
                <div className="flex flex-wrap gap-3">
                  {(g.records || []).map((r: any, j: number) => (
                    <div key={j} className="w-32">
                      {r.image_url
                        ? <img src={r.image_url} alt="" className="h-32 w-32 rounded-lg object-cover" />
                        : <div className="flex h-32 w-32 items-center justify-center rounded-lg bg-gray-100 text-xs text-gray-400">sin imagen</div>}
                      <div className="mt-1 truncate text-xs font-medium text-gray-900" title={r.person_name || ''}>{r.person_name || 'Sin nombre'}</div>
                      <div className="truncate text-[11px] text-blue-600">{r.source}</div>
                      {r.last_seen_location && <div className="truncate text-[11px] text-gray-500">{r.last_seen_location}</div>}
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

/* Modo 4: indexar un registro nuevo */
function Ingesta() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [id, setId] = useState('')
  const [nombre, setNombre] = useState('')
  const [loading, setLoading] = useState(false)
  const [res, setRes] = useState<any>(null)
  function onFile(f: File | undefined) {
    if (!f) return; setFile(f); setRes(null)
    const r = new FileReader(); r.onload = (e) => setPreview(e.target?.result as string); r.readAsDataURL(f)
  }
  async function run() {
    if (!file || !id.trim()) return
    setLoading(true); setRes(null)
    const fd = new FormData(); fd.append('file', file); fd.append('external_id', id.trim()); fd.append('person_name', nombre.trim())
    try { const r = await fetch('/api/fr/index', { method: 'POST', body: fd }); setRes(await r.json()) }
    catch { setRes({ ok: false, error: 'No se pudo conectar.' }) } finally { setLoading(false) }
  }
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5">
      <div className="flex flex-wrap items-start gap-4">
        <label className="flex h-24 w-24 cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-gray-300 hover:border-red-300">
          {preview ? <img src={preview} alt="" className="h-full w-full object-cover" /> : <span className="text-xs text-gray-400">📷</span>}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
        <div className="flex flex-1 flex-col gap-2">
          <input value={id} onChange={(e) => setId(e.target.value)} placeholder="external_id (id único)" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          <button onClick={run} disabled={!file || !id.trim() || loading}
            className="self-start rounded-xl bg-red-500 px-5 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50">
            {loading ? 'Indexando…' : 'Indexar en el FR-API'}
          </button>
        </div>
      </div>
      {res && <pre className="mt-4 overflow-x-auto rounded-lg bg-gray-50 p-3 text-xs text-gray-700">{JSON.stringify(res, null, 2)}</pre>}
    </section>
  )
}
